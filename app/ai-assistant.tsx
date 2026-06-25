import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSocket, useSocket } from "@/hooks/useSocket";
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
import { LinearGradient } from "expo-linear-gradient";
import { BottomNavbar } from "@/components/bottom-navbar";
import { apiGet, apiPost } from "@/constants/api-client";
import { AppColors, useAppTheme, useThemeColors } from "@/context/theme-context";

const CHATBOT_BASE_URL = process.env.EXPO_PUBLIC_CHATBOT_BASE_URL!;

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

type SupportMessage = {
  _id:       string;
  sender:    string;
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
async function fetchChatbotReply(
  message: string,
  userId: string,
  history: { role: string; content: string }[]
): Promise<string> {
  const response = await fetch(`${CHATBOT_BASE_URL}/chat`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ user_id: userId, message, history }),
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
  const COLORS    = useThemeColors();
  const styles    = useMemo(() => createStyles(COLORS), [COLORS]);
  const { isDark } = useAppTheme();

  const [activeTab,       setActiveTab]       = useState<AssistantTab>("ai");
  const [aiMessages,      setAiMessages]      = useState<ChatMessage[]>(INITIAL_AI_MESSAGES);
  const [inputText,       setInputText]       = useState("");
  const [loading,         setLoading]         = useState(false);
  const [userRole,        setUserRole]        = useState<"user" | "admin">("user");
  const [userId,          setUserId]          = useState("");
  const [messagesLoaded,  setMessagesLoaded]  = useState(false);

  const [myTicket,        setMyTicket]        = useState<SupportTicket | null>(null);
  const [ticketLoading,   setTicketLoading]   = useState(false);

  const [tickets,         setTickets]         = useState<SupportTicket[]>([]);
  const [selectedTicket,  setSelectedTicket]  = useState<SupportTicket | null>(null);
  const [adminLoading,    setAdminLoading]    = useState(false);
  const [refreshing,      setRefreshing]      = useState(false);

  // ── Init ──
  useEffect(() => {
    (async () => {
      const raw   = await AsyncStorage.getItem("access_token");
      const token = raw?.replace(/"/g, "") ?? "";
      const uid   = await AsyncStorage.getItem("userId").then(v => v?.replace(/"/g, "") ?? "");
      setUserId(uid);
      if (token) setUserRole(getRole(token) as "user" | "admin");

      if (uid) {
        try {
          const storedMsgs = await AsyncStorage.getItem(`chatbot_messages_${uid}`);
          if (storedMsgs) {
            const parsed = JSON.parse(storedMsgs);
            if (Array.isArray(parsed) && parsed.length > 0) setAiMessages(parsed);
          }
        } catch (e) { console.error("Failed to load stored messages", e); }
      }
      setMessagesLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!userId || !messagesLoaded) return;
    (async () => {
      const msgsToSave = aiMessages.filter(m => m.role !== "error");
      await AsyncStorage.setItem(`chatbot_messages_${userId}`, JSON.stringify(msgsToSave.slice(-20)));
    })();
  }, [aiMessages, userId, messagesLoaded]);

  useSocket(userId || undefined, () => {});
  const [socket, setSocket] = useState<any>(null);

  useEffect(() => {
    if (!userId) return;
    const interval = setInterval(() => {
      const s = getSocket();
      if (s && s.connected) { setSocket(s); clearInterval(interval); }
    }, 500);
    return () => clearInterval(interval);
  }, [userId]);

  useEffect(() => {
    if (!socket || !userId) return;
    const conversationId = userRole === "admin" ? selectedTicket?._id : myTicket?._id;
    if (!conversationId) return;
    socket.emit("support:join", { conversationId });

    const handleSupportMessage = (data: any) => {
      const msg = data.message || data;
      const targetConvId = data.conversationId || conversationId;
      if (userRole === "user") {
        setMyTicket(prev => {
          if (!prev || prev._id !== targetConvId) return prev;
          if (prev.messages.some(m => m._id === msg._id || (m.createdAt === msg.createdAt && m.message === msg.message))) return prev;
          return { ...prev, messages: [...prev.messages, msg] };
        });
      } else if (userRole === "admin") {
        setTickets(prev => prev.map(t => {
          if (t._id !== targetConvId) return t;
          if (t.messages.some(m => m._id === msg._id || (m.createdAt === msg.createdAt && m.message === msg.message))) return t;
          return { ...t, messages: [...t.messages, msg] };
        }));
        setSelectedTicket(prev => {
          if (!prev || prev._id !== targetConvId) return prev;
          if (prev.messages.some(m => m._id === msg._id || (m.createdAt === msg.createdAt && m.message === msg.message))) return prev;
          return { ...prev, messages: [...prev.messages, msg] };
        });
      }
      scrollToBottom();
    };

    socket.on("support:message", handleSupportMessage);
    return () => { socket.off("support:message", handleSupportMessage); };
  }, [socket, userId, userRole, selectedTicket?._id, myTicket?._id]);

  const fetchMyTicket = useCallback(async () => {
    if (userRole !== "user" || !userId) return;
    setTicketLoading(true);
    try {
      const res = await apiGet("/support/my-ticket");
      if (res?.data?.ticket) setMyTicket(res.data.ticket);
    } catch {}
    finally { setTicketLoading(false); }
  }, [userRole, userId]);

  const fetchAllTickets = useCallback(async (isRefresh = false) => {
    if (userRole !== "admin" || !userId) return;
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

    const uid = await AsyncStorage.getItem("userId").then(v => v?.replace(/"/g, "") ?? "");
    if (!uid) {
      setAiMessages(prev => [...prev, { id: makeId("error"), role: "error", text: "⚠️ Please log in first.", createdAtLabel: getCurrentTimeLabel() }]);
      return;
    }

    const userMsg: ChatMessage = { id: makeId("user"), role: "user", text: trimmed, createdAtLabel: getCurrentTimeLabel() };
    setAiMessages(prev => [...prev, userMsg]);
    setInputText("");
    setLoading(true);
    scrollToBottom();

    try {
      const currentMessages = [...aiMessages, userMsg];
      const history = currentMessages
        .filter(m => m.role === "user" || m.role === "assistant")
        .slice(-10)
        .map(m => ({ role: m.role === "user" ? "user" : "assistant", content: m.text }));

      const replyText = await fetchChatbotReply(trimmed, uid, history);
      setAiMessages(prev => [...prev, { id: makeId("assistant"), role: "assistant", text: replyText, createdAtLabel: getCurrentTimeLabel() }]);
    } catch {
      setAiMessages(prev => [...prev, { id: makeId("error"), role: "error", text: "⚠️ Couldn't reach the server. Check your connection and try again.", createdAtLabel: getCurrentTimeLabel() }]);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  };

  const handleSendSupport = async () => {
    const trimmed = inputText.trim();
    if (!trimmed || loading) return;
    setLoading(true); setInputText("");
    try {
      const res = await apiPost("/support/message", { message: trimmed });
      if (res?.data?.ticket) setMyTicket(res.data.ticket);
    } catch {}
    finally { setLoading(false); scrollToBottom(); }
  };

  const handleAdminReply = async () => {
    if (!selectedTicket) return;
    const trimmed = inputText.trim();
    if (!trimmed || loading) return;
    setLoading(true); setInputText("");
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

  // ── Admin inbox view ──
  if (activeTab === "support" && userRole === "admin" && !selectedTicket) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {isDark && (
          <LinearGradient
            colors={['#0f2040', '#0d1a35', '#0a1225', '#080A0F']}
            locations={[0, 0.25, 0.55, 1]}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
        )}
        <View style={styles.header}>
          <Pressable onPress={() => setActiveTab("ai")} style={styles.backBtn} hitSlop={10}>
            <Ionicons name="arrow-back-outline" size={22} color={COLORS.text} />
          </Pressable>
          <Text style={styles.headerTitle}>AI-Assistant</Text>
          <Pressable style={styles.headerIcon} onPress={() => router.push("/account")} hitSlop={10}>
            <Ionicons name="person-outline" size={20} color={COLORS.text} />
          </Pressable>
        </View>
        <View style={styles.divider} />
        <View style={styles.inboxLabel}>
          <Ionicons name="headset-outline" size={18} color={COLORS.primary} />
          <Text style={styles.inboxLabelText}>Support Inbox</Text>
        </View>

        {adminLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={COLORS.primary} size="large" />
          </View>
        ) : (
          <FlatList
            data={tickets}
            keyExtractor={t => t._id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchAllTickets(true)} tintColor={COLORS.primary} />}
            contentContainerStyle={{ padding: 18, gap: 12, paddingBottom: 120 }}
            ListEmptyComponent={
              <View style={styles.centered}>
                <Ionicons name="chatbubbles-outline" size={44} color={COLORS.mutedDark} />
                <Text style={styles.emptyText}>No support tickets yet</Text>
              </View>
            }
            renderItem={({ item }) => (
              <Pressable style={styles.ticketCard} onPress={async () => { setSelectedTicket(item); await reloadSelectedTicket(item._id); }}>
                <View style={styles.ticketCardTop}>
                  <View style={styles.ticketAvatar}>
                    <Text style={styles.ticketAvatarText}>{(item.user?.firstName ?? item.user?.email ?? "U")[0].toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ticketUser}>{item.user?.firstName ? `${item.user.firstName} ${item.user.lastName ?? ''}`.trim() : item.user?.email ?? "User"}</Text>
                    <Text style={styles.ticketPreview} numberOfLines={1}>{item.messages.at(-1)?.message ?? "No messages yet"}</Text>
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

  const chatMessages = activeTab === "support" && userRole === "admin" && selectedTicket
    ? selectedTicket.messages.map((m, i) => ({
        id: m._id ?? `msg-${i}`, role: m.role === "admin" ? "admin" : "user" as ChatRole,
        text: m.message,
        username: m.role === "user" ? (selectedTicket.user?.firstName ? `${selectedTicket.user.firstName} ${selectedTicket.user.lastName ?? ''}`.trim() : selectedTicket.user?.email ?? "User") : undefined,
        createdAtLabel: new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      }))
    : activeTab === "support" && userRole === "user"
    ? (myTicket?.messages ?? []).map((m, i) => ({
        id: m._id ?? `msg-${i}`, role: m.role === "admin" ? "support" : "user" as ChatRole,
        text: m.message,
        createdAtLabel: new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      }))
    : aiMessages;

  const showInput =
    activeTab === "ai" ||
    (activeTab === "support" && userRole === "user") ||
    (activeTab === "support" && userRole === "admin" && !!selectedTicket);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {isDark && (
        <LinearGradient
          colors={['#0f2040', '#0d1a35', '#0a1225', '#080A0F']}
          locations={[0, 0.25, 0.55, 1]}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
      )}

      <View style={styles.header}>
        {activeTab === "support" && userRole === "admin" && selectedTicket ? (
          <Pressable onPress={() => setSelectedTicket(null)} style={styles.backBtn} hitSlop={10}>
            <Ionicons name="arrow-back-outline" size={22} color={COLORS.text} />
            <Text style={styles.backBtnText}>
              {selectedTicket.user?.firstName ? `${selectedTicket.user.firstName} ${selectedTicket.user.lastName ?? ''}`.trim() : selectedTicket.user?.email ?? "User"}
            </Text>
          </Pressable>
        ) : (
          <Text style={styles.headerTitle}>AI-Assistant</Text>
        )}
        <Pressable style={styles.headerIcon} onPress={() => router.push("/account")} hitSlop={10}>
          <Ionicons name="person-outline" size={20} color={COLORS.text} />
        </Pressable>
      </View>

      <View style={styles.divider} />

      <KeyboardAvoidingView style={styles.keyboardArea} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}>
        <View style={styles.content}>

          {!(activeTab === "support" && userRole === "admin" && selectedTicket) && (
            <View style={styles.segmentWrap}>
              <Pressable style={[styles.segmentButton, activeTab === "ai" && styles.segmentButtonActive]} onPress={() => setActiveTab("ai")}>
                <Ionicons name="sparkles-outline" size={18} color={activeTab === "ai" ? COLORS.text : COLORS.muted} />
                <Text style={[styles.segmentText, activeTab === "ai" && styles.segmentTextActive]}>AI Assistant</Text>
              </Pressable>
              <Pressable style={[styles.segmentButton, activeTab === "support" && styles.segmentButtonActive]} onPress={() => setActiveTab("support")}>
                <Ionicons name="headset-outline" size={18} color={activeTab === "support" ? COLORS.text : COLORS.muted} />
                <Text style={[styles.segmentText, activeTab === "support" && styles.segmentTextActive]}>
                  {userRole === "admin" ? "Support Inbox" : "Customer Support"}
                </Text>
              </Pressable>
            </View>
          )}

          {activeTab === "support" && userRole === "user" && (
            <View style={styles.supportStatusRow}>
              <View style={styles.supportStatusDot} />
              <Text style={styles.supportStatusText}>Support Team • Usually replies within a few hours</Text>
            </View>
          )}

          {activeTab === "support" && (ticketLoading || adminLoading) ? (
            <View style={styles.centered}><ActivityIndicator color={COLORS.primary} /></View>
          ) : (
            <ScrollView ref={scrollRef} style={styles.messagesScroll} contentContainerStyle={styles.messagesContent} showsVerticalScrollIndicator={false} onContentSizeChange={scrollToBottom}>
              {chatMessages.length === 0 && activeTab === "support" && userRole === "user" && (
                <View style={styles.emptySupport}>
                  <Ionicons name="chatbubble-ellipses-outline" size={40} color={COLORS.mutedDark} />
                  <Text style={styles.emptySupportTitle}>Start a conversation</Text>
                  <Text style={styles.emptySupportText}>Send a message and our support team will get back to you.</Text>
                </View>
              )}

              {chatMessages.map(msg => (
                <ChatBubble key={msg.id} message={msg} isAdminView={userRole === "admin" && activeTab === "support"} />
              ))}

              {loading && (
                <View style={styles.typingIndicator}>
                  <ActivityIndicator size="small" color={COLORS.primary} />
                  <Text style={styles.typingText}>{activeTab === "ai" ? "Thinking..." : "Sending..."}</Text>
                </View>
              )}
            </ScrollView>
          )}

          {activeTab === "ai" && (
            <View style={styles.quickQuestionsWrap}>
              <Text style={styles.quickQuestionsTitle}>Quick questions:</Text>
              <View style={styles.quickQuestionsGrid}>
                {QUICK_QUESTIONS.map(q => (
                  <Pressable key={q} style={styles.quickQuestionButton} onPress={() => handleSendAI(q)} disabled={loading}>
                    <Text style={styles.quickQuestionText}>{q}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

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
              <Pressable style={[styles.sendButton, (!inputText.trim() || loading) && styles.sendButtonDisabled]} onPress={handleSend} disabled={!inputText.trim() || loading}>
                {loading ? <ActivityIndicator size="small" color={COLORS.muted} /> : <Ionicons name="paper-plane-outline" size={22} color={COLORS.text} />}
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
  isAdminView?: boolean;
}) {
  const COLORS = useThemeColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const isUser    = message.role === "user";
  const isError   = message.role === "error";
  const isSupport = message.role === "support";
  const isAdmin   = message.role === "admin";
  const isRight   = isAdminView ? isAdmin : isUser;

  const label = isRight
    ? (isAdminView ? "You (Admin)" : "You")
    : isSupport || isAdmin ? "Support Team"
    : isError ? "System"
    : message.username ?? "AI Assistant";

  const iconName: keyof typeof Ionicons.glyphMap =
    isRight              ? "person-outline"  :
    isSupport || isAdmin ? "headset-outline" :
    isError              ? "warning-outline" :
                           "sparkles-outline";

  return (
    <View style={[styles.messageBubble, isRight && styles.userMessageBubble, isError && styles.errorMessageBubble]}>
      {!isRight && (
        <View style={styles.messageLabelRow}>
          <Ionicons name={iconName} size={16} color={isError ? COLORS.danger : COLORS.primary} />
          <Text style={[styles.messageLabel, isError && styles.errorLabel]}>{label}</Text>
        </View>
      )}
      <Text style={[styles.messageText, isRight && styles.userMessageText]}>{message.text}</Text>
      <Text style={[styles.messageTime, isRight && styles.userMessageTime]}>{message.createdAtLabel}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const createStyles = (COLORS: AppColors) => {
  const isDark = COLORS.background === '#080A0F' || COLORS.background?.startsWith('#0');

  // Same dark-mode block colors used in the other pages. Light mode stays unchanged.
  const blockBg          = isDark ? 'rgba(7,16,32,0.90)'    : COLORS.surface;
  const chipBg           = isDark ? 'rgba(10,24,48,0.92)'   : COLORS.surfaceLight;
  const blockBorder      = isDark ? 'rgba(96,165,250,0.18)' : 'rgba(96,165,250,0.12)';
  const headerIconBg     = isDark ? 'rgba(10,24,48,0.92)'   : COLORS.surfaceLight;
  const headerIconBorder = isDark ? 'rgba(96,165,250,0.18)' : 'rgba(96,165,250,0.25)';
  const dividerBg        = isDark ? 'rgba(96,165,250,0.15)' : COLORS.divider;

  return StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLORS.background },

  // Header — sign-in style
  header:       { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerTitle:  { fontSize: 24, fontWeight: '800', color: COLORS.text },
  headerAccent: { color: COLORS.primary },
  headerIcon:   { width: 40, height: 40, borderRadius: 20, borderWidth: 1, backgroundColor: headerIconBg, borderColor: headerIconBorder, alignItems: "center", justifyContent: "center" },
  divider:      { height: 1, backgroundColor: dividerBg },

  inboxLabel:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 14 },
  inboxLabelText: { color: COLORS.text, fontSize: 20, fontWeight: '800' },

  keyboardArea:   { flex: 1 },
  content:        { flex: 1, paddingHorizontal: 20, paddingTop: 18 },
  centered:       { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingTop: 60 },
  backBtn:        { flexDirection: "row", alignItems: "center", gap: 8 },
  backBtnText:    { color: COLORS.text, fontSize: 17, fontWeight: "700" },

  // Segment — matches sign-in input style
  segmentWrap:         { height: 54, borderRadius: 16, backgroundColor: chipBg, borderWidth: 1, borderColor: blockBorder, flexDirection: "row", padding: 4, gap: 4, marginBottom: 16 },
  segmentButton:       { flex: 1, borderRadius: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  segmentButtonActive: { backgroundColor: COLORS.primary },
  segmentText:         { color: COLORS.muted, fontSize: 14, fontWeight: "700" },
  segmentTextActive:   { color: COLORS.text },

  supportStatusRow:  { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  supportStatusDot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.yellow },
  supportStatusText: { color: COLORS.muted, fontSize: 13 },

  messagesScroll:   { flex: 1 },
  messagesContent:  { paddingBottom: 18, gap: 12 },
  typingIndicator:  { flexDirection: "row", alignItems: "center", gap: 10, paddingLeft: 4, paddingTop: 4 },
  typingText:       { color: COLORS.mutedDark, fontSize: 14 },

  emptySupport:      { alignItems: "center", paddingTop: 60, gap: 12 },
  emptySupportTitle: { color: COLORS.text, fontSize: 17, fontWeight: "700" },
  emptySupportText:  { color: COLORS.muted, fontSize: 14, textAlign: "center", lineHeight: 22 },
  emptyText:         { color: COLORS.muted, fontSize: 15, marginTop: 8 },

  // Ticket cards — same surface as sign-in
  ticketCard:      { backgroundColor: blockBg, borderRadius: 14, borderWidth: 1, borderColor: blockBorder, padding: 14, gap: 8 },
  ticketCardTop:   { flexDirection: "row", alignItems: "center", gap: 12 },
  ticketAvatar:    { width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.primary, borderWidth: 1, borderColor: blockBorder, alignItems: "center", justifyContent: "center" },
  ticketAvatarText:{ color: COLORS.text, fontSize: 16, fontWeight: "800" },
  ticketUser:      { color: COLORS.text, fontSize: 14, fontWeight: "700" },
  ticketPreview:   { color: COLORS.muted, fontSize: 13, marginTop: 2 },
  ticketBadge:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: chipBg, borderWidth: 1, borderColor: blockBorder },
  ticketBadgeOpen: { backgroundColor: "rgba(5,150,105,0.12)", borderColor: "rgba(5,150,105,0.3)" },
  ticketBadgeText: { color: COLORS.green, fontSize: 12, fontWeight: "700" },
  ticketTime:      { color: COLORS.mutedDark, fontSize: 11 },

  // Chat bubbles
  messageBubble:      { width: "86%", alignSelf: "flex-start", backgroundColor: blockBg, borderRadius: 16, borderWidth: 1, borderColor: blockBorder, paddingHorizontal: 16, paddingVertical: 14 },
  userMessageBubble:  { alignSelf: "flex-end", backgroundColor: COLORS.primary, borderColor: COLORS.primary, paddingVertical: 12 },
  errorMessageBubble: { borderColor: `${COLORS.danger}4D`, backgroundColor: `${COLORS.danger}14` },
  messageLabelRow:    { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 8 },
  messageLabel:       { color: COLORS.primary, fontSize: 13, fontWeight: "700" },
  errorLabel:         { color: COLORS.danger },
  messageText:        { color: COLORS.muted, fontSize: 15, lineHeight: 24 },
  userMessageText:    { color: COLORS.text },
  messageTime:        { color: COLORS.mutedDark, fontSize: 12, marginTop: 8 },
  userMessageTime:    { color: "rgba(255,255,255,0.75)" },

  // Quick questions — sign-in input style
  quickQuestionsWrap:  { paddingTop: 6, paddingBottom: 10 },
  quickQuestionsTitle: { color: COLORS.muted, fontSize: 13, fontWeight: '600', marginBottom: 10 },
  quickQuestionsGrid:  { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  quickQuestionButton: { width: "48%", minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: blockBorder, backgroundColor: chipBg, justifyContent: "center", paddingHorizontal: 12, paddingVertical: 10 },
  quickQuestionText:   { color: COLORS.text, fontSize: 13, lineHeight: 18, fontWeight: "600" },

  // Input — exactly like sign-in TextInput
  inputRow:           { minHeight: 54, borderRadius: 14, borderWidth: 1, borderColor: blockBorder, backgroundColor: chipBg, flexDirection: "row", alignItems: "center", paddingLeft: 16, paddingRight: 8, gap: 8 },
  messageInput:       { flex: 1, maxHeight: 100, color: COLORS.text, fontSize: 15, paddingVertical: 10 },
  sendButton:         { width: 42, height: 42, borderRadius: 12, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  sendButtonDisabled: { opacity: 0.4 },
  });
};
