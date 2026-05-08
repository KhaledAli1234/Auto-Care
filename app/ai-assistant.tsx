import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { BottomNavbar } from "@/components/bottom-navbar";
import { useUserProfile } from "@/context/user-profile-context";
import { BASE_URL } from "@/constants/api";
import { NotificationBell } from "@/components/notification-bell";

/* ════════════════════════════════════════
   COLORS
════════════════════════════════════════ */
const COLORS = {
  background:  "#09182d",
  surface:     "#13243a",
  surfaceDark: "#102036",
  surfaceLight: "#172b44",
  border:      "rgba(255,255,255,0.08)",
  divider:     "rgba(255,255,255,0.07)",
  text:        "#f8fafc",
  muted:       "#b8c3d6",
  mutedDark:   "#8492a8",
  primary:     "#3268f7",
  primarySoft: "#4f8cff",
  input:       "#0f1f34",
  danger:      "#ef4444",
};

/* ════════════════════════════════════════
   TYPES
════════════════════════════════════════ */
type AssistantTab = "ai" | "support";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
  createdAtLabel: string;
  isTyping?: boolean;
};

/* ════════════════════════════════════════
   CONSTANTS
════════════════════════════════════════ */
const QUICK_QUESTIONS = [
  "Is my driving safe?",
  "Is fuel consumption normal?",
  "When is my next service?",
  "How to improve my score?",
];

const SUPPORT_REPLY_NOTE = "Support Team • Usually replies within a few hours";

function getCurrentTimeLabel() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/* ════════════════════════════════════════
   API HELPERS
════════════════════════════════════════ */
async function authHeaders() {
  const token = await AsyncStorage.getItem("access_token");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token?.replace(/"/g, "") ?? ""}`,
  };
}

async function apiGet(path: string) {
  try {
    const res  = await fetch(`${BASE_URL}${path}`, { method: "GET", headers: await authHeaders() });
    const json = await res.json();
    return res.ok ? json : null;
  } catch {
    return null;
  }
}

/* ════════════════════════════════════════
   BUILD SYSTEM PROMPT WITH REAL CONTEXT
════════════════════════════════════════ */
async function buildSystemPrompt(
  vehicleName: string,
  vehicleDetails: any,
  userId: string,
): Promise<string> {
  // Fetch latest trip + dashboard in parallel
  const [latestTripRes, dashboardRes] = await Promise.all([
    apiGet(`/trips/latest/me`),
    apiGet(`/dashboard/${userId}`),
  ]);

  const trip      = latestTripRes?.data;
  const dashboard = dashboardRes?.data?.dashboard;

  const vehicleSection = vehicleName
    ? `
VEHICLE:
- Car: ${vehicleName}
- Year: ${vehicleDetails?.year ?? "Unknown"}
- Engine: ${vehicleDetails?.engineCapacity ?? "Unknown"} CC
- Fuel Type: ${vehicleDetails?.fuelType ?? "Unknown"}
- Transmission: ${vehicleDetails?.transmission ?? "Unknown"}
- Mileage: ${vehicleDetails?.mileage ?? "Unknown"} km
`
    : "VEHICLE: No vehicle registered yet.";

  const tripSection = trip?.trip_summary
    ? `
LATEST TRIP:
- Distance: ${trip.trip_summary.distance_km} km
- Duration: ${trip.trip_summary.duration_min} min
- Avg Speed: ${trip.trip_summary.avg_speed} km/h
- Max Speed: ${trip.trip_summary.max_speed} km/h
- Driving Score: ${trip.driving_behavior?.driver_score ?? "N/A"} / 100
- Driver Style: ${trip.driving_behavior?.driver_style ?? "Unknown"}
- Harsh Brakes: ${trip.driving_behavior?.harsh_brake_count ?? 0}
- Harsh Accelerations: ${trip.driving_behavior?.harsh_accel_count ?? 0}
- Vehicle Health: ${trip.vehicle_health?.health_status ?? "Unknown"} (Score: ${trip.vehicle_health?.vehicle_health_score ?? "N/A"})
- Fuel Efficiency: ${trip.fuel_efficiency?.efficiency_label ?? "Unknown"} (${trip.fuel_efficiency?.actual_fuel_l_100km ?? "N/A"} L/100km)
- Alerts: ${trip.vehicle_health?.alerts?.join(", ") || "None"}
`
    : "LATEST TRIP: No trips recorded yet.";

  const dashboardSection = dashboard
    ? `
OVERALL STATS:
- Total Trips: ${dashboard.totalTrips}
- Total Distance: ${dashboard.totalDistance} km
- Health Score: ${dashboard.healthScore} / 100
- Fuel Consumption: ${dashboard.fuel?.consumption ?? 0} L/100km
- Total Fuel Cost: ${dashboard.fuel?.totalCost ?? 0} EGP
- Maintenance Risk: ${dashboard.maintenance?.riskLevel ?? "Unknown"}
- Upcoming Maintenance: ${dashboard.maintenance?.upcomingCount ?? 0} tasks
- Safe Driving Streak: ${dashboard.streak?.safeDriving ?? 0} days
`
    : "OVERALL STATS: No dashboard data yet.";

  return `You are CarAI, an intelligent car assistant. You help the user understand their vehicle health, driving behavior, fuel efficiency, and maintenance needs. Be concise, friendly, and always base your answers on the real data below. If data is missing or zero, acknowledge it honestly and give general advice.

${vehicleSection}
${tripSection}
${dashboardSection}

RULES:
- Answer in the same language the user writes in (Arabic or English).
- Keep responses short and clear — max 4 sentences unless more detail is needed.
- Always reference the real numbers from the data above when relevant.
- Never make up data. If something is missing, say so.
- Don't repeat the user's question back to them.`;
}

