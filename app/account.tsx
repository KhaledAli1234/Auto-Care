import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUserProfile } from '@/context/user-profile-context';
import { BottomNavbar } from '@/components/bottom-navbar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '@/constants/api';

/* ════════════════════════════════════════
   COLORS
════════════════════════════════════════ */
const COLORS = {
  background:   '#09182d',
  surface:      '#13243a',
  surfaceLight: '#172b44',
  border:       'rgba(255,255,255,0.07)',
  divider:      'rgba(255,255,255,0.06)',
  text:         '#f8fafc',
  muted:        '#aebbd0',
  mutedDark:    '#74849a',
  primary:      '#3268f7',
  input:        '#0f1f34',
  danger:       '#ef4444',
};

/* ════════════════════════════════════════
   TYPES
════════════════════════════════════════ */
type AllowComments = 'allow' | 'disable';
type Availability  = 'public' | 'friends' | 'onlyMe';

interface ApiReply {
  _id: string;
  id?: string;
  createdBy: string | { _id: string; firstName?: string; lastName?: string; username?: string } | null;
  content: string;
  createdAt?: string;
}

interface ApiComment {
  _id: string;
  id?: string;
  createdBy: string | { _id: string; firstName?: string; lastName?: string; username?: string } | null;
  content: string;
  createdAt?: string;
  replies?: ApiReply[];
}

interface ApiPost {
  _id?: string;
  id: string;
  createdBy: string;
  content: string;
  status: string;
  attachments: string[];
  tags: string[];
  likes: string[];
  availability: Availability;
  allowComments: AllowComments;
  createdAt: string;
  updatedAt: string;
  comments?: ApiComment[];
}

interface PostComment {
  id: string;
  author: string;
  authorId: string;
  text: string;
  createdAtLabel: string;
  replies: PostReply[];
  pending?: boolean;
}

interface PostReply {
  id: string;
  author: string;
  authorId: string;
  text: string;
  createdAtLabel: string;
  pending?: boolean;
}

interface AccountPost {
  id: string;
  content: string;
  tags: string[];
  allowComments: AllowComments;
  availability: Availability;
  createdAtLabel: string;
  likes: number;
  likedByMe: boolean;
  comments: PostComment[];
  shares: number;
  pending?: boolean;
}

/* ════════════════════════════════════════
   HELPERS
════════════════════════════════════════ */
function toInitials(fullName?: string | null) {
  const name = (fullName ?? '').trim();
  if (!name) return 'U';
  const parts = name.split(/\s+/);
  return `${parts[0][0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase();
}

function valueOrFallback(value: string | number | null | undefined, fallback = 'Not set') {
  const text = value === null || value === undefined ? '' : String(value).trim();
  return text ? text : fallback;
}

function formatCreatedAt(dateStr?: string) {
  if (!dateStr) return '';
  const date    = new Date(dateStr);
  const now     = new Date();
  const diffMs  = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1)  return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24)   return `${diffH}h ago`;
  return `${Math.floor(diffH / 24)}d ago`;
}

function resolveAuthorName(
  createdBy: ApiComment['createdBy'] | null,
  myUserId: string,
  myName: string,
): string {
  if (!createdBy) return 'Deleted User';

  if (typeof createdBy === 'string') {
    return createdBy === myUserId ? myName : 'User';
  }

  if (createdBy.username) return createdBy.username;

  const full = `${createdBy.firstName ?? ''} ${createdBy.lastName ?? ''}`.trim();
  if (full) return full;

  return createdBy._id === myUserId ? myName : 'User';
}

// ✅ FIX: null-safe author ID extraction
function resolveAuthorId(
  createdBy: ApiComment['createdBy'] | null,
): string {
  if (!createdBy) return '';
  if (typeof createdBy === 'string') return createdBy;
  return createdBy._id ?? '';
}

function normalizeComment(c: ApiComment, myUserId: string, myName: string): PostComment {
  return {
    id:             c._id ?? c.id ?? '',
    author:         resolveAuthorName(c.createdBy, myUserId, myName),
    authorId:       resolveAuthorId(c.createdBy),   // ✅ FIXED
    text:           c.content ?? '',
    createdAtLabel: formatCreatedAt(c.createdAt),
    replies: (c.replies ?? []).map(r => ({
      id:             r._id ?? r.id ?? '',
      author:         resolveAuthorName(r.createdBy, myUserId, myName),
      authorId:       resolveAuthorId(r.createdBy),  // ✅ FIXED
      text:           r.content ?? '',
      createdAtLabel: formatCreatedAt(r.createdAt),
    })),
  };
}

function normalizePost(p: ApiPost, myUserId: string, myName: string): AccountPost {
  return {
    id:             p._id ?? p.id ?? '',
    content:        p.content ?? '',
    tags:           p.tags ?? [],
    allowComments:  p.allowComments ?? 'allow',
    availability:   p.availability ?? 'public',
    createdAtLabel: formatCreatedAt(p.createdAt),
    likes:          Array.isArray(p.likes) ? p.likes.length : 0,
    likedByMe:      Array.isArray(p.likes) ? p.likes.includes(myUserId) : false,
    comments:       (p.comments ?? []).map(c => normalizeComment(c, myUserId, myName)),
    shares:         0,
  };
}

/* ════════════════════════════════════════
   API HELPERS
════════════════════════════════════════ */
async function authHeaders() {
  const token = await AsyncStorage.getItem('access_token');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token?.replace(/"/g, '') ?? ''}`,
  };
}
async function apiGet(path: string) {
  const res  = await fetch(`${BASE_URL}${path}`, { method: 'GET', headers: await authHeaders() });
  const json = await res.json();
  if (!res.ok) console.warn(`[GET ${path}]`, json);
  return json;
}
async function apiPost(path: string, body?: object) {
  const res  = await fetch(`${BASE_URL}${path}`, { method: 'POST', headers: await authHeaders(), body: body ? JSON.stringify(body) : undefined });
  const json = await res.json();
  if (!res.ok) console.warn(`[POST ${path}]`, json);
  return json;
}
async function apiPatch(path: string, body?: object) {
  const res  = await fetch(`${BASE_URL}${path}`, { method: 'PATCH', headers: await authHeaders(), body: body ? JSON.stringify(body) : undefined });
  const json = await res.json();
  if (!res.ok) console.warn(`[PATCH ${path}]`, json);
  return json;
}
async function apiDelete(path: string) {
  const res  = await fetch(`${BASE_URL}${path}`, { method: 'DELETE', headers: await authHeaders() });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) console.warn(`[DELETE ${path}]`, json);
  return json;
}

