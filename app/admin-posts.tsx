import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { apiGet, apiPatch } from '@/constants/api-client';
import { useAppTheme, useThemeColors } from '@/context/theme-context';

type ThemeColors = ReturnType<typeof useThemeColors>;

type PostStatus = 'pending' | 'approved' | 'rejected';
type FilterTab = 'pending' | 'approved' | 'rejected';

interface AdminPost {
  _id: string;
  id?: string;
  content: string;
  status: PostStatus;
  tags: string[];
  createdAt: string;
  createdBy:
    | string
    | {
        _id: string;
        firstName?: string;
        lastName?: string;
        username?: string;
      };
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function resolveAuthor(createdBy: AdminPost['createdBy']): string {
  if (typeof createdBy === 'string') return 'Unknown';
  if (createdBy.username) return createdBy.username;
  return `${createdBy.firstName ?? ''} ${createdBy.lastName ?? ''}`.trim() || 'Unknown';
}

function getInitials(name: string) {
  const p = name.trim().split(/\s+/);
  return `${p[0]?.[0] ?? ''}${p[1]?.[0] ?? ''}`.toUpperCase() || 'U';
}

export default function AdminPostsScreen() {
  const insets = useSafeAreaInsets();
  const COLORS = useThemeColors();
  const { isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);

  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>('pending');
  const [actionPost, setActionPost] = useState<AdminPost | null>(null);
  const [processing, setProcessing] = useState(false);

  const fetchByStatus = async (status: FilterTab): Promise<AdminPost[]> => {
    try {
      const res = await apiGet(`/posts/admin/list?status=${status}&size=50`);
      return res?.data?.posts?.result ?? res?.data?.result ?? res?.data?.posts ?? [];
    } catch (err) {
      console.log(`fetchByStatus(${status}) error:`, err);
      return [];
    }
  };

  const fetchPosts = useCallback(async (isRefresh = false) => {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      const [pending, approved, rejected] = await Promise.all([
        fetchByStatus('pending'),
        fetchByStatus('approved'),
        fetchByStatus('rejected'),
      ]);
      setPosts([...pending, ...approved, ...rejected]);
    } catch (err) {
      console.log('fetchAdminPosts error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const filtered = posts.filter((p) => p.status === activeTab);
  const counts = {
    pending:  posts.filter((p) => p.status === 'pending').length,
    approved: posts.filter((p) => p.status === 'approved').length,
    rejected: posts.filter((p) => p.status === 'rejected').length,
  };

  const handleAction = async (postId: string, action: 'approve' | 'reject') => {
    setProcessing(true);
    try {
      await apiPatch(`/posts/${postId}/${action}`);
      setPosts((cur) =>
        cur.map((p) =>
          (p._id ?? p.id) !== postId ? p : { ...p, status: action === 'approve' ? 'approved' : 'rejected' }
        )
      );
      setActionPost(null);
    } catch (err) {
      console.log('adminAction error:', err);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Gradient background */}
      {isDark && (
        <LinearGradient
          colors={['#0f2040', '#0d1a35', '#0a1225', '#080A0F']}
          locations={[0, 0.25, 0.55, 1]}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
      )}

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </Pressable>
        <Text style={styles.title}>Post Moderation</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={[styles.statChip, { borderColor: COLORS.warning }]}>
          <Text style={[styles.statNum, { color: COLORS.warning }]}>{counts.pending}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={[styles.statChip, { borderColor: COLORS.success }]}>
          <Text style={[styles.statNum, { color: COLORS.success }]}>{counts.approved}</Text>
          <Text style={styles.statLabel}>Approved</Text>
        </View>
        <View style={[styles.statChip, { borderColor: COLORS.danger }]}>
          <Text style={[styles.statNum, { color: COLORS.danger }]}>{counts.rejected}</Text>
          <Text style={styles.statLabel}>Rejected</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        {(['pending', 'approved', 'rejected'] as FilterTab[]).map((tab) => (
          <Pressable
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === 'pending' && counts.pending > 0 ? (
                <Text style={styles.tabBadge}> {counts.pending}</Text>
              ) : null}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* List */}
      {loading ? (
        <ActivityIndicator color={COLORS.primary} size="large" style={{ marginTop: 60 }} />
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 30 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => fetchPosts(true)} tintColor={COLORS.primary} />
          }
        >
          {filtered.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons
                name={activeTab === 'pending' ? 'time-outline' : activeTab === 'approved' ? 'checkmark-circle-outline' : 'close-circle-outline'}
                size={44}
                color={COLORS.mutedDark}
              />
              <Text style={styles.emptyTitle}>No {activeTab} posts</Text>
              <Text style={styles.emptyText}>
                {activeTab === 'pending' ? 'All caught up! No posts waiting for review.' : `No ${activeTab} posts yet.`}
              </Text>
            </View>
          ) : (
            filtered.map((post) => (
              <PostModerationCard
                key={post._id ?? post.id}
                post={post}
                styles={styles}
                COLORS={COLORS}
                onAction={() => setActionPost(post)}
              />
            ))
          )}
        </ScrollView>
      )}

      {/* Action Modal */}
      <Modal visible={!!actionPost} transparent animationType="slide" onRequestClose={() => setActionPost(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setActionPost(null)} />
        <View style={[styles.actionSheet, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>Review Post</Text>

          {actionPost && (
            <View style={styles.previewCard}>
              <Text style={styles.previewAuthor}>{resolveAuthor(actionPost.createdBy)}</Text>
              <Text style={styles.previewContent} numberOfLines={4}>{actionPost.content}</Text>
              {actionPost.tags.length > 0 && (
                <View style={styles.previewTags}>
                  {actionPost.tags.map((t) => (
                    <View key={t} style={styles.tagPill}>
                      <Text style={styles.tagText}>#{t}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {actionPost?.status === 'pending' && (
            <>
              <Pressable style={[styles.approveBtn, processing && { opacity: 0.6 }]}
                onPress={() => handleAction(actionPost._id ?? actionPost.id!, 'approve')} disabled={processing}>
                {processing ? <ActivityIndicator color="#fff" size="small" /> : (
                  <><Ionicons name="checkmark-circle-outline" size={20} color="#fff" /><Text style={styles.approveBtnText}>Approve Post</Text></>
                )}
              </Pressable>
              <Pressable style={[styles.rejectBtn, processing && { opacity: 0.6 }]}
                onPress={() => handleAction(actionPost._id ?? actionPost.id!, 'reject')} disabled={processing}>
                {processing ? <ActivityIndicator color={COLORS.danger} size="small" /> : (
                  <><Ionicons name="close-circle-outline" size={20} color={COLORS.danger} /><Text style={styles.rejectBtnText}>Reject Post</Text></>
                )}
              </Pressable>
            </>
          )}

          {actionPost?.status === 'approved' && (
            <Pressable style={[styles.rejectBtn, processing && { opacity: 0.6 }]}
              onPress={() => handleAction(actionPost._id ?? actionPost.id!, 'reject')} disabled={processing}>
              <Ionicons name="close-circle-outline" size={20} color={COLORS.danger} />
              <Text style={styles.rejectBtnText}>Revoke Approval</Text>
            </Pressable>
          )}

          {actionPost?.status === 'rejected' && (
            <Pressable style={[styles.approveBtn, processing && { opacity: 0.6 }]}
              onPress={() => handleAction(actionPost._id ?? actionPost.id!, 'approve')} disabled={processing}>
              <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
              <Text style={styles.approveBtnText}>Approve Post</Text>
            </Pressable>
          )}

          <Pressable style={styles.cancelBtn} onPress={() => setActionPost(null)}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

/* ════════════════════════════════════════
   POST CARD
════════════════════════════════════════ */
function PostModerationCard({ post, onAction, styles, COLORS }: {
  post: AdminPost; onAction: () => void;
  styles: ReturnType<typeof createStyles>; COLORS: ThemeColors;
}) {
  const authorName = resolveAuthor(post.createdBy);
  const statusColor = post.status === 'approved' ? COLORS.success : post.status === 'rejected' ? COLORS.danger : COLORS.warning;
  const statusIcon  = post.status === 'approved' ? 'checkmark-circle' : post.status === 'rejected' ? 'close-circle' : 'time';

  return (
    <View style={styles.postCard}>
      <View style={styles.cardHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitials(authorName)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.authorName}>{authorName}</Text>
          <Text style={styles.postDate}>{formatDate(post.createdAt)}</Text>
        </View>
        <View style={[styles.statusBadge, { borderColor: `${statusColor}40`, backgroundColor: `${statusColor}12` }]}>
          <Ionicons name={statusIcon as any} size={13} color={statusColor} />
          <Text style={[styles.statusText, { color: statusColor }]}>
            {post.status.charAt(0).toUpperCase() + post.status.slice(1)}
          </Text>
        </View>
      </View>

      <Text style={styles.postContent} numberOfLines={3}>{post.content}</Text>

      {post.tags.length > 0 && (
        <View style={styles.tagsRow}>
          {post.tags.map((t) => (
            <View key={t} style={styles.tagPill}><Text style={styles.tagText}>#{t}</Text></View>
          ))}
        </View>
      )}

      <Pressable style={styles.reviewBtn} onPress={onAction}>
        <Ionicons name="shield-checkmark-outline" size={15} color={COLORS.primary} />
        <Text style={styles.reviewBtnText}>{post.status === 'pending' ? 'Review & Decide' : 'Change Status'}</Text>
        <Ionicons name="chevron-forward" size={14} color={COLORS.primary} style={{ marginLeft: 'auto' }} />
      </Pressable>
    </View>
  );
}

/* ════════════════════════════════════════
   STYLES
════════════════════════════════════════ */
const createStyles = (COLORS: ThemeColors) =>
  StyleSheet.create({
    container:        { flex: 1, backgroundColor: COLORS.background },
    header:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
    backBtn:          { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.surfaceLight, alignItems: 'center', justifyContent: 'center' },
    title:            { color: COLORS.text, fontSize: 20, fontWeight: '800' },
    statsRow:         { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingVertical: 14 },
    statChip:         { flex: 1, borderRadius: 14, borderWidth: 1, backgroundColor: COLORS.surface, padding: 12, alignItems: 'center', gap: 4 },
    statNum:          { fontSize: 22, fontWeight: '800' },
    statLabel:        { color: COLORS.muted, fontSize: 12 },
    tabsRow:          { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 14 },
    tab:              { flex: 1, height: 38, borderRadius: 19, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
    tabActive:        { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    tabText:          { color: COLORS.muted, fontSize: 13, fontWeight: '700' },
    tabTextActive:    { color: '#fff' },
    tabBadge:         { color: COLORS.warning, fontWeight: '800' },
    scroll:           { flex: 1 },
    content:          { paddingHorizontal: 20, gap: 12 },
    postCard:         { backgroundColor: COLORS.surface, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: COLORS.border },
    cardHeader:       { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
    avatar:           { width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
    avatarText:       { color: '#fff', fontSize: 15, fontWeight: '800' },
    authorName:       { color: COLORS.text, fontSize: 15, fontWeight: '700' },
    postDate:         { color: COLORS.mutedDark, fontSize: 12, marginTop: 2 },
    statusBadge:      { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
    statusText:       { fontSize: 12, fontWeight: '700' },
    postContent:      { color: COLORS.muted, fontSize: 15, lineHeight: 22, marginBottom: 10 },
    tagsRow:          { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
    tagPill:          { backgroundColor: COLORS.surfaceLight, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
    tagText:          { color: COLORS.primary, fontSize: 12, fontWeight: '600' },
    reviewBtn:        { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: `${COLORS.primary}14`, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: `${COLORS.primary}33` },
    reviewBtnText:    { color: COLORS.primary, fontSize: 14, fontWeight: '700', flex: 1 },
    emptyCard:        { alignItems: 'center', paddingVertical: 60, gap: 12 },
    emptyTitle:       { color: COLORS.text, fontSize: 18, fontWeight: '800' },
    emptyText:        { color: COLORS.muted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
    modalBackdrop:    { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
    actionSheet:      { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: COLORS.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 12, borderWidth: 1, borderColor: COLORS.border },
    handle:           { width: 40, height: 4, backgroundColor: COLORS.mutedDark, borderRadius: 2, alignSelf: 'center', marginBottom: 20, opacity: 0.5 },
    sheetTitle:       { color: COLORS.text, fontSize: 20, fontWeight: '800', marginBottom: 16 },
    previewCard:      { backgroundColor: COLORS.input, borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border },
    previewAuthor:    { color: COLORS.primary, fontSize: 13, fontWeight: '700', marginBottom: 6 },
    previewContent:   { color: COLORS.muted, fontSize: 14, lineHeight: 20 },
    previewTags:      { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
    approveBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: 16, backgroundColor: COLORS.success, marginBottom: 10 },
    approveBtnText:   { color: '#fff', fontSize: 16, fontWeight: '800' },
    rejectBtn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: 16, borderWidth: 1, borderColor: COLORS.danger, backgroundColor: `${COLORS.danger}14`, marginBottom: 10 },
    rejectBtnText:    { color: COLORS.danger, fontSize: 16, fontWeight: '800' },
    cancelBtn:        { height: 48, borderRadius: 14, backgroundColor: COLORS.surfaceLight, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
    cancelText:       { color: COLORS.muted, fontSize: 15, fontWeight: '700' },
  });