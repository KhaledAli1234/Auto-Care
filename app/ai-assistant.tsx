import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";
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
  RefreshControl,
  FlatList,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomNavbar } from "@/components/bottom-navbar";
import { useUserProfile } from "@/context/user-profile-context";
import { apiGet, apiPost, authHeaders } from "@/constants/api-client";
import { BASE_URL } from "@/constants/api";

// ─── Config ───────────────────────────────────────────────────────────────────
const CHATBOT_BASE_URL = "https://superb-cellular-sequences-calendar.trycloudflare.com";

// ─── Theme ────────────────────────────────────────────────────────────────────
const COLORS = {
  background:  "#09182d",
  surface:     "#13243a",
  surfaceDark: "#102036",
  border:      "rgba(255,255,255,0.08)",
  divider:     "rgba(255,255,255,0.07)",
  text:        "#f8fafc",
  muted:       "#b8c3d6",
  mutedDark:   "#8492a8",
  primary:     "#3268f7",
  primarySoft: "#4f8cff",
  input:       "#0f1f34",
  error:       "#f87171",
  success:     "#34d399",
  warning:     "#facc15",
};

// ─── Types ────────────────────────────────────────────────────────────────────
type AssistantTab = "ai" | "support";
type ChatRole     = "assistant" | "user" | "support" | "error" | "admin";

type ChatMessage = {
  id:             string;
  role:           ChatRole;
  text:           string;
  createdAtLabel: string;
  username?:      string;
};

// Support ticket types
type SupportMessage = {
  _id:       string;
  sender:    string; // userId
  role:      "user" | "admin";
  message:   string;
  createdAt: string;
};