/* ════════════════════════════════════════
   INFO ROW
════════════════════════════════════════ */
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

/* ════════════════════════════════════════
   SCREEN
════════════════════════════════════════ */
export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const { profile, updateProfile } = useUserProfile();

  const [myUserId,         setMyUserId]         = useState('');
  const [posts,            setPosts]            = useState<AccountPost[]>([]);
  const [loading,          setLoading]          = useState(true);
  const [showLogoutConfirm,setShowLogoutConfirm]= useState(false);

  // edit post
  const [editPostId,   setEditPostId]   = useState<string | null>(null);
  const [editPostText, setEditPostText] = useState('');
  const [editPostTags, setEditPostTags] = useState('');
  const [saving,       setSaving]       = useState(false);

  const myName    = `${profile?.user?.firstName ?? ''} ${profile?.user?.lastName ?? ''}`.trim() || 'You';
  const myVehicle = profile?.vehicle ? [profile.vehicle.brand, profile.vehicle.model, profile.vehicle.year].filter(Boolean).join(' ') : '';
  const fullName  = myName;

  /* ── load profile + posts ── */
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const uid = (await AsyncStorage.getItem('userId'))?.replace(/"/g, '') ?? '';
        setMyUserId(uid);
        const data = await apiGet(`/user/${uid}`);
        const { user, vehicle, stats, posts: apiPosts } = data?.data ?? {};

        updateProfile({ user, vehicle, stats, posts: apiPosts ?? [] });
        console.log("API POSTS:", apiPosts);
        const name = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim();
        const normalized = (apiPosts ?? []).map((p: ApiPost) => normalizePost(p, uid, name));
        setPosts(normalized);
      } catch (err) {
        console.log('Profile load error:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  /* ════════ LIKE ════════ */
  const handleToggleLike = async (postId: string, likedByMe: boolean) => {
    setPosts(cur => cur.map(p => p.id !== postId ? p : {
      ...p, likedByMe: !likedByMe,
      likes: !likedByMe ? p.likes + 1 : Math.max(0, p.likes - 1),
    }));
    try {
      await apiPatch(`/posts/${postId}/like?action=${likedByMe ? 'unlike' : 'like'}`);
    } catch {
      setPosts(cur => cur.map(p => p.id !== postId ? p : {
        ...p, likedByMe,
        likes: likedByMe ? p.likes + 1 : Math.max(0, p.likes - 1),
      }));
    }
  };

  /* ════════ DELETE POST ════════ */
  const handleDeletePost = async (postId: string) => {
    setPosts(cur => cur.filter(p => p.id !== postId));
    try {
      await apiDelete(`/posts/${postId}`);
    } catch {
      const uid  = myUserId;
      const data = await apiGet(`/user/${uid}`);
      const name = myName;
      setPosts((data?.data?.posts ?? []).map((p: ApiPost) => normalizePost(p, uid, name)));
    }
  };

  /* ════════ EDIT POST ════════ */
  const handleOpenEdit = (post: AccountPost) => {
    setEditPostId(post.id);
    setEditPostText(post.content);
    setEditPostTags(post.tags.join(', '));
  };

  const handleSaveEdit = async () => {
    if (!editPostId || !editPostText.trim()) return;
    setSaving(true);
    const cur     = posts.find(p => p.id === editPostId);
    const newTags = editPostTags.split(',').map(t => t.trim()).filter(Boolean);
    const prevContent = cur?.content ?? '';
    const prevTags    = cur?.tags ?? [];
    setPosts(ps => ps.map(p => p.id !== editPostId ? p : { ...p, content: editPostText.trim(), tags: newTags }));
    try {
      await apiPatch(`/posts/${editPostId}`, {
        content:       editPostText.trim(),
        tags:          newTags,
        allowComments: cur?.allowComments ?? 'allow',
        availability:  cur?.availability  ?? 'public',
      });
      setEditPostId(null);
      setEditPostText('');
      setEditPostTags('');
    } catch {
      setPosts(ps => ps.map(p => p.id !== editPostId ? p : { ...p, content: prevContent, tags: prevTags }));
    } finally {
      setSaving(false);
    }
  };

  /* ════════ COMMENTS ════════ */
  const handleAddComment = async (postId: string, text: string) => {
    if (!text.trim()) return;
    const tempId = `temp-c-${Date.now()}`;
    setPosts(cur => cur.map(p => p.id !== postId ? p : {
      ...p, comments: [...p.comments, {
        id: tempId, author: myName, authorId: myUserId,
        text: text.trim(), createdAtLabel: 'Just now', replies: [], pending: true,
      }],
    }));
    try {
      const data = await apiPost(`/comments/${postId}`, { content: text.trim() });
      const saved: ApiComment | null = data?.data?.comment ?? data?.data?.result ?? data?.data ?? null;
      if (saved && (saved._id || saved.id)) {
        setPosts(cur => cur.map(p => p.id !== postId ? p : {
          ...p, comments: p.comments.map(c =>
            c.id !== tempId ? c : normalizeComment(saved, myUserId, myName)
          ),
        }));
      } else {
        setPosts(cur => cur.map(p => p.id !== postId ? p : {
          ...p, comments: p.comments.map(c => c.id !== tempId ? c : { ...c, pending: false }),
        }));
      }
    } catch {
      setPosts(cur => cur.map(p => p.id !== postId ? p : {
        ...p, comments: p.comments.filter(c => c.id !== tempId),
      }));
    }
  };

  const handleEditComment = async (postId: string, commentId: string, text: string) => {
    const prev = posts.find(p => p.id === postId)?.comments.find(c => c.id === commentId)?.text ?? '';
    setPosts(cur => cur.map(p => p.id !== postId ? p : {
      ...p, comments: p.comments.map(c => c.id !== commentId ? c : { ...c, text }),
    }));
    try { await apiPatch(`/comments/${commentId}`, { content: text }); }
    catch { setPosts(cur => cur.map(p => p.id !== postId ? p : {
      ...p, comments: p.comments.map(c => c.id !== commentId ? c : { ...c, text: prev }),
    })); }
  };

  const handleDeleteComment = async (postId: string, commentId: string) => {
    const prev = posts.find(p => p.id === postId)?.comments ?? [];
    setPosts(cur => cur.map(p => p.id !== postId ? p : {
      ...p, comments: p.comments.filter(c => c.id !== commentId),
    }));
    try { await apiDelete(`/comments/${commentId}`); }
    catch { setPosts(cur => cur.map(p => p.id !== postId ? p : { ...p, comments: prev })); }
  };

  /* ════════ REPLIES ════════ */
  const handleAddReply = async (postId: string, commentId: string, text: string) => {
    if (!text.trim()) return;
    const tempId = `temp-r-${Date.now()}`;
    setPosts(cur => cur.map(p => p.id !== postId ? p : {
      ...p, comments: p.comments.map(c => c.id !== commentId ? c : {
        ...c, replies: [...c.replies, {
          id: tempId, author: myName, authorId: myUserId,
          text: text.trim(), createdAtLabel: 'Just now', pending: true,
        }],
      }),
    }));
    try {
      const data = await apiPost(`/comments/${postId}/${commentId}/reply`, { content: text.trim() });
      const saved: ApiReply | null = data?.data?.reply ?? data?.data?.comment ?? data?.data ?? null;
      if (saved && (saved._id || saved.id)) {
        setPosts(cur => cur.map(p => p.id !== postId ? p : {
          ...p, comments: p.comments.map(c => c.id !== commentId ? c : {
            ...c, replies: c.replies.map(r => r.id !== tempId ? r : {
              id: saved._id ?? saved.id ?? tempId,
              author: resolveAuthorName(saved.createdBy, myUserId, myName),
              authorId: resolveAuthorId(saved.createdBy),  // ✅ FIXED
              text: saved.content ?? text,
              createdAtLabel: formatCreatedAt(saved.createdAt),
              pending: false,
            }),
          }),
        }));
      } else {
        setPosts(cur => cur.map(p => p.id !== postId ? p : {
          ...p, comments: p.comments.map(c => c.id !== commentId ? c : {
            ...c, replies: c.replies.map(r => r.id !== tempId ? r : { ...r, pending: false }),
          }),
        }));
      }
    } catch {
      setPosts(cur => cur.map(p => p.id !== postId ? p : {
        ...p, comments: p.comments.map(c => c.id !== commentId ? c : {
          ...c, replies: c.replies.filter(r => r.id !== tempId),
        }),
      }));
    }
  };

  const handleEditReply = async (postId: string, commentId: string, replyId: string, text: string) => {
    const prev = posts.find(p => p.id === postId)?.comments.find(c => c.id === commentId)?.replies.find(r => r.id === replyId)?.text ?? '';
    setPosts(cur => cur.map(p => p.id !== postId ? p : {
      ...p, comments: p.comments.map(c => c.id !== commentId ? c : {
        ...c, replies: c.replies.map(r => r.id !== replyId ? r : { ...r, text }),
      }),
    }));
    try { await apiPatch(`/comments/${commentId}/replies/${replyId}`, { content: text }); }
    catch { setPosts(cur => cur.map(p => p.id !== postId ? p : {
      ...p, comments: p.comments.map(c => c.id !== commentId ? c : {
        ...c, replies: c.replies.map(r => r.id !== replyId ? r : { ...r, text: prev }),
      }),
    })); }
  };

  const handleDeleteReply = async (postId: string, commentId: string, replyId: string) => {
    const prev = posts.find(p => p.id === postId)?.comments.find(c => c.id === commentId)?.replies ?? [];
    setPosts(cur => cur.map(p => p.id !== postId ? p : {
      ...p, comments: p.comments.map(c => c.id !== commentId ? c : {
        ...c, replies: c.replies.filter(r => r.id !== replyId),
      }),
    }));
    try { await apiDelete(`/comments/${commentId}/replies/${replyId}`); }
    catch { setPosts(cur => cur.map(p => p.id !== postId ? p : {
      ...p, comments: p.comments.map(c => c.id !== commentId ? c : { ...c, replies: prev }),
    })); }
  };

  /* ════════ LOGOUT ════════ */
  const handleLogout = async () => {
    await AsyncStorage.multiRemove(['access_token', 'refresh_token', 'userId']);
    router.replace('/sign-in');
  };

  /* ════════════════════════════════════════
     RENDER
  ════════════════════════════════════════ */
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 110 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>My Account</Text>

        {/* USER CARD */}
        <View style={styles.card}>
          <View style={styles.identityRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{toInitials(fullName)}</Text>
            </View>
            <View style={styles.identityText}>
              <Text style={styles.name}>{valueOrFallback(fullName, 'User')}</Text>
              <Text style={styles.meta}>{valueOrFallback(profile?.user?.email)}</Text>
              <Text style={styles.meta}>{valueOrFallback(profile?.user?.phone)}</Text>
            </View>
            <Pressable onPress={() => setShowLogoutConfirm(true)} style={styles.logoutButton}>
              <Ionicons name="log-out-outline" size={18} color={COLORS.danger} />
              <Text style={styles.logoutText}>Logout</Text>
            </Pressable>
          </View>
        </View>

        {/* STATS */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Stats</Text>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{profile?.stats?.followersCount ?? 0}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{profile?.stats?.followingCount ?? 0}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{profile?.stats?.postsCount ?? 0}</Text>
              <Text style={styles.statLabel}>Posts</Text>
            </View>
          </View>
        </View>

        {/* VEHICLE */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Vehicle Information</Text>
          <InfoRow label="Brand & Model"  value={valueOrFallback(myVehicle)} />
          <InfoRow label="Year"           value={valueOrFallback(profile?.vehicle?.year)} />
          <InfoRow label="Body Type"      value={valueOrFallback((profile?.vehicle as any)?.bodyType)} />
          <InfoRow label="Engine"         value={valueOrFallback(profile?.vehicle?.engineCapacity ? `${profile.vehicle.engineCapacity} CC` : '')} />
          <InfoRow label="Engine Power"   value={valueOrFallback((profile?.vehicle as any)?.enginePowerHp ? `${(profile?.vehicle as any).enginePowerHp} HP` : '')} />
          <InfoRow label="Transmission"   value={valueOrFallback(profile?.vehicle?.transmission)} />
          <InfoRow label="Fuel Type"      value={valueOrFallback(profile?.vehicle?.fuelType)} />
          <InfoRow label="Fuel Economy"   value={valueOrFallback((profile?.vehicle as any)?.fuelCombined ? `${(profile?.vehicle as any).fuelCombined} L/100km` : '')} />
          <InfoRow label="Tank Capacity"  value={valueOrFallback(profile?.vehicle?.tankCapacity ? `${profile.vehicle.tankCapacity} L` : '')} />
          <InfoRow label="Weight"         value={valueOrFallback((profile?.vehicle as any)?.weightKg ? `${(profile?.vehicle as any).weightKg} kg` : '')} />
          <InfoRow label="Mileage"        value={valueOrFallback(profile?.vehicle?.mileage ? `${profile.vehicle.mileage} km` : '')} />
        </View>

        {/* POSTS */}
        <Text style={[styles.sectionTitle, { marginTop: 4, marginBottom: 12 }]}>My Posts</Text>
        {loading ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: 20 }} />
        ) : posts.length > 0 ? (
          posts.map(post => (
            <AccountPostCard
              key={post.id}
              post={post}
              myUserId={myUserId}
              myName={myName}
              myVehicle={myVehicle}
              onToggleLike={()              => handleToggleLike(post.id, post.likedByMe)}
              onEdit={()                    => handleOpenEdit(post)}
              onDelete={()                  => handleDeletePost(post.id)}
              onAddComment={t              => handleAddComment(post.id, t)}
              onEditComment={(cId, t)      => handleEditComment(post.id, cId, t)}
              onDeleteComment={cId         => handleDeleteComment(post.id, cId)}
              onAddReply={(cId, t)         => handleAddReply(post.id, cId, t)}
              onEditReply={(cId, rId, t)   => handleEditReply(post.id, cId, rId, t)}
              onDeleteReply={(cId, rId)    => handleDeleteReply(post.id, cId, rId)}
            />
          ))
        ) : (
          <Text style={styles.meta}>No posts yet</Text>
        )}
      </ScrollView>

      <BottomNavbar activeTab="home" />

      {/* ── EDIT POST MODAL ── */}
      <Modal visible={!!editPostId} transparent animationType="slide" onRequestClose={() => setEditPostId(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setEditPostId(null)} />
          <View style={[styles.composerSheet, { paddingBottom: insets.bottom + 18 }]}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Edit Post</Text>
              <Pressable style={styles.closeButton} onPress={() => setEditPostId(null)} hitSlop={10}>
                <Ionicons name="close" size={22} color={COLORS.text} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <TextInput
                style={styles.composerInput}
                value={editPostText}
                onChangeText={setEditPostText}
                multiline
                textAlignVertical="top"
                placeholderTextColor={COLORS.mutedDark}
                placeholder="Edit your post..."
              />
              <Text style={styles.sheetLabel}>Tags (comma separated)</Text>
              <TextInput
                style={styles.tagsInput}
                placeholder="e.g. oil, maintenance, tips"
                placeholderTextColor={COLORS.mutedDark}
                value={editPostTags}
                onChangeText={setEditPostTags}
              />
              <Pressable
                style={[styles.publishButton, (!editPostText.trim() || saving) && styles.publishButtonDisabled]}
                onPress={handleSaveEdit}
                disabled={!editPostText.trim() || saving}
              >
                {saving
                  ? <ActivityIndicator color={COLORS.text} size="small" />
                  : <Text style={styles.publishButtonText}>Save Changes</Text>
                }
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── LOGOUT CONFIRM ── */}
      {showLogoutConfirm && (
        <View style={styles.logoutOverlay}>
          <View style={styles.logoutBox}>
            <Text style={styles.sheetTitle}>Logout</Text>
            <Text style={[styles.meta, { marginBottom: 20, marginTop: 8 }]}>Are you sure you want to logout?</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable style={[styles.modalBtn, { backgroundColor: COLORS.surfaceLight }]} onPress={() => setShowLogoutConfirm(false)}>
                <Text style={{ color: COLORS.text, fontWeight: '600' }}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.modalBtn, { backgroundColor: COLORS.danger }]} onPress={handleLogout}>
                <Text style={{ color: COLORS.text, fontWeight: '700' }}>Logout</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

/* ════════════════════════════════════════
   POST CARD
════════════════════════════════════════ */
function AccountPostCard({
  post, myUserId, myName, myVehicle,
  onToggleLike, onEdit, onDelete,
  onAddComment, onEditComment, onDeleteComment,
  onAddReply, onEditReply, onDeleteReply,
}: {
  post: AccountPost; myUserId: string; myName: string; myVehicle: string;
  onToggleLike: () => void; onEdit: () => void; onDelete: () => void;
  onAddComment:    (t: string) => void;
  onEditComment:   (cId: string, t: string) => void;
  onDeleteComment: (cId: string) => void;
  onAddReply:    (cId: string, t: string) => void;
  onEditReply:   (cId: string, rId: string, t: string) => void;
  onDeleteReply: (cId: string, rId: string) => void;
}) {
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [commentText,     setCommentText]     = useState('');
  const [showOptions,     setShowOptions]     = useState(false);
  const [confirmDelete,   setConfirmDelete]   = useState(false);

  const availIcon =
    post.availability === 'public'  ? 'globe-outline'       :
    post.availability === 'friends' ? 'people-outline'      :
                                      'lock-closed-outline';

  const handleSend = () => {
    if (!commentText.trim()) return;
    onAddComment(commentText);
    setCommentText('');
    setCommentsVisible(true);
  };

  const handleCloseOptions = () => { setShowOptions(false); setConfirmDelete(false); };

  return (
    <View style={styles.postCard}>
      {/* Header */}
      <View style={styles.postHeader}>
        <View style={styles.postAvatar}>
          <Text style={styles.postAvatarText}>{myName.slice(0, 2).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.postAuthor}>{myName}</Text>
          <View style={styles.postMetaRow}>
            {!!myVehicle && <><Text style={styles.postVehicle}>{myVehicle}</Text><Text style={styles.postDot}>•</Text></>}
            <Text style={styles.postTime}>{post.createdAtLabel}</Text>
            <Text style={styles.postDot}>•</Text>
            <Ionicons name={availIcon as any} size={12} color={COLORS.mutedDark} />
          </View>
        </View>
        <Pressable onPress={() => { setConfirmDelete(false); setShowOptions(true); }} hitSlop={12} style={styles.dotsBtn}>
          <Ionicons name="ellipsis-horizontal" size={20} color={COLORS.muted} />
        </Pressable>
      </View>

      {/* Content */}
      <Text style={styles.postContent}>{post.content}</Text>

      {/* Tags */}
      {post.tags.length > 0 && (
        <View style={styles.tagsRow}>
          {post.tags.map(tag => (
            <View key={tag} style={styles.tagPill}>
              <Text style={styles.tagText}>#{tag}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.actionsDivider} />

      {/* Actions */}
      <View style={styles.actionsRow}>
        <Pressable style={styles.actionButton} onPress={onToggleLike}>
          <Ionicons name={post.likedByMe ? 'heart' : 'heart-outline'} size={24}
            color={post.likedByMe ? COLORS.primary : COLORS.muted} />
          <Text style={[styles.actionText, post.likedByMe && styles.actionTextActive]}>{post.likes}</Text>
        </Pressable>

        {post.allowComments === 'allow' && (
          <Pressable style={styles.actionButton} onPress={() => setCommentsVisible(v => !v)}>
            <Ionicons name="chatbubble-outline" size={22} color={COLORS.muted} />
            <Text style={styles.actionText}>{post.comments.length}</Text>
          </Pressable>
        )}
      </View>

      {/* Comments */}
      {post.allowComments === 'allow' && (
        <>
          <View style={[styles.commentInputRow, { marginTop: 14, borderTopWidth: 1, borderTopColor: COLORS.divider, paddingTop: 12 }]}>
            <TextInput
              style={styles.commentInput}
              placeholder="Write a comment..."
              placeholderTextColor={COLORS.mutedDark}
              value={commentText}
              onChangeText={setCommentText}
              multiline
            />
            <Pressable style={styles.sendButton} onPress={handleSend}>
              <Ionicons name="send" size={18} color={COLORS.text} />
            </Pressable>
          </View>

          {commentsVisible && (
            <View style={styles.commentsWrap}>
              {post.comments.map(comment => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  myUserId={myUserId}
                  onEdit={t             => onEditComment(comment.id, t)}
                  onDelete={()          => onDeleteComment(comment.id)}
                  onAddReply={t         => onAddReply(comment.id, t)}
                  onEditReply={(rId, t) => onEditReply(comment.id, rId, t)}
                  onDeleteReply={rId    => onDeleteReply(comment.id, rId)}
                />
              ))}
            </View>
          )}
        </>
      )}

      {/* POST OPTIONS MODAL */}
      <Modal visible={showOptions} transparent animationType="fade" onRequestClose={handleCloseOptions}>
        <Pressable style={styles.backdrop} onPress={handleCloseOptions}>
          <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
            {!confirmDelete ? (
              <>
                <View style={styles.handle} />
                <Text style={styles.sheetTitle}>Post Options</Text>
                <Pressable style={styles.optionRow} onPress={() => { handleCloseOptions(); onEdit(); }}>
                  <View style={[styles.iconWrap, { backgroundColor: 'rgba(50,104,247,0.12)' }]}>
                    <Ionicons name="create-outline" size={20} color={COLORS.primary} />
                  </View>
                  <View style={styles.optionText}>
                    <Text style={styles.optionLabel}>Edit Post</Text>
                    <Text style={styles.optionSub}>Change your post content</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={COLORS.mutedDark} />
                </Pressable>
                <View style={styles.separator} />
                <Pressable style={styles.optionRow} onPress={() => setConfirmDelete(true)}>
                  <View style={[styles.iconWrap, { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
                    <Ionicons name="trash-outline" size={20} color={COLORS.danger} />
                  </View>
                  <View style={styles.optionText}>
                    <Text style={[styles.optionLabel, { color: COLORS.danger }]}>Delete Post</Text>
                    <Text style={styles.optionSub}>This action cannot be undone</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={COLORS.mutedDark} />
                </Pressable>
                <Pressable style={styles.cancelBtn} onPress={handleCloseOptions}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
              </>
            ) : (
              <>
                <View style={styles.handle} />
                <View style={styles.confirmIcon}>
                  <Ionicons name="trash" size={32} color={COLORS.danger} />
                </View>
                <Text style={styles.confirmTitle}>Delete Post?</Text>
                <Text style={styles.confirmSub}>This post will be permanently deleted.</Text>
                <Pressable style={styles.deleteBtn} onPress={() => { handleCloseOptions(); onDelete(); }}>
                  <Text style={styles.deleteBtnText}>Yes, Delete</Text>
                </Pressable>
                <Pressable style={styles.cancelBtn} onPress={() => setConfirmDelete(false)}>
                  <Text style={styles.cancelText}>Go Back</Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

/* ════════════════════════════════════════
   COMMENT ITEM
════════════════════════════════════════ */
function CommentItem({ comment, myUserId, onEdit, onDelete, onAddReply, onEditReply, onDeleteReply }: {
  comment: PostComment; myUserId: string;
  onEdit: (t: string) => void; onDelete: () => void;
  onAddReply: (t: string) => void;
  onEditReply: (rId: string, t: string) => void;
  onDeleteReply: (rId: string) => void;
}) {
  const [repliesVisible, setRepliesVisible] = useState(false);
  const [replyText,      setReplyText]      = useState('');
  const [editing,        setEditing]        = useState(false);
  const [editText,       setEditText]       = useState(comment.text);
  const [showOptions,    setShowOptions]    = useState(false);
  const [confirmDelete,  setConfirmDelete]  = useState(false);
  const isMyComment = comment.authorId === myUserId;
  const handleClose = () => { setShowOptions(false); setConfirmDelete(false); };

  return (
    <View style={styles.commentItem}>
      {editing ? (
        <View>
          <TextInput style={styles.editInput} value={editText} onChangeText={setEditText} multiline autoFocus placeholderTextColor={COLORS.mutedDark} />
          <View style={styles.editActions}>
            <Pressable onPress={() => setEditing(false)}><Text style={styles.cancelEditText}>Cancel</Text></Pressable>
            <Pressable style={styles.saveEditBtn} onPress={() => { onEdit(editText); setEditing(false); }}>
              <Text style={styles.saveEditText}>Save</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <>
          <View style={styles.commentHeader}>
            <Text style={styles.commentAuthor}>{comment.author}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.commentTime}>{comment.createdAtLabel}</Text>
              {isMyComment && (
                <Pressable onPress={() => { setConfirmDelete(false); setShowOptions(true); }} hitSlop={8}>
                  <Ionicons name="ellipsis-horizontal" size={16} color={COLORS.mutedDark} />
                </Pressable>
              )}
            </View>
          </View>
          <Text style={styles.commentText}>{comment.text}</Text>
          <Pressable style={styles.replyTrigger} onPress={() => setRepliesVisible(v => !v)}>
            <Ionicons name="return-down-forward-outline" size={13} color={COLORS.primary} />
            <Text style={styles.replyTriggerText}>
              {repliesVisible ? 'Hide replies' : `Reply${comment.replies.length > 0 ? ` (${comment.replies.length})` : ''}`}
            </Text>
          </Pressable>
        </>
      )}

      {repliesVisible && (
        <View style={styles.repliesWrap}>
          {comment.replies.map(reply => (
            <ReplyItem key={reply.id} reply={reply} myUserId={myUserId}
              onEdit={t => onEditReply(reply.id, t)}
              onDelete={() => onDeleteReply(reply.id)}
            />
          ))}
          <View style={styles.commentInputRow}>
            <TextInput style={styles.commentInput} placeholder="Write a reply..." placeholderTextColor={COLORS.mutedDark}
              value={replyText} onChangeText={setReplyText} multiline />
            <Pressable style={styles.sendButton} onPress={() => { if (!replyText.trim()) return; onAddReply(replyText); setReplyText(''); setRepliesVisible(true); }}>
              <Ionicons name="send" size={16} color={COLORS.text} />
            </Pressable>
          </View>
        </View>
      )}

      <Modal visible={showOptions} transparent animationType="fade" onRequestClose={handleClose}>
        <Pressable style={styles.backdrop} onPress={handleClose}>
          <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
            {!confirmDelete ? (
              <>
                <View style={styles.handle} />
                <Text style={styles.sheetTitle}>Comment Options</Text>
                <Pressable style={styles.optionRow} onPress={() => { setEditText(comment.text); handleClose(); setEditing(true); }}>
                  <View style={[styles.iconWrap, { backgroundColor: 'rgba(50,104,247,0.12)' }]}><Ionicons name="create-outline" size={20} color={COLORS.primary} /></View>
                  <View style={styles.optionText}><Text style={styles.optionLabel}>Edit Comment</Text><Text style={styles.optionSub}>Change your comment</Text></View>
                  <Ionicons name="chevron-forward" size={16} color={COLORS.mutedDark} />
                </Pressable>
                <View style={styles.separator} />
                <Pressable style={styles.optionRow} onPress={() => setConfirmDelete(true)}>
                  <View style={[styles.iconWrap, { backgroundColor: 'rgba(239,68,68,0.12)' }]}><Ionicons name="trash-outline" size={20} color={COLORS.danger} /></View>
                  <View style={styles.optionText}><Text style={[styles.optionLabel, { color: COLORS.danger }]}>Delete Comment</Text><Text style={styles.optionSub}>This action cannot be undone</Text></View>
                  <Ionicons name="chevron-forward" size={16} color={COLORS.mutedDark} />
                </Pressable>
                <Pressable style={styles.cancelBtn} onPress={handleClose}><Text style={styles.cancelText}>Cancel</Text></Pressable>
              </>
            ) : (
              <>
                <View style={styles.handle} />
                <View style={styles.confirmIcon}><Ionicons name="trash" size={32} color={COLORS.danger} /></View>
                <Text style={styles.confirmTitle}>Delete Comment?</Text>
                <Text style={styles.confirmSub}>This comment will be permanently deleted.</Text>
                <Pressable style={styles.deleteBtn} onPress={() => { handleClose(); onDelete(); }}><Text style={styles.deleteBtnText}>Yes, Delete</Text></Pressable>
                <Pressable style={styles.cancelBtn} onPress={() => setConfirmDelete(false)}><Text style={styles.cancelText}>Go Back</Text></Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

/* ════════════════════════════════════════
   REPLY ITEM
════════════════════════════════════════ */
function ReplyItem({ reply, myUserId, onEdit, onDelete }: {
  reply: PostReply; myUserId: string;
  onEdit: (t: string) => void; onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(reply.text);
  const [showOptions, setShowOptions] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isMyReply = reply.authorId === myUserId;
  const handleClose = () => { setShowOptions(false); setConfirmDelete(false); };

  return (
    <View style={styles.replyItem}>
      {editing ? (
        <View>
          <TextInput style={styles.editInput} value={editText} onChangeText={setEditText} multiline autoFocus placeholderTextColor={COLORS.mutedDark} />
          <View style={styles.editActions}>
            <Pressable onPress={() => setEditing(false)}><Text style={styles.cancelEditText}>Cancel</Text></Pressable>
            <Pressable style={styles.saveEditBtn} onPress={() => { onEdit(editText); setEditing(false); }}>
              <Text style={styles.saveEditText}>Save</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <>
          <View style={styles.commentHeader}>
            <Text style={styles.commentAuthor}>{reply.author}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.commentTime}>{reply.createdAtLabel}</Text>
              {isMyReply && (
                <Pressable onPress={() => { setConfirmDelete(false); setShowOptions(true); }} hitSlop={8}>
                  <Ionicons name="ellipsis-horizontal" size={14} color={COLORS.mutedDark} />
                </Pressable>
              )}
            </View>
          </View>
          <Text style={styles.commentText}>{reply.text}</Text>
        </>
      )}
      <Modal visible={showOptions} transparent animationType="fade" onRequestClose={handleClose}>
        <Pressable style={styles.backdrop} onPress={handleClose}>
          <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
            {!confirmDelete ? (
              <>
                <View style={styles.handle} />
                <Text style={styles.sheetTitle}>Reply Options</Text>
                <Pressable style={styles.optionRow} onPress={() => { setEditText(reply.text); handleClose(); setEditing(true); }}>
                  <View style={[styles.iconWrap, { backgroundColor: 'rgba(50,104,247,0.12)' }]}><Ionicons name="create-outline" size={20} color={COLORS.primary} /></View>
                  <View style={styles.optionText}><Text style={styles.optionLabel}>Edit Reply</Text><Text style={styles.optionSub}>Change your reply</Text></View>
                  <Ionicons name="chevron-forward" size={16} color={COLORS.mutedDark} />
                </Pressable>
                <View style={styles.separator} />
                <Pressable style={styles.optionRow} onPress={() => setConfirmDelete(true)}>
                  <View style={[styles.iconWrap, { backgroundColor: 'rgba(239,68,68,0.12)' }]}><Ionicons name="trash-outline" size={20} color={COLORS.danger} /></View>
                  <View style={styles.optionText}><Text style={[styles.optionLabel, { color: COLORS.danger }]}>Delete Reply</Text><Text style={styles.optionSub}>This action cannot be undone</Text></View>
                  <Ionicons name="chevron-forward" size={16} color={COLORS.mutedDark} />
                </Pressable>
                <Pressable style={styles.cancelBtn} onPress={handleClose}><Text style={styles.cancelText}>Cancel</Text></Pressable>
              </>
            ) : (
              <>
                <View style={styles.handle} />
                <View style={styles.confirmIcon}><Ionicons name="trash" size={32} color={COLORS.danger} /></View>
                <Text style={styles.confirmTitle}>Delete Reply?</Text>
                <Text style={styles.confirmSub}>This reply will be permanently deleted.</Text>
                <Pressable style={styles.deleteBtn} onPress={() => { handleClose(); onDelete(); }}><Text style={styles.deleteBtnText}>Yes, Delete</Text></Pressable>
                <Pressable style={styles.cancelBtn} onPress={() => setConfirmDelete(false)}><Text style={styles.cancelText}>Go Back</Text></Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

/* ════════════════════════════════════════
   STYLES
════════════════════════════════════════ */
const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLORS.background },
  header:       { paddingHorizontal: 16, paddingVertical: 8 },
  backButton:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText:     { color: COLORS.text, fontSize: 15 },
  scroll:       { flex: 1 },
  content:      { paddingHorizontal: 20 },
  title:        { color: COLORS.text, fontSize: 30, fontWeight: '700', marginBottom: 14 },

  card:         { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, padding: 14, marginBottom: 14 },
  identityRow:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar:       { width: 56, height: 56, borderRadius: 14, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText:   { color: COLORS.text, fontSize: 22, fontWeight: '700' },
  identityText: { flex: 1 },
  name:         { color: COLORS.text, fontSize: 24, fontWeight: '700' },
  meta:         { color: COLORS.muted, fontSize: 14, marginTop: 2 },
  sectionTitle: { color: COLORS.text, fontSize: 21, fontWeight: '700', marginBottom: 8 },
  infoRow:      { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, gap: 10 },
  label:        { color: COLORS.muted, fontSize: 15 },
  value:        { color: COLORS.text, fontSize: 15, fontWeight: '700', flexShrink: 1, textAlign: 'right' },
  statsRow:     { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  statBox:      { alignItems: 'center', flex: 1 },
  statNumber:   { color: COLORS.text, fontSize: 20, fontWeight: '700' },
  statLabel:    { color: COLORS.muted, fontSize: 13, marginTop: 4 },

  postCard:      { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 18, padding: 18, marginBottom: 16 },
  postHeader:    { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  postAvatar:    { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  postAvatarText:{ color: COLORS.text, fontWeight: '800', fontSize: 16 },
  postAuthor:    { color: COLORS.text, fontWeight: '800', fontSize: 16 },
  postMetaRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' },
  postVehicle:   { color: '#5da0ff', fontSize: 14 },
  postDot:       { color: COLORS.mutedDark, fontSize: 14 },
  postTime:      { color: COLORS.mutedDark, fontSize: 14 },
  postContent:   { color: COLORS.muted, fontSize: 17, lineHeight: 28, marginBottom: 12 },
  tagsRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  tagPill:       { backgroundColor: COLORS.surfaceLight, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  tagText:       { color: COLORS.primary, fontSize: 13, fontWeight: '600' },
  actionsDivider:{ height: 1, backgroundColor: COLORS.divider, marginBottom: 14 },
  actionsRow:    { flexDirection: 'row', alignItems: 'center' },
  actionButton:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginRight: 26 },
  actionText:    { color: COLORS.muted, fontSize: 16 },
  actionTextActive: { color: COLORS.primary, fontWeight: '700' },
  dotsBtn:       { padding: 6 },

  commentsWrap:     { marginTop: 10, gap: 10 },
  commentItem:      { backgroundColor: COLORS.surfaceLight, borderRadius: 12, padding: 10, gap: 6 },
  commentHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  commentAuthor:    { color: COLORS.text, fontSize: 13, fontWeight: '700' },
  commentText:      { color: COLORS.muted, fontSize: 14, lineHeight: 20 },
  commentTime:      { color: COLORS.mutedDark, fontSize: 11 },
  replyTrigger:     { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  replyTriggerText: { color: COLORS.primary, fontSize: 12, fontWeight: '700' },
  repliesWrap:      { marginTop: 8, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: COLORS.primary, gap: 8 },
  replyItem:        { backgroundColor: COLORS.input, borderRadius: 10, padding: 8, gap: 4 },
  editInput:        { backgroundColor: COLORS.input, borderRadius: 10, padding: 10, color: COLORS.text, fontSize: 14, minHeight: 60, marginBottom: 8 },
  editActions:      { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  cancelEditText:   { color: COLORS.muted, fontSize: 13, fontWeight: '700', paddingVertical: 6 },
  saveEditBtn:      { backgroundColor: COLORS.primary, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 6 },
  saveEditText:     { color: COLORS.text, fontSize: 13, fontWeight: '700' },
  commentInputRow:  { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 4 },
  commentInput:     { flex: 1, minHeight: 42, maxHeight: 92, borderRadius: 14, backgroundColor: COLORS.input, color: COLORS.text, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  sendButton:       { width: 42, height: 42, borderRadius: 14, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },

  modalOverlay:    { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop:   { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.58)' },
  composerSheet:   { backgroundColor: COLORS.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 20, paddingTop: 18, borderWidth: 1, borderColor: COLORS.border, maxHeight: '90%' },
  sheetHeader:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  sheetTitle:      { color: COLORS.text, fontSize: 20, fontWeight: '800' },
  closeButton:     { width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.input, alignItems: 'center', justifyContent: 'center' },
  composerInput:   { minHeight: 120, borderRadius: 16, backgroundColor: COLORS.input, color: COLORS.text, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, lineHeight: 23, marginBottom: 14 },
  sheetLabel:      { color: COLORS.muted, fontSize: 14, fontWeight: '700', marginBottom: 10 },
  tagsInput:       { height: 44, borderRadius: 12, backgroundColor: COLORS.input, color: COLORS.text, paddingHorizontal: 12, fontSize: 14, marginBottom: 14 },
  publishButton:         { height: 54, borderRadius: 17, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  publishButtonDisabled: { opacity: 0.45 },
  publishButtonText:     { color: COLORS.text, fontSize: 17, fontWeight: '800' },

  backdrop:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet:        { backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 36, borderWidth: 1, borderColor: COLORS.border },
  handle:       { width: 40, height: 4, backgroundColor: COLORS.mutedDark, borderRadius: 2, alignSelf: 'center', marginBottom: 20, opacity: 0.5 },
  optionRow:    { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
  iconWrap:     { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  optionText:   { flex: 1 },
  optionLabel:  { color: COLORS.text, fontSize: 15, fontWeight: '700' },
  optionSub:    { color: COLORS.mutedDark, fontSize: 12, marginTop: 2 },
  separator:    { height: 1, backgroundColor: COLORS.divider, marginVertical: 4 },
  cancelBtn:    { marginTop: 16, height: 50, borderRadius: 14, backgroundColor: COLORS.surfaceLight, alignItems: 'center', justifyContent: 'center' },
  cancelText:   { color: COLORS.muted, fontSize: 15, fontWeight: '700' },
  confirmIcon:  { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(239,68,68,0.12)', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16 },
  confirmTitle: { color: COLORS.text, fontSize: 20, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  confirmSub:   { color: COLORS.mutedDark, fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  deleteBtn:    { height: 50, borderRadius: 14, backgroundColor: COLORS.danger, alignItems: 'center', justifyContent: 'center' },
  deleteBtnText:{ color: COLORS.text, fontSize: 15, fontWeight: '800' },

  logoutButton:  { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: 'rgba(239,68,68,0.08)' },
  logoutText:    { color: COLORS.danger, fontSize: 14, fontWeight: '600' },
  logoutOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', zIndex: 999 },
  logoutBox:     { width: '80%', backgroundColor: COLORS.surface, padding: 24, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border },
  modalBtn:      { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
});