/* ════════════════════════════════════════
   CALL CLAUDE API
════════════════════════════════════════ */
async function callClaudeAPI(
  messages: { role: "user" | "assistant"; content: string }[],
  systemPrompt: string,
): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: systemPrompt,
      messages,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.warn("[Claude API error]", data);
    throw new Error(data?.error?.message ?? "Claude API failed");
  }

  return data.content?.[0]?.text ?? "Sorry, I couldn't generate a response.";
}

/* ════════════════════════════════════════
   SCREEN
════════════════════════════════════════ */
export default function AIAssistantScreen() {
  const insets   = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const { profile } = useUserProfile();

  const [activeTab,      setActiveTab]      = useState<AssistantTab>("ai");
  const [aiMessages,     setAiMessages]     = useState<ChatMessage[]>([{
    id: "ai-welcome",
    role: "assistant",
    text: "Hello! I'm CarAI, your personal car assistant. Ask me anything about your car's performance, driving habits, fuel efficiency, or maintenance.",
    createdAtLabel: getCurrentTimeLabel(),
  }]);
  const [supportMessages,setSupportMessages]= useState<ChatMessage[]>([]);
  const [inputText,      setInputText]      = useState("");
  const [isLoading,      setIsLoading]      = useState(false);
  const [systemPrompt,   setSystemPrompt]   = useState("");
  const [userId,         setUserId]         = useState("");

  const vehicleName = useMemo(
    () => [profile?.vehicle?.brand, profile?.vehicle?.model].filter(Boolean).join(" "),
    [profile?.vehicle?.brand, profile?.vehicle?.model],
  );

  /* ── Load userId + build system prompt once ── */
  useEffect(() => {
    const init = async () => {
      const uid = (await AsyncStorage.getItem("userId"))?.replace(/"/g, "") ?? "";
      setUserId(uid);
      if (uid) {
        const prompt = await buildSystemPrompt(vehicleName, profile?.vehicle, uid);
        setSystemPrompt(prompt);
      }
    };
    init();
  }, [vehicleName, profile?.vehicle]);

  const messages = activeTab === "ai" ? aiMessages : supportMessages;

  const scrollToBottom = () => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  };

  /* ════════ SEND MESSAGE ════════ */
  const handleSendMessage = async (messageText = inputText) => {
    const trimmed = messageText.trim();
    if (!trimmed || isLoading) return;

    const userMsg: ChatMessage = {
      id:             `user-${Date.now()}`,
      role:           "user",
      text:           trimmed,
      createdAtLabel: getCurrentTimeLabel(),
    };

    if (activeTab === "support") {
      setSupportMessages(cur => [...cur, userMsg]);
      setInputText("");
      scrollToBottom();
      return;
    }

    // AI tab
    const typingMsg: ChatMessage = {
      id:             "typing",
      role:           "assistant",
      text:           "",
      createdAtLabel: "",
      isTyping:       true,
    };

    setAiMessages(cur => [...cur, userMsg, typingMsg]);
    setInputText("");
    setIsLoading(true);
    scrollToBottom();

    try {
      // Build conversation history for Claude (exclude typing indicator + welcome)
      const history = aiMessages
        .filter(m => !m.isTyping && m.id !== "ai-welcome")
        .map(m => ({ role: m.role as "user" | "assistant", content: m.text }));

      history.push({ role: "user", content: trimmed });

      const reply = await callClaudeAPI(history, systemPrompt);

      const assistantMsg: ChatMessage = {
        id:             `assistant-${Date.now()}`,
        role:           "assistant",
        text:           reply,
        createdAtLabel: getCurrentTimeLabel(),
      };

      setAiMessages(cur => [...cur.filter(m => m.id !== "typing"), assistantMsg]);
    } catch (err) {
      const errorMsg: ChatMessage = {
        id:             `error-${Date.now()}`,
        role:           "assistant",
        text:           "Sorry, I couldn't reach the AI right now. Please try again.",
        createdAtLabel: getCurrentTimeLabel(),
      };
      setAiMessages(cur => [...cur.filter(m => m.id !== "typing"), errorMsg]);
    } finally {
      setIsLoading(false);
      scrollToBottom();
    }
  };

  /* ════════════════════════════════════════
     RENDER
  ════════════════════════════════════════ */
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>AI Assistant</Text>
        <View style={styles.headerActions}>
          <NotificationBell iconSize={20} color={COLORS.text} />
          <Pressable style={styles.headerIcon} hitSlop={10} onPress={() => router.push("/account")}>
            <Ionicons name="person-outline" size={20  } color={COLORS.text} />
          </Pressable>
        </View>
      </View>
      <View style={styles.divider} />

      <KeyboardAvoidingView
        style={styles.keyboardArea}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
      >
        <View style={styles.content}>
          {/* Tabs */}
          <View style={styles.segmentWrap}>
            <Pressable
              style={[styles.segmentButton, activeTab === "ai" && styles.segmentButtonActive]}
              onPress={() => setActiveTab("ai")}
            >
              <Ionicons name="sparkles-outline" size={20} color={activeTab === "ai" ? COLORS.text : COLORS.muted} />
              <Text style={[styles.segmentText, activeTab === "ai" && styles.segmentTextActive]}>AI Assistant</Text>
            </Pressable>
            <Pressable
              style={[styles.segmentButton, activeTab === "support" && styles.segmentButtonActive]}
              onPress={() => setActiveTab("support")}
            >
              <Ionicons name="headset-outline" size={20} color={activeTab === "support" ? COLORS.text : COLORS.muted} />
              <Text style={[styles.segmentText, activeTab === "support" && styles.segmentTextActive]}>Support</Text>
            </Pressable>
          </View>

          {activeTab === "support" && (
            <View style={styles.supportStatusRow}>
              <View style={styles.supportStatusDot} />
              <Text style={styles.supportStatusText}>{SUPPORT_REPLY_NOTE}</Text>
            </View>
          )}

          {/* Messages */}
          <ScrollView
            ref={scrollRef}
            style={styles.messagesScroll}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={scrollToBottom}
          >
            {messages.map(message => (
              <ChatBubble key={message.id} message={message} />
            ))}
          </ScrollView>

          {/* Quick questions — AI tab only, no messages yet */}
          {activeTab === "ai" && aiMessages.length <= 1 && (
            <View style={styles.quickQuestionsWrap}>
              <Text style={styles.quickQuestionsTitle}>Quick questions:</Text>
              <View style={styles.quickQuestionsGrid}>
                {QUICK_QUESTIONS.map(q => (
                  <Pressable
                    key={q}
                    style={styles.quickQuestionButton}
                    onPress={() => handleSendMessage(q)}
                    disabled={isLoading}
                  >
                    <Text style={styles.quickQuestionText}>{q}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* Input */}
          <View style={[styles.inputRow, { marginBottom: Math.max(insets.bottom, 10) }]}>
            <TextInput
              style={styles.messageInput}
              placeholder={activeTab === "ai" ? "Ask about your car..." : "Type your message..."}
              placeholderTextColor={COLORS.mutedDark}
              value={inputText}
              onChangeText={setInputText}
              multiline
              textAlignVertical="center"
              returnKeyType="send"
              onSubmitEditing={() => handleSendMessage()}
              editable={!isLoading}
            />
            <Pressable
              style={[styles.sendButton, (!inputText.trim() || isLoading) && styles.sendButtonDisabled]}
              onPress={() => handleSendMessage()}
              disabled={!inputText.trim() || isLoading}
            >
              {isLoading
                ? <ActivityIndicator color={COLORS.text} size="small" />
                : <Ionicons name="paper-plane-outline" size={22} color={COLORS.text} />
              }
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

      <BottomNavbar activeTab="ai" />
    </View>
  );
}

/* ════════════════════════════════════════
   CHAT BUBBLE
════════════════════════════════════════ */
function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  if (message.isTyping) {
    return (
      <View style={styles.messageBubble}>
        <View style={styles.messageLabelRow}>
          <Ionicons name="sparkles-outline" size={18} color={COLORS.primarySoft} />
          <Text style={styles.messageLabel}>CarAI</Text>
        </View>
        <TypingIndicator />
      </View>
    );
  }

  return (
    <View style={[styles.messageBubble, isUser && styles.userMessageBubble]}>
      {!isUser && (
        <View style={styles.messageLabelRow}>
          <Ionicons name="sparkles-outline" size={18} color={COLORS.primarySoft} />
          <Text style={styles.messageLabel}>CarAI</Text>
        </View>
      )}
      <Text style={[styles.messageText, isUser && styles.userMessageText]}>
        {message.text}
      </Text>
      <Text style={[styles.messageTime, isUser && styles.userMessageTime]}>
        {message.createdAtLabel}
      </Text>
    </View>
  );
}

/* ════════════════════════════════════════
   TYPING INDICATOR
════════════════════════════════════════ */
function TypingIndicator() {
  return (
    <View style={styles.typingWrap}>
      <View style={[styles.typingDot, { opacity: 0.4 }]} />
      <View style={[styles.typingDot, { opacity: 0.7 }]} />
      <View style={[styles.typingDot, { opacity: 1 }]} />
    </View>
  );
}

/* ════════════════════════════════════════
   STYLES
════════════════════════════════════════ */
const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLORS.background },
  header:       { paddingHorizontal: 22,paddingTop: 14, paddingBottom: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title:        { color: COLORS.text, fontSize: 24, fontWeight: "800" },
  headerActions:{ flexDirection: "row", alignItems: "center", gap: 16 },
  headerIcon:   { width: 40, height: 40, borderRadius: 20,borderWidth: 1,borderColor: COLORS.border,backgroundColor: COLORS.surfaceLight, alignItems: "center", justifyContent: "center" },
  divider:      { height: 1, backgroundColor: COLORS.divider },
  keyboardArea: { flex: 1 },
  content:      { flex: 1, paddingHorizontal: 22, paddingTop: 20 },

  segmentWrap:        { height: 58, borderRadius: 18, backgroundColor: COLORS.surfaceDark, borderWidth: 1, borderColor: COLORS.border, flexDirection: "row", padding: 5, gap: 5, marginBottom: 20 },
  segmentButton:      { flex: 1, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  segmentButtonActive:{ backgroundColor: COLORS.primary },
  segmentText:        { color: COLORS.muted, fontSize: 15, fontWeight: "800" },
  segmentTextActive:  { color: COLORS.text },

  supportStatusRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: -4, marginBottom: 18 },
  supportStatusDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#facc15" },
  supportStatusText:{ color: COLORS.muted, fontSize: 14, lineHeight: 20 },

  messagesScroll:   { flex: 1 },
  messagesContent:  { paddingBottom: 18, gap: 12 },

  messageBubble:     { width: "86%", alignSelf: "flex-start", backgroundColor: COLORS.surface, borderRadius: 18, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 18, paddingVertical: 18 },
  userMessageBubble: { alignSelf: "flex-end", backgroundColor: COLORS.primary, borderColor: COLORS.primary, paddingVertical: 14 },
  messageLabelRow:   { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 10 },
  messageLabel:      { color: COLORS.primarySoft, fontSize: 14, fontWeight: "800" },
  messageText:       { color: COLORS.muted, fontSize: 16, lineHeight: 26 },
  userMessageText:   { color: COLORS.text },
  messageTime:       { color: COLORS.mutedDark, fontSize: 12, marginTop: 10 },
  userMessageTime:   { color: "rgba(255,255,255,0.7)" },

  typingWrap: { flexDirection: "row", gap: 6, paddingVertical: 6 },
  typingDot:  { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primarySoft },

  quickQuestionsWrap:  { paddingVertical: 12 },
  quickQuestionsTitle: { color: COLORS.text, fontSize: 15, marginBottom: 10, fontWeight: "600" },
  quickQuestionsGrid:  { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  quickQuestionButton: { width: "48%", minHeight: 54, borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", backgroundColor: COLORS.surfaceDark, justifyContent: "center", paddingHorizontal: 14, paddingVertical: 10 },
  quickQuestionText:   { color: COLORS.text, fontSize: 14, lineHeight: 20, fontWeight: "700" },

  inputRow:          { minHeight: 60, borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", backgroundColor: COLORS.input, flexDirection: "row", alignItems: "center", paddingLeft: 16, paddingRight: 8, gap: 8 },
  messageInput:      { flex: 1, maxHeight: 100, color: COLORS.text, fontSize: 16, paddingVertical: 10 },
  sendButton:        { width: 46, height: 46, borderRadius: 13, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  sendButtonDisabled:{ opacity: 0.5 },
});