type SupportTicket = {
  _id:       string;
  user:     { _id: string; email: string; firstName?: string; lastName?: string };
  messages:  SupportMessage[];
  status:    "open" | "closed";
  createdAt: string;
  updatedAt: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────
const QUICK_QUESTIONS = [
  "Is my driving safe?",
  "Is fuel consumption normal?",
  "When is my next service?",
  "How to improve my score?",
];

const INITIAL_AI_MESSAGES: ChatMessage[] = [
  {
    id:             "ai-welcome",
    role:           "assistant",
    text:           "Hello! I'm your CarAI Assistant 👋 Ask me anything about your car's performance, maintenance, or driving habits.",
    createdAtLabel: getCurrentTimeLabel(),
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getCurrentTimeLabel() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function getRole(token: string): string {
  try {
    const { Buffer } = require("buffer");
    const payload = token.split(".")[1];
    const decoded = JSON.parse(Buffer.from(payload, "base64").toString("utf8"));
    return decoded.role ?? "user";
  } catch {
    return "user";
  }
}

// ─── Chatbot API ──────────────────────────────────────────────────────────────

async function fetchChatbotReply(message: string, userId: string): Promise<string> {
  const response = await fetch(`${CHATBOT_BASE_URL}/chat`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ user_id: userId, message }),
  });
  if (!response.ok) throw new Error(`Server error: ${response.status}`);
  const data = await response.json();
  if (!data.response) throw new Error("Empty response from server");
  return data.response;
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function AIAssistantScreen() {
  const insets    = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  const [activeTab,       setActiveTab]       = useState<AssistantTab>("ai");
  const [aiMessages,      setAiMessages]      = useState<ChatMessage[]>(INITIAL_AI_MESSAGES);
  const [inputText,       setInputText]       = useState("");
  const [loading,         setLoading]         = useState(false);
  const [userRole,        setUserRole]        = useState<"user" | "admin">("user");
  const [userId,          setUserId]          = useState("");

  // User support state
  const [myTicket,        setMyTicket]        = useState<SupportTicket | null>(null);
  const [ticketLoading,   setTicketLoading]   = useState(false);

  // Admin support state
  const [tickets,         setTickets]         = useState<SupportTicket[]>([]);
  const [selectedTicket,  setSelectedTicket]  = useState<SupportTicket | null>(null);
  const [adminLoading,    setAdminLoading]    = useState(false);
  const [refreshing,      setRefreshing]      = useState(false);

  // ── Init: get role & userId ──
  useEffect(() => {
    (async () => {
      const raw   = await AsyncStorage.getItem("access_token");
      const token = raw?.replace(/"/g, "") ?? "";
      const uid   = await AsyncStorage.getItem("userId").then(v => v?.replace(/"/g, "") ?? "");
      setUserId(uid);
      if (token) setUserRole(getRole(token) as "user" | "admin");
    })();
  }, []);

  // ── Fetch my ticket (user) ──

  const fetchMyTicket = useCallback(async () => {
    if (userRole !== "user") return;
    if (!userId) return;  
    setTicketLoading(true);
    try {
      const res = await apiGet("/support/my-ticket");
      if (res?.data?.ticket) setMyTicket(res.data.ticket);
    } catch {}
    finally { setTicketLoading(false); }
  }, [userRole, userId]);  

  // ── Fetch all tickets (admin) ──
  const fetchAllTickets = useCallback(async (isRefresh = false) => {
    if (userRole !== "admin") return;
    if (!userId) return;  
    isRefresh ? setRefreshing(true) : setAdminLoading(true);
    try {
      const res = await apiGet("/support/tickets");
      if (res?.data?.tickets) setTickets(res.data.tickets);
    } catch {}
    finally { setAdminLoading(false); setRefreshing(false); }
  }, [userRole, userId]);

useEffect(() => {
  if (activeTab === "support") {
    if (userRole === "user")  fetchMyTicket();
    if (userRole === "admin") fetchAllTickets();
  }
}, [activeTab, userRole]);


  // ── Reload selected ticket ──
  const reloadSelectedTicket = async (ticketId: string) => {
    try {
      const res = await apiGet(`/support/tickets/${ticketId}`);
      if (res?.data?.ticket) {
        setSelectedTicket(res.data.ticket);
        setTickets(prev => prev.map(t => t._id === ticketId ? res.data.ticket : t));
      }
    } catch {}
  };

  const scrollToBottom = () => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  };

  // ── Send AI message ──
  const handleSendAI = async (messageText = inputText) => {
    const trimmed = messageText.trim();
    if (!trimmed || loading) return;
    const userMsg: ChatMessage = {
      id: makeId("user"), role: "user", text: trimmed, createdAtLabel: getCurrentTimeLabel(),
    };
    setAiMessages(prev => [...prev, userMsg]);
    setInputText("");
    setLoading(true);
    scrollToBottom();
    try {
      const replyText = await fetchChatbotReply(trimmed, userId);
      setAiMessages(prev => [...prev, {
        id: makeId("assistant"), role: "assistant", text: replyText, createdAtLabel: getCurrentTimeLabel(),
      }]);
    } catch {
      setAiMessages(prev => [...prev, {
        id: makeId("error"), role: "error",
        text: "⚠️ Couldn't reach the server. Check your connection and try again.",
        createdAtLabel: getCurrentTimeLabel(),
      }]);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  };

  // ── User: send support message ──
  const handleSendSupport = async () => {
    const trimmed = inputText.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setInputText("");
    try {
      const res = await apiPost("/support/message", { message: trimmed });
      if (res?.data?.ticket) setMyTicket(res.data.ticket);
    } catch {}
    finally { setLoading(false); scrollToBottom(); }
  };

  // ── Admin: reply to ticket ──
  const handleAdminReply = async () => {
    if (!selectedTicket) return;
    const trimmed = inputText.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setInputText("");
    try {
      await apiPost(`/support/tickets/${selectedTicket._id}/reply`, { message: trimmed });
      await reloadSelectedTicket(selectedTicket._id);
    } catch {}
    finally { setLoading(false); scrollToBottom(); }
  };

  const handleSend = () => {
    if (activeTab === "ai") return handleSendAI();
    if (activeTab === "support" && userRole === "user") return handleSendSupport();
    if (activeTab === "support" && userRole === "admin" && selectedTicket) return handleAdminReply();
  };

  // ── Render: Admin ticket list ──
  if (activeTab === "support" && userRole === "admin" && !selectedTicket) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Support Inbox</Text>
          <Pressable style={styles.headerIcon} onPress={() => router.push("/account")} hitSlop={10}>
            <Ionicons name="person-outline" size={20} color={COLORS.text} />
          </Pressable>
        </View>
        <View style={styles.divider} />

        {adminLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={COLORS.primary} size="large" />
          </View>
        ) : (
          <FlatList
            data={tickets}
            keyExtractor={t => t._id}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => fetchAllTickets(true)} tintColor={COLORS.primary} />
            }
            contentContainerStyle={{ padding: 18, gap: 12, paddingBottom: 120 }}
            ListEmptyComponent={
              <View style={styles.centered}>
                <Ionicons name="chatbubbles-outline" size={44} color={COLORS.muted} />
                <Text style={styles.emptyText}>No support tickets yet</Text>
              </View>
            }
            renderItem={({ item }) => (
              <Pressable style={styles.ticketCard} onPress={async () => {
                setSelectedTicket(item); 
                await reloadSelectedTicket(item._id); 
              }}>
                <View style={styles.ticketCardTop}>
                  <View style={styles.ticketAvatar}>
                    <Text style={styles.ticketAvatarText}>
                      {(item.user?.firstName ?? item.user?.email ?? "U")[0].toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ticketUser}>
                      {item.user?.firstName 
                        ? `${item.user.firstName} ${item.user.lastName ?? ''}`.trim()
                        : item.user?.email ?? "User"}
                    </Text>
                    <Text style={styles.ticketPreview} numberOfLines={1}>
                      {item.messages.at(-1)?.message ?? "No messages yet"}
                    </Text>
                  </View>
                  <View style={[styles.ticketBadge, item.status === "open" && styles.ticketBadgeOpen]}>
                    <Text style={styles.ticketBadgeText}>{item.status}</Text>
                  </View>
                </View>
                <Text style={styles.ticketTime}>
                  {new Date(item.updatedAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </Text>
              </Pressable>
            )}
          />
        )}
        <BottomNavbar activeTab="ai" />
      </View>
    );
  }

  // ── Render: Admin chat with selected ticket ──
  const chatMessages: { id: string; role: ChatRole; text: string; createdAtLabel: string; username?: string }[] =
    activeTab === "support" && userRole === "admin" && selectedTicket
      ? selectedTicket.messages.map((m, index) => ({
          id:             m._id ?? `msg-${index}`,
          role:           m.role === "admin" ? "admin" : "user",
          text:           m.message,
          username: m.role === "user" 
          ? (selectedTicket.user?.firstName 
            ? `${selectedTicket.user.firstName} ${selectedTicket.user.lastName ?? ''}`.trim()
            : selectedTicket.user?.email ?? "User") 
          : undefined,
          createdAtLabel: new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        }))
      : activeTab === "support" && userRole === "user"
      ? (myTicket?.messages ?? []).map((m, index) => ({
          id:             m._id ?? `msg-${index}`,
          role:           m.role === "admin" ? "support" : "user",
          text:           m.message,
          createdAtLabel: new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        }))
      : aiMessages;

  const showInput =
    activeTab === "ai" ||
    (activeTab === "support" && userRole === "user") ||
    (activeTab === "support" && userRole === "admin" && !!selectedTicket);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        {activeTab === "support" && userRole === "admin" && selectedTicket ? (
          <Pressable onPress={() => setSelectedTicket(null)} style={styles.backBtn} hitSlop={10}>
            <Ionicons name="arrow-back-outline" size={22} color={COLORS.text} />
              <Text style={styles.backBtnText}>
                {selectedTicket.user?.firstName 
                  ? `${selectedTicket.user.firstName} ${selectedTicket.user.lastName ?? ''}`.trim()
                  : selectedTicket.user?.email ?? "User"}
              </Text>
          </Pressable>
        ) : (
          <Text style={styles.title}>AI Assistant</Text>
        )}
        <Pressable style={styles.headerIcon} onPress={() => router.push("/account")} hitSlop={10}>
          <Ionicons name="person-outline" size={20} color={COLORS.text} />
        </Pressable>
      </View>

      <View style={styles.divider} />

      <KeyboardAvoidingView
        style={styles.keyboardArea}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
      >
        <View style={styles.content}>

          {/* Tabs — hide when admin is in a ticket chat */}
          {!(activeTab === "support" && userRole === "admin" && selectedTicket) && (
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
                <Text style={[styles.segmentText, activeTab === "support" && styles.segmentTextActive]}>
                  {userRole === "admin" ? "Support Inbox" : "Customer Support"}
                </Text>
              </Pressable>
            </View>
          )}

          {/* Support status bar (user only) */}
          {activeTab === "support" && userRole === "user" && (
            <View style={styles.supportStatusRow}>
              <View style={styles.supportStatusDot} />
              <Text style={styles.supportStatusText}>Support Team • Usually replies within a few hours</Text>
            </View>
          )}

          {/* Loading state for support */}
          {activeTab === "support" && (ticketLoading || adminLoading) ? (
            <View style={styles.centered}>
              <ActivityIndicator color={COLORS.primary} />
            </View>
          ) : (
            /* Messages */
            <ScrollView
              ref={scrollRef}
              style={styles.messagesScroll}
              contentContainerStyle={styles.messagesContent}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={scrollToBottom}
            >
              {chatMessages.length === 0 && activeTab === "support" && userRole === "user" && (
                <View style={styles.emptySupport}>
                  <Ionicons name="chatbubble-ellipses-outline" size={40} color={COLORS.muted} />
                  <Text style={styles.emptySupportTitle}>Start a conversation</Text>
                  <Text style={styles.emptySupportText}>Send a message and our support team will get back to you.</Text>
                </View>
              )}

              {chatMessages.map(msg => (
                <ChatBubble 
                  key={msg.id} 
                  message={msg} 
                  isAdminView={userRole === "admin" && activeTab === "support"}
                />
              ))}

              {loading && (
                <View style={styles.typingIndicator}>
                  <ActivityIndicator size="small" color={COLORS.primarySoft} />
                  <Text style={styles.typingText}>
                    {activeTab === "ai" ? "Thinking..." : "Sending..."}
                  </Text>
                </View>
              )}
            </ScrollView>
          )}

          {/* Quick Questions (AI tab only) */}
          {activeTab === "ai" && (
            <View style={styles.quickQuestionsWrap}>
              <Text style={styles.quickQuestionsTitle}>Quick questions:</Text>
              <View style={styles.quickQuestionsGrid}>
                {QUICK_QUESTIONS.map(q => (
                  <Pressable
                    key={q}
                    style={styles.quickQuestionButton}
                    onPress={() => handleSendAI(q)}
                    disabled={loading}
                  >
                    <Text style={styles.quickQuestionText}>{q}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* Input */}
          {showInput && (
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
                onSubmitEditing={handleSend}
                editable={!loading}
              />
              <Pressable
                style={[styles.sendButton, (!inputText.trim() || loading) && styles.sendButtonDisabled]}
                onPress={handleSend}
                disabled={!inputText.trim() || loading}
              >
                {loading
                  ? <ActivityIndicator size="small" color={COLORS.muted} />
                  : <Ionicons name="paper-plane-outline" size={22} color={COLORS.text} />
                }
              </Pressable>
            </View>
          )}

        </View>
      </KeyboardAvoidingView>

      <BottomNavbar activeTab="ai" />
    </View>
  );
}

// ─── Chat Bubble ──────────────────────────────────────────────────────────────
function ChatBubble({ message, isAdminView }: { 
  message: { id: string; role: ChatRole; text: string; createdAtLabel: string; username?: string }; 
  isAdminView?: boolean 
}) {
  const isUser    = message.role === "user";
  const isError   = message.role === "error";
  const isSupport = message.role === "support";
  const isAdmin   = message.role === "admin";
  // In admin view, admin messages are "ours" (right side)
  const isRight = isAdminView ? isAdmin : isUser;
  const label = isRight
    ? (isAdminView ? "You (Admin)" : "You")
    : isSupport || isAdmin
    ? "Support Team"
    : isError
    ? "System"
    : message.username ?? "AI Assistant";;

  const iconName: keyof typeof Ionicons.glyphMap =
    isRight     ? "person-outline"    :
    isSupport || isAdmin ? "headset-outline" :
    isError     ? "warning-outline"   :
                  "sparkles-outline";

  return (
    <View style={[
      styles.messageBubble,
      isRight && styles.userMessageBubble,
      isError && styles.errorMessageBubble,
    ]}>
      {!isRight && (
        <View style={styles.messageLabelRow}>
          <Ionicons name={iconName} size={18} color={isError ? COLORS.error : COLORS.primarySoft} />
          <Text style={[styles.messageLabel, isError && styles.errorLabel]}>{label}</Text>
        </View>
      )}
      <Text style={[styles.messageText, isRight && styles.userMessageText]}>{message.text}</Text>
      <Text style={[styles.messageTime, isRight && styles.userMessageTime]}>{message.createdAtLabel}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:           { flex: 1, backgroundColor: COLORS.background },
  header:              { paddingHorizontal: 22,paddingTop: 14, paddingBottom: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title:               { color: COLORS.text, fontSize: 24, fontWeight: "800" },
  headerActions:       { flexDirection: "row", alignItems: "center", gap: 16 },
  headerIcon:          { width: 40, height: 40, borderRadius: 20,borderWidth: 1, borderColor: COLORS.border,backgroundColor: COLORS.surfaceDark,alignItems: 'center', justifyContent: 'center' },
  divider:             { height: 1, backgroundColor: COLORS.divider },
  keyboardArea:        { flex: 1 },
  content:             { flex: 1, paddingHorizontal: 22, paddingTop: 20 },
  centered:            { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingTop: 60 },
  backBtn:             { flexDirection: "row", alignItems: "center", gap: 8 },
  backBtnText:         { color: COLORS.text, fontSize: 18, fontWeight: "700" },

  segmentWrap:         { height: 56, borderRadius: 18, backgroundColor: COLORS.surfaceDark, borderWidth: 1, borderColor: COLORS.border, flexDirection: "row", padding: 5, gap: 5, marginBottom: 18 },
  segmentButton:       { flex: 1, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  segmentButtonActive: { backgroundColor: COLORS.primary },
  segmentText:         { color: COLORS.muted, fontSize: 15, fontWeight: "700" },
  segmentTextActive:   { color: COLORS.text },

  supportStatusRow:    { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  supportStatusDot:    { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.warning },
  supportStatusText:   { color: COLORS.muted, fontSize: 14 },

  messagesScroll:      { flex: 1 },
  messagesContent:     { paddingBottom: 18, gap: 12 },
  typingIndicator:     { flexDirection: "row", alignItems: "center", gap: 10, paddingLeft: 4, paddingTop: 4 },
  typingText:          { color: COLORS.mutedDark, fontSize: 15 },

  emptySupport:        { alignItems: "center", paddingTop: 60, gap: 12 },
  emptySupportTitle:   { color: COLORS.text, fontSize: 18, fontWeight: "700" },
  emptySupportText:    { color: COLORS.muted, fontSize: 15, textAlign: "center", lineHeight: 22 },
  emptyText:           { color: COLORS.muted, fontSize: 16, marginTop: 8 },

  // Ticket list
  ticketCard:          { backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, padding: 16, gap: 8 },
  ticketCardTop:       { flexDirection: "row", alignItems: "center", gap: 12 },
  ticketAvatar:        { width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  ticketAvatarText:    { color: COLORS.text, fontSize: 18, fontWeight: "800" },
  ticketUser:          { color: COLORS.text, fontSize: 15, fontWeight: "700" },
  ticketPreview:       { color: COLORS.muted, fontSize: 14, marginTop: 2 },
  ticketBadge:         { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: COLORS.surfaceDark },
  ticketBadgeOpen:     { backgroundColor: "rgba(52,211,153,0.15)" },
  ticketBadgeText:     { color: COLORS.success, fontSize: 12, fontWeight: "700" },
  ticketTime:          { color: COLORS.mutedDark, fontSize: 12 },

  // Messages
  messageBubble:       { width: "86%", alignSelf: "flex-start", backgroundColor: COLORS.surface, borderRadius: 18, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 18, paddingVertical: 16 },
  userMessageBubble:   { alignSelf: "flex-end", backgroundColor: COLORS.primary, borderColor: COLORS.primary, paddingVertical: 14 },
  errorMessageBubble:  { borderColor: "rgba(248,113,113,0.3)", backgroundColor: "rgba(248,113,113,0.08)" },
  messageLabelRow:     { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  messageLabel:        { color: COLORS.primarySoft, fontSize: 14, fontWeight: "700" },
  errorLabel:          { color: COLORS.error },
  messageText:         { color: COLORS.muted, fontSize: 16, lineHeight: 26 },
  userMessageText:     { color: COLORS.text },
  messageTime:         { color: COLORS.mutedDark, fontSize: 13, marginTop: 10 },
  userMessageTime:     { color: "rgba(255,255,255,0.7)" },

  // Quick questions
  quickQuestionsWrap:  { paddingTop: 8, paddingBottom: 12 },
  quickQuestionsTitle: { color: COLORS.text, fontSize: 16, marginBottom: 10 },
  quickQuestionsGrid:  { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  quickQuestionButton: { width: "48%", minHeight: 52, borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.16)", backgroundColor: COLORS.surfaceDark, justifyContent: "center", paddingHorizontal: 14, paddingVertical: 10 },
  quickQuestionText:   { color: COLORS.text, fontSize: 14, lineHeight: 20, fontWeight: "700" },

  // Input
  inputRow:            { minHeight: 58, borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", backgroundColor: COLORS.input, flexDirection: "row", alignItems: "center", paddingLeft: 18, paddingRight: 8, gap: 8 },
  messageInput:        { flex: 1, maxHeight: 100, color: COLORS.text, fontSize: 17, paddingVertical: 12 },
  sendButton:          { width: 46, height: 46, borderRadius: 13, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  sendButtonDisabled:  { opacity: 0.4 },
});