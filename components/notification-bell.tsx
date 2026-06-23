import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSocket } from '@/hooks/useSocket';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useNotifications, ApiNotification } from '@/hooks/useNotifications';
import { AppColors, useThemeColors } from '@/context/theme-context';

function typeIcon(type: ApiNotification['type']): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case 'follow':
      return 'person-add-outline';
    case 'like':
      return 'heart-outline';
    case 'comment':
      return 'chatbubble-outline';
    case 'reply':
      return 'return-down-forward-outline';
    case 'mention':
      return 'at-outline';
    case 'system_alert':
      return 'alert-circle-outline';
    default:
      return 'notifications-outline';
  }
}

function typeColor(type: ApiNotification['type'], COLORS: AppColors): string {
  switch (type) {
    case 'follow':
      return COLORS.primary;
    case 'like':
      return COLORS.danger;
    case 'comment':
      return COLORS.primary;
    case 'reply':
      return COLORS.primary;
    case 'mention':
      return COLORS.warning;
    case 'system_alert':
      return COLORS.warning;
    default:
      return COLORS.muted;
  }
}

function formatTime(dateStr: string) {
  if (!dateStr) return '';

  const date = new Date(dateStr);
  const now = new Date();
  const diffMin = Math.floor((now.getTime() - date.getTime()) / 60000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;

  return `${Math.floor(diffH / 24)}d ago`;
}

/* ════════════════════════════════════════
   BELL BUTTON
════════════════════════════════════════ */
export function NotificationBell({
  iconSize = 25,
  color,
}: {
  iconSize?: number;
  color?: string;
}) {
  const insets = useSafeAreaInsets();
  const COLORS = useThemeColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);

  const {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markAllAsRead,
    addRealtimeNotification,
  } = useNotifications();

  const [userId, setUserId] = useState<string | undefined>(undefined);

  useEffect(() => {
    AsyncStorage.getItem('userId').then((stored) => {
      const id = stored?.replace(/"/g, '').trim() ?? '';
      if (id) {
        setUserId(id);
      }
    });
  }, []);
  useSocket(userId, addRealtimeNotification);

  const [visible, setVisible] = useState(false);

  const iconColor = color ?? COLORS.text;

  const handleOpen = () => {
    setVisible(true);
    fetchNotifications();
  };

  const handleClose = () => {
    setVisible(false);

    if (unreadCount > 0) {
      markAllAsRead();
    }
  };

  return (
    <>
      {/* Bell icon */}
      <Pressable style={styles.bellWrap} onPress={handleOpen} hitSlop={10}>
        <Ionicons
          name="notifications-outline"
          size={iconSize}
          color={iconColor}
        />

        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </Text>
          </View>
        )}
      </Pressable>

      {/* Notifications modal */}
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={handleClose}
      >
        <Pressable style={styles.backdrop} onPress={handleClose} />

        <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Notifications</Text>

            <View style={styles.sheetActions}>
              {unreadCount > 0 && (
                <Pressable style={styles.markReadBtn} onPress={markAllAsRead}>
                  <Text style={styles.markReadText}>Mark all read</Text>
                </Pressable>
              )}

              <Pressable onPress={handleClose} style={styles.closeBtn} hitSlop={10}>
                <Ionicons name="close" size={20} color={COLORS.text} />
              </Pressable>
            </View>
          </View>

          {/* List */}
          {loading ? (
            <ActivityIndicator
              color={COLORS.primary}
              style={{ marginTop: 40 }}
            />
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {notifications.length > 0 ? (
                notifications.map((n) => (
                  <NotificationItem
                    key={n._id}
                    notification={n}
                    styles={styles}
                    COLORS={COLORS}
                  />
                ))
              ) : (
                <View style={styles.emptyWrap}>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={44}
                    color={COLORS.success}
                  />
                  <Text style={styles.emptyText}>You're all caught up!</Text>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </Modal>
    </>
  );
}

/* ── Single notification row ── */
function NotificationItem({
  notification: n,
  styles,
  COLORS,
}: {
  notification: ApiNotification;
  styles: ReturnType<typeof createStyles>;
  COLORS: AppColors;
}) {
  const color = typeColor(n.type, COLORS);

  return (
    <View style={[styles.notifItem, !n.read && styles.notifItemUnread]}>
      <View style={[styles.notifIconWrap, { backgroundColor: `${color}18` }]}>
        <Ionicons name={typeIcon(n.type)} size={20} color={color} />
      </View>

      <View style={{ flex: 1 }}>
        <View style={styles.notifTopRow}>
          <Text style={styles.notifTitle}>{n.title}</Text>
          {!n.read && <View style={styles.unreadDot} />}
        </View>

        <Text style={styles.notifBody}>{n.body}</Text>

        {n.sender?.username && (
          <Text style={styles.notifSender}>from {n.sender.username}</Text>
        )}

        <Text style={styles.notifTime}>{formatTime(n.createdAt)}</Text>
      </View>
    </View>
  );
}

/* ════════════════════════════════════════
   STYLES
════════════════════════════════════════ */
const createStyles = (COLORS: AppColors) =>
  StyleSheet.create({
    bellWrap: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.surfaceLight,
      alignItems: 'center',
      justifyContent: 'center',
    },

    badge: {
      position: 'absolute',
      top: -2,
      right: -2,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: COLORS.danger,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 3,
    },

    badgeText: {
      color: '#fff',
      fontSize: 9,
      fontWeight: '800',
    },

    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.55)',
    },

    sheet: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: COLORS.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 20,
      paddingTop: 12,
      maxHeight: '80%',
      borderWidth: 1,
      borderColor: COLORS.border,
    },

    handle: {
      width: 40,
      height: 4,
      backgroundColor: COLORS.mutedDark,
      borderRadius: 2,
      alignSelf: 'center',
      marginBottom: 16,
      opacity: 0.5,
    },

    sheetHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },

    sheetTitle: {
      color: COLORS.text,
      fontSize: 20,
      fontWeight: '800',
    },

    sheetActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },

    markReadBtn: {
      backgroundColor: `${COLORS.primary}18`,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },

    markReadText: {
      color: COLORS.primary,
      fontSize: 13,
      fontWeight: '700',
    },

    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: COLORS.input,
      alignItems: 'center',
      justifyContent: 'center',
    },

    notifItem: {
      flexDirection: 'row',
      gap: 12,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.divider,
    },

    notifItemUnread: {
      backgroundColor: `${COLORS.primary}0D`,
      marginHorizontal: -20,
      paddingHorizontal: 20,
    },

    notifIconWrap: {
      width: 42,
      height: 42,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },

    notifTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 3,
    },

    notifTitle: {
      color: COLORS.text,
      fontSize: 14,
      fontWeight: '700',
      flex: 1,
    },

    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: COLORS.primary,
    },

    notifBody: {
      color: COLORS.muted,
      fontSize: 13,
      lineHeight: 18,
    },

    notifSender: {
      color: COLORS.mutedDark,
      fontSize: 12,
      marginTop: 2,
    },

    notifTime: {
      color: COLORS.mutedDark,
      fontSize: 11,
      marginTop: 4,
    },

    emptyWrap: {
      alignItems: 'center',
      paddingVertical: 50,
      gap: 12,
    },

    emptyText: {
      color: COLORS.muted,
      fontSize: 15,
    },
  });