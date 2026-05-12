import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useRef, useState } from "react";
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
import { BottomNavbar } from "@/components/bottom-navbar";
import { useUserProfile } from "@/context/user-profile-context";

// ─── Config ───────────────────────────────────────────────────────────────────
const CHATBOT_BASE_URL = "https://hundreds-keen-veterinary-benjamin.trycloudflare.com";

const USER_ID = "user_123";

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
};

// ─── Types ────────────────────────────────────────────────────────────────────
type AssistantTab = "ai" | "support";
type ChatRole     = "assistant" | "user" | "support" | "error";

type ChatMessage = {
  id:              string;
  role:            ChatRole;
  text:            string;
  createdAtLabel:  string;
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

const SUPPORT_REPLY_NOTE = "Support Team • Usually replies within a few hours";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getCurrentTimeLabel() {
  return new Date().toLocaleTimeString([], {
    hour:   "2-digit",
    minute: "2-digit",
  });
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ─── Chatbot API call ─────────────────────────────────────────────────────────
async function fetchChatbotReply(message: string): Promise<string> {
  const response = await fetch(`${CHATBOT_BASE_URL}/chat`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ user_id: USER_ID, message }),
  });

  if (!response.ok) {
    throw new Error(`Server error: ${response.status}`);
  }

  const data = await response.json();

  if (!data.response) {
    throw new Error("Empty response from server");
  }

  return data.response;
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function AIAssistantScreen() {
  const insets    = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const { profile } = useUserProfile();

  const [activeTab,       setActiveTab]       = useState<AssistantTab>("ai");
  const [aiMessages,      setAiMessages]      = useState<ChatMessage[]>(INITIAL_AI_MESSAGES);
  const [supportMessages, setSupportMessages] = useState<ChatMessage[]>([]);
  const [inputText,       setInputText]       = useState("");
  const [loading,         setLoading]         = useState(false);

  const messages = activeTab === "ai" ? aiMessages : supportMessages;

  const setMessages = useCallback(
    (updater: (prev: ChatMessage[]) => ChatMessage[]) => {
      if (activeTab === "ai") {
        setAiMessages(updater);
      } else {
        setSupportMessages(updater);
      }
    },
    [activeTab],
  );

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  };

  const handleSendMessage = async (messageText = inputText) => {
    const trimmed = messageText.trim();
    if (!trimmed || loading) return;

    // 1. أضف رسالة اليوزر فوراً
    const userMsg: ChatMessage = {
      id:             makeId("user"),
      role:           "user",
      text:           trimmed,
      createdAtLabel: getCurrentTimeLabel(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setLoading(true);
    scrollToBottom();

    // 2. اتصل بالـ chatbot (AI tab فقط) أو اعمل reply وهمي للـ support
    try {
      let replyText: string;

      if (activeTab === "ai") {
        replyText = await fetchChatbotReply(trimmed);
      } else {
        // Support tab — مفيش backend حالياً، رد placeholder
        await new Promise((r) => setTimeout(r, 800));
        replyText =
          "Thanks for reaching out! Our support team will get back to you shortly. 🙏";
      }

      const botMsg: ChatMessage = {
        id:             makeId("assistant"),
        role:           activeTab === "ai" ? "assistant" : "support",
        text:           replyText,
        createdAtLabel: getCurrentTimeLabel(),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      const errorMsg: ChatMessage = {
        id:             makeId("error"),
        role:           "error",
        text:           "⚠️ Couldn't reach the server. Check your connection and try again.",
        createdAtLabel: getCurrentTimeLabel(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  };

  const handleQuickQuestion = (question: string) => {
    if (activeTab !== "ai") setActiveTab("ai");
    handleSendMessage(question);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>AI Assistant</Text>
        <View style={styles.headerActions}>
          <Pressable style={styles.headerIcon} hitSlop={10}>
            <Ionicons name="notifications-outline" size={25} color={COLORS.text} />
          </Pressable>
          <Pressable
            style={styles.headerIcon}
            hitSlop={10}
            onPress={() => router.push("/account")}
          >
            <Ionicons name="person-outline" size={25} color={COLORS.text} />
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

          {/* Segment Tabs */}
          <View style={styles.segmentWrap}>
            <Pressable
              style={[styles.segmentButton, activeTab === "ai" && styles.segmentButtonActive]}
              onPress={() => setActiveTab("ai")}
            >
              <Ionicons
                name="sparkles-outline"
                size={22}
                color={activeTab === "ai" ? COLORS.text : COLORS.muted}
              />
              <Text style={[styles.segmentText, activeTab === "ai" && styles.segmentTextActive]}>
                AI Assistant
              </Text>
            </Pressable>

            <Pressable
              style={[styles.segmentButton, activeTab === "support" && styles.segmentButtonActive]}
              onPress={() => setActiveTab("support")}
            >
              <Ionicons
                name="headset-outline"
                size={22}
                color={activeTab === "support" ? COLORS.text : COLORS.muted}
              />
              <Text style={[styles.segmentText, activeTab === "support" && styles.segmentTextActive]}>
                Customer Support
              </Text>
            </Pressable>
          </View>

          {/* Support status */}
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
            {messages.map((msg) => (
              <ChatBubble key={msg.id} message={msg} />
            ))}

            {loading && (
              <View style={styles.typingIndicator}>
                <ActivityIndicator size="small" color={COLORS.primarySoft} />
                <Text style={styles.typingText}>Thinking...</Text>
              </View>
            )}
          </ScrollView>

          {/* Quick Questions */}
          {activeTab === "ai" && (
            <View style={styles.quickQuestionsWrap}>
              <Text style={styles.quickQuestionsTitle}>Quick questions:</Text>
              <View style={styles.quickQuestionsGrid}>
                {QUICK_QUESTIONS.map((q) => (
                  <Pressable
                    key={q}
                    style={styles.quickQuestionButton}
                    onPress={() => handleQuickQuestion(q)}
                    disabled={loading}
                  >
                    <Text style={styles.quickQuestionText}>{q}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* Input Row */}
          <View style={[styles.inputRow, { marginBottom: Math.max(insets.bottom, 10) }]}>
            {activeTab === "support" && (
              <Pressable style={styles.attachButton} hitSlop={10}>
                <Ionicons name="attach-outline" size={25} color={COLORS.muted} />
              </Pressable>
            )}
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
              editable={!loading}
            />
            <Pressable
              style={[
                styles.sendButton,
                (!inputText.trim() || loading) && styles.sendButtonDisabled,
              ]}
              onPress={() => handleSendMessage()}
              disabled={!inputText.trim() || loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={COLORS.muted} />
              ) : (
                <Ionicons name="paper-plane-outline" size={24} color={COLORS.muted} />
              )}
            </Pressable>
          </View>

        </View>
      </KeyboardAvoidingView>

      <BottomNavbar activeTab="ai" />
    </View>
  );
}

// ─── Chat Bubble ──────────────────────────────────────────────────────────────
function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser    = message.role === "user";
  const isError   = message.role === "error";
  const isSupport = message.role === "support";

  const label = isUser
    ? "You"
    : isSupport
    ? "Customer Support"
    : isError
    ? "System"
    : "AI Assistant";

  const iconName: keyof typeof Ionicons.glyphMap = isUser
    ? "person-outline"
    : isSupport
    ? "headset-outline"
    : isError
    ? "warning-outline"
    : "sparkles-outline";

  return (
    <View
      style={[
        styles.messageBubble,
        isUser  && styles.userMessageBubble,
        isError && styles.errorMessageBubble,
      ]}
    >
      {!isUser && (
        <View style={styles.messageLabelRow}>
          <Ionicons
            name={iconName}
            size={21}
            color={isError ? COLORS.error : COLORS.primarySoft}
          />
          <Text style={[styles.messageLabel, isError && styles.errorLabel]}>
            {label}
          </Text>
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

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: 22,
    paddingBottom:     24,
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "space-between",
  },
  title: {
    color:      COLORS.text,
    fontSize:   24,
    fontWeight: "800",
  },
  headerActions: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           16,
  },
  headerIcon: {
    width:           34,
    height:          34,
    borderRadius:    17,
    alignItems:      "center",
    justifyContent:  "center",
  },
  divider: {
    height:          1,
    backgroundColor: COLORS.divider,
  },
  keyboardArea: {
    flex: 1,
  },
  content: {
    flex:              1,
    paddingHorizontal: 22,
    paddingTop:        20,
  },
  segmentWrap: {
    height:          60,
    borderRadius:    18,
    backgroundColor: COLORS.surfaceDark,
    borderWidth:     1,
    borderColor:     COLORS.border,
    flexDirection:   "row",
    padding:         6,
    gap:             6,
    marginBottom:    22,
  },
  segmentButton: {
    flex:           1,
    borderRadius:   14,
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "center",
    gap:            8,
  },
  segmentButtonActive: {
    backgroundColor: COLORS.primary,
  },
  segmentText: {
    color:      COLORS.muted,
    fontSize:   16,
    fontWeight: "800",
  },
  segmentTextActive: {
    color: COLORS.text,
  },
  supportStatusRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           8,
    marginTop:     -4,
    marginBottom:  18,
  },
  supportStatusDot: {
    width:           10,
    height:          10,
    borderRadius:    5,
    backgroundColor: "#facc15",
  },
  supportStatusText: {
    color:      COLORS.muted,
    fontSize:   16,
    lineHeight: 22,
  },
  messagesScroll: {
    flex: 1,
  },
  messagesContent: {
    paddingBottom: 18,
    gap:           12,
  },
  typingIndicator: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           10,
    paddingLeft:   4,
    paddingTop:    4,
  },
  typingText: {
    color:    COLORS.mutedDark,
    fontSize: 15,
  },
  messageBubble: {
    width:           "86%",
    alignSelf:       "flex-start",
    backgroundColor: COLORS.surface,
    borderRadius:    18,
    borderWidth:     1,
    borderColor:     COLORS.border,
    paddingHorizontal: 20,
    paddingVertical:   20,
  },
  userMessageBubble: {
    alignSelf:       "flex-end",
    backgroundColor: COLORS.primary,
    borderColor:     COLORS.primary,
    paddingVertical: 14,
  },
  errorMessageBubble: {
    borderColor:     "rgba(248,113,113,0.3)",
    backgroundColor: "rgba(248,113,113,0.08)",
  },
  messageLabelRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           8,
    marginBottom:  10,
  },
  messageLabel: {
    color:      COLORS.primarySoft,
    fontSize:   15,
    fontWeight: "800",
  },
  errorLabel: {
    color: COLORS.error,
  },
  messageText: {
    color:      COLORS.muted,
    fontSize:   17,
    lineHeight: 28,
  },
  userMessageText: {
    color: COLORS.text,
  },
  messageTime: {
    color:     COLORS.mutedDark,
    fontSize:  14,
    marginTop: 12,
  },
  userMessageTime: {
    color: "rgba(255,255,255,0.78)",
  },
  quickQuestionsWrap: {
    paddingTop:    8,
    paddingBottom: 14,
  },
  quickQuestionsTitle: {
    color:        COLORS.text,
    fontSize:     17,
    marginBottom: 12,
  },
  quickQuestionsGrid: {
    flexDirection: "row",
    flexWrap:      "wrap",
    gap:           10,
  },
  quickQuestionButton: {
    width:           "48%",
    minHeight:       56,
    borderRadius:    12,
    borderWidth:     1,
    borderColor:     "rgba(255,255,255,0.16)",
    backgroundColor: COLORS.surfaceDark,
    justifyContent:  "center",
    paddingHorizontal: 14,
    paddingVertical:   10,
  },
  quickQuestionText: {
    color:      COLORS.text,
    fontSize:   15,
    lineHeight: 20,
    fontWeight: "800",
  },
  inputRow: {
    minHeight:       62,
    borderRadius:    18,
    borderWidth:     1,
    borderColor:     "rgba(255,255,255,0.12)",
    backgroundColor: COLORS.input,
    flexDirection:   "row",
    alignItems:      "center",
    paddingLeft:     18,
    paddingRight:    8,
    gap:             8,
  },
  attachButton: {
    width:          34,
    height:         42,
    alignItems:     "center",
    justifyContent: "center",
  },
  messageInput: {
    flex:            1,
    maxHeight:       100,
    color:           COLORS.text,
    fontSize:        18,
    paddingVertical: 12,
  },
  sendButton: {
    width:          50,
    height:         50,
    borderRadius:   14,
    backgroundColor: COLORS.primary,
    alignItems:     "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
