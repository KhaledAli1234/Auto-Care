import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
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
import { LinearGradient } from "expo-linear-gradient";

import { BottomNavbar } from "@/components/bottom-navbar";
import { useUserProfile } from "@/context/user-profile-context";
import { authHeaders, apiGet, apiPost, apiPatch, apiDelete } from '@/constants/api-client';
import { NotificationBell } from "@/components/notification-bell";
import { useAppTheme, useThemeColors } from "@/context/theme-context";

type ThemeColors = ReturnType<typeof useThemeColors>;

/* ════════════════════════════════════════
   TYPES
════════════════════════════════════════ */
type BrandFilter   = "All" | "Toyota" | "BMW" | "Honda" | "Kia" | "Ford";
type Availability  = "public" | "friends" | "onlyMe";
type AllowComments = "allow" | "disable";

interface ApiReply {
  _id: string; id?: string;
  createdBy: string | { _id: string; firstName?: string; lastName?: string; username?: string };
  content: string; createdAt?: string;
}
interface ApiComment {
  _id: string; id?: string;
  createdBy: string | { _id: string; firstName?: string; lastName?: string; username?: string };
  content: string; createdAt?: string; replies?: ApiReply[];
}
interface ApiPost {
  _id?: string; id: string;
  createdBy: string | { _id: string; firstName?: string; lastName?: string; username?: string; car?: string; vehicle?: string; carModel?: string; vehicleId?: any };
  content: string; status: string; attachments: string[]; tags: string[];
  likes: string[]; availability: Availability; allowComments: AllowComments;
  createdAt: string; updatedAt: string; comments?: ApiComment[];
  isFollowing?: boolean;
}

interface PostRating {
  average: number;
  count:   number;
  myRating: number;
}

interface CommunityReply {
  id: string; author: string; authorId: string;
  text: string; createdAtLabel: string; pending?: boolean;
}
interface CommunityComment {
  id: string; author: string; authorId: string;
  text: string; createdAtLabel: string; replies: CommunityReply[]; pending?: boolean;
}
interface CommunityPost {
  id: string; author: string; authorId: string; initials: string;
  vehicle: string; createdAtLabel: string; content: string; tags: string[];
  allowComments: AllowComments; availability: Availability; images: string[];
  likes: number; comments: CommunityComment[];
  likedByMe: boolean; followedAuthor: boolean; pending?: boolean;
  rating: PostRating;
}

/* ════════════════════════════════════════
   CONSTANTS
════════════════════════════════════════ */
const BRAND_FILTERS: BrandFilter[] = ["All","Toyota","BMW","Honda","Kia","Ford"];
const AVAIL_OPTIONS: { value: Availability; label: string; icon: string }[] = [
  { value: "public",  label: "Public",  icon: "globe-outline" },
  { value: "friends", label: "Friends", icon: "people-outline" },
  { value: "onlyMe",  label: "Only Me", icon: "lock-closed-outline" },
];
const DEFAULT_RATING: PostRating = { average: 0, count: 0, myRating: 0 };

/* ════════════════════════════════════════
   HELPERS
════════════════════════════════════════ */
function getInitials(name: string) {
  const n = name.trim(); if (!n) return "U";
  const p = n.split(/\s+/);
  return `${p[0][0] ?? ""}${p[1]?.[0] ?? ""}`.toUpperCase();
}
function getUserName(full?: string) { return full?.trim() || "You"; }
function formatCreatedAt(dateStr?: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr), now = new Date();
  const m = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (m < 1)  return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
function resolveAuthorId(createdBy: ApiPost["createdBy"]): string {
  if (!createdBy) return "";
  return typeof createdBy === "string" ? createdBy : createdBy._id || "";
}
function resolveAuthorName(createdBy: ApiComment["createdBy"] | null, myUserId: string, myName: string): string {
  if (!createdBy) return "Deleted User";
  if (typeof createdBy === "string") return createdBy === myUserId ? myName : "User";
  if (createdBy.username) return createdBy.username;
  const full = `${createdBy.firstName ?? ""} ${createdBy.lastName ?? ""}`.trim();
  if (full) return full;
  return createdBy._id === myUserId ? myName : "User";
}
function resolveAuthorVehicle(createdBy: ApiPost["createdBy"]): string {
  if (typeof createdBy === "string") return "";
  const v = (createdBy as any).vehicleId;
  if (!v) return "";
  return [v.brand, v.model, v.year].filter(Boolean).join(" ");
}
function normalizeComment(c: ApiComment, myUserId: string, myName: string): CommunityComment {
  return {
    id: c._id ?? c.id ?? "", author: resolveAuthorName(c.createdBy, myUserId, myName),
    authorId: resolveAuthorId(c.createdBy), text: c.content ?? "",
    createdAtLabel: formatCreatedAt(c.createdAt),
    replies: (c.replies ?? []).map(r => ({
      id: r._id ?? r.id ?? "", author: resolveAuthorName(r.createdBy, myUserId, myName),
      authorId: resolveAuthorId(r.createdBy), text: r.content ?? "",
      createdAtLabel: formatCreatedAt(r.createdAt),
    })),
  };
}
function normalizePost(p: ApiPost, myUserId: string, myName: string, followedAuthorIds: Set<string>, myVehicle?: string): CommunityPost {
  const authorId = resolveAuthorId(p.createdBy);
  return {
    id: p._id ?? p.id ?? "", author: resolveAuthorName(p.createdBy, myUserId, myName),
    authorId, initials: getInitials(resolveAuthorName(p.createdBy, myUserId, myName)),
    vehicle: authorId === myUserId ? (myVehicle ?? "") : resolveAuthorVehicle(p.createdBy),
    createdAtLabel: formatCreatedAt(p.createdAt), content: p.content ?? "",
    tags: p.tags ?? [], allowComments: p.allowComments ?? "allow",
    availability: p.availability ?? "public", images: p.attachments ?? [],
    likes: Array.isArray(p.likes) ? p.likes.length : 0,
    likedByMe: Array.isArray(p.likes) ? p.likes.includes(myUserId) : false,
    comments: (p.comments ?? []).map(c => normalizeComment(c, myUserId, myName)),
    followedAuthor: p.isFollowing ?? followedAuthorIds.has(authorId),
    pending: false,
    rating: DEFAULT_RATING,
  };
}

export default function CommunityScreen() {
  const insets = useSafeAreaInsets();
  const C = useThemeColors();
  const { isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(C), [C]);
  const { profile } = useUserProfile();
  const [myUserId, setMyUserId] = useState("");
  const [activeFilter, setActiveFilter] = useState<BrandFilter>("All");
  const [posts, setPosts]       = useState<CommunityPost[]>([]);
  const [loading, setLoading]   = useState(true);
  const [page, setPage]         = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [followedAuthorIds, setFollowedAuthorIds] = useState<Set<string>>(new Set());

  // composer
  const [composerVisible,      setComposerVisible]      = useState(false);
  const [newPostText,          setNewPostText]          = useState("");
  const [newPostTags,          setNewPostTags]          = useState("");
  const [newPostAllowComments, setNewPostAllowComments] = useState<AllowComments>("allow");
  const [newPostAvailability,  setNewPostAvailability]  = useState<Availability>("public");
  const [publishing,           setPublishing]           = useState(false);

  // edit post
  const [editPostId,   setEditPostId]   = useState<string | null>(null);
  const [editPostText, setEditPostText] = useState("");
  const [editPostTags, setEditPostTags] = useState("");
  const [saving,       setSaving]       = useState(false);

  const myName    = getUserName(`${profile.user?.firstName ?? ""} ${profile.user?.lastName ?? ""}`.trim());
  const myVehicle = profile.vehicle
    ? [profile.vehicle.brand, profile.vehicle.model, profile.vehicle.year].filter(Boolean).join(" ")
    : "";
  const [myRole, setMyRole] = useState<'user' | 'admin'>('user');

  useEffect(() => {
    AsyncStorage.getItem('access_token').then(raw => {
      try {
        const token   = raw?.replace(/"/g, '') ?? '';
        const payload = JSON.parse(atob(token.split('.')[1]));
        setMyRole(payload.role === 'admin' ? 'admin' : 'user');
      } catch { setMyRole('user'); }
    });
  }, []);

  useEffect(() => {
    AsyncStorage.getItem("userId").then(id => setMyUserId(id?.replace(/"/g, "") ?? ""));
  }, []);

  /* ── fetch posts ── */
  const fetchPosts = useCallback(async (pageNum = 1, replace = true) => {
    try {
      pageNum === 1 ? setLoading(true) : setLoadingMore(true);
      const data = await apiGet(`/posts?page=${pageNum}&size=10`);
      const uid  = await AsyncStorage.getItem("userId").then(v => v?.replace(/"/g, "") ?? "");

      const result: ApiPost[] = (data?.data?.posts?.result ?? [])
        .filter((p: ApiPost) => p.status === "approved")
        .sort((a: ApiPost, b: ApiPost) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setFollowedAuthorIds(prev => {
        const newFollowedIds = new Set(prev);
        result.forEach(p => {
          const aid = resolveAuthorId(p.createdBy);
          if (p.isFollowing === true)  newFollowedIds.add(aid);
          if (p.isFollowing === false && !prev.has(aid)) newFollowedIds.delete(aid);
        });

        const normalized = result.map(p => normalizePost(p, uid, myName, newFollowedIds, myVehicle));
        setPosts(cur => replace ? normalized : [...cur, ...normalized]);

        return newFollowedIds;
      });

      setTotalPages(data?.data?.posts?.pages ?? 1);
      setPage(pageNum);
    } catch (err) { console.log("fetchPosts error:", err); }
    finally { setLoading(false); setLoadingMore(false); }
  }, [myName, myVehicle]);

  useEffect(() => { fetchPosts(1); }, [fetchPosts]);

  useEffect(() => {
    setPosts(cur => cur.map(p => ({ ...p, followedAuthor: followedAuthorIds.has(p.authorId) })));
  }, [followedAuthorIds]);

  const filteredPosts = useMemo(() => {
    if (activeFilter === "All") return posts;
    return posts.filter(p => p.vehicle.toLowerCase().includes(activeFilter.toLowerCase()));
  }, [activeFilter, posts]);

  /* ── rating helpers ── */
  const fetchRating = useCallback(async (postId: string) => {
    try {
      const data = await apiGet(`/posts/${postId}/rating`);
      const r: PostRating = data?.data ?? DEFAULT_RATING;
      setPosts(cur => cur.map(p => p.id !== postId ? p : { ...p, rating: r }));
    } catch { /* silent */ }
  }, []);

  const handleRate = useCallback(async (postId: string, value: number) => {
    setPosts(cur => cur.map(p => {
      if (p.id !== postId) return p;
      const wasRated  = p.rating.myRating > 0;
      const prevCount = p.rating.count;
      const prevSum   = p.rating.average * prevCount;
      const newCount  = wasRated ? prevCount : prevCount + 1;
      const newSum    = wasRated ? prevSum - p.rating.myRating + value : prevSum + value;
      const newAvg    = newCount > 0 ? Math.round((newSum / newCount) * 10) / 10 : 0;
      return { ...p, rating: { average: newAvg, count: newCount, myRating: value } };
    }));
    try {
      await apiPost(`/posts/${postId}/rate`, { value });
    } catch (err) {
      fetchRating(postId);
      console.log("rate error:", err);
    }
  }, [fetchRating]);

  /* ════════ POST HANDLERS ════════ */
  const handleToggleLike = async (postId: string, likedByMe: boolean) => {
    if (posts.find(p => p.id === postId)?.pending) return;
    setPosts(cur => cur.map(p => p.id !== postId ? p : {
      ...p, likedByMe: !likedByMe, likes: !likedByMe ? p.likes + 1 : Math.max(0, p.likes - 1),
    }));
    try {
      await apiPatch(`/posts/${postId}/like?action=${likedByMe ? "unlike" : "like"}`);
    } catch (err) {
      setPosts(cur => cur.map(p => p.id !== postId ? p : {
        ...p, likedByMe, likes: likedByMe ? p.likes + 1 : Math.max(0, p.likes - 1),
      }));
    }
  };

  const handleToggleFollow = async (postId: string, authorId: string, followedAuthor: boolean) => {
    if (posts.find(p => p.id === postId)?.pending) return;
    setFollowedAuthorIds(prev => {
      const next = new Set(prev);
      if (followedAuthor) next.delete(authorId); else next.add(authorId);
      return next;
    });
    try {
      if (followedAuthor) await apiDelete(`/follow/${authorId}`);
      else await apiPost(`/follow/${authorId}`);
    } catch {
      setFollowedAuthorIds(prev => {
        const next = new Set(prev);
        if (followedAuthor) next.add(authorId); else next.delete(authorId);
        return next;
      });
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (posts.find(p => p.id === postId)?.pending) return;
    setPosts(cur => cur.filter(p => p.id !== postId));
    try { await apiDelete(`/posts/${postId}`); }
    catch { fetchPosts(1); }
  };

  const handleOpenEditPost = (post: CommunityPost) => {
    setEditPostId(post.id); setEditPostText(post.content);
    setEditPostTags(post.tags.join(", "));
  };

  const handleSaveEditPost = async () => {
    if (!editPostId || !editPostText.trim()) return;
    setSaving(true);
    const cur2 = posts.find(p => p.id === editPostId);
    const newTags = editPostTags.split(",").map(t => t.trim()).filter(Boolean);
    const prevContent = cur2?.content ?? "", prevTags = cur2?.tags ?? [];
    setPosts(cur => cur.map(p => p.id !== editPostId ? p : { ...p, content: editPostText.trim(), tags: newTags }));
    try {
      await apiPatch(`/posts/${editPostId}`, {
        content: editPostText.trim(), tags: newTags,
        allowComments: cur2?.allowComments ?? "allow",
        availability:  cur2?.availability  ?? "public",
      });
      setEditPostId(null); setEditPostText(""); setEditPostTags("");
    } catch {
      setPosts(cur => cur.map(p => p.id !== editPostId ? p : { ...p, content: prevContent, tags: prevTags }));
    } finally { setSaving(false); }
  };

  /* ════════ COMMENT HANDLERS ════════ */
  const handleAddComment = async (postId: string, text: string) => {
    if (!text.trim() || posts.find(p => p.id === postId)?.pending) return;
    const tempId = `temp-c-${Date.now()}`;
    const author = getUserName(`${profile.user?.firstName ?? ""} ${profile.user?.lastName ?? ""}`);
    setPosts(cur => cur.map(p => p.id !== postId ? p : {
      ...p, comments: [...p.comments, { id: tempId, author, authorId: myUserId, text: text.trim(), createdAtLabel: "Just now", replies: [], pending: true }],
    }));
    try {
      const data   = await apiPost(`/comments/${postId}`, { content: text.trim() });
      const saved: ApiComment | null = data?.data?.comment ?? data?.data?.result ?? data?.data ?? null;
      if (saved && (saved._id || saved.id)) {
        setPosts(cur => cur.map(p => p.id !== postId ? p : {
          ...p, comments: p.comments.map(c => c.id !== tempId ? c : normalizeComment(saved, myUserId, myName)),
        }));
      } else {
        setPosts(cur => cur.map(p => p.id !== postId ? p : {
          ...p, comments: p.comments.map(c => c.id !== tempId ? c : { ...c, pending: false }),
        }));
      }
    } catch {
      setPosts(cur => cur.map(p => p.id !== postId ? p : { ...p, comments: p.comments.filter(c => c.id !== tempId) }));
    }
  };

  const handleEditComment = async (postId: string, commentId: string, text: string) => {
    const target = posts.find(p => p.id === postId)?.comments.find(c => c.id === commentId);
    if (target?.pending) return;
    const prev = target?.text ?? "";
    setPosts(cur => cur.map(p => p.id !== postId ? p : { ...p, comments: p.comments.map(c => c.id !== commentId ? c : { ...c, text }) }));
    try { await apiPatch(`/comments/${commentId}`, { content: text }); }
    catch { setPosts(cur => cur.map(p => p.id !== postId ? p : { ...p, comments: p.comments.map(c => c.id !== commentId ? c : { ...c, text: prev }) })); }
  };

  const handleDeleteComment = async (postId: string, commentId: string) => {
    const target = posts.find(p => p.id === postId)?.comments.find(c => c.id === commentId);
    if (target?.pending) return;
    const prev = posts.find(p => p.id === postId)?.comments ?? [];
    setPosts(cur => cur.map(p => p.id !== postId ? p : { ...p, comments: p.comments.filter(c => c.id !== commentId) }));
    try { await apiDelete(`/comments/${commentId}`); }
    catch { setPosts(cur => cur.map(p => p.id !== postId ? p : { ...p, comments: prev })); }
  };

  /* ════════ REPLY HANDLERS ════════ */
  const handleAddReply = async (postId: string, commentId: string, text: string) => {
    if (!text.trim()) return;
    const tPost = posts.find(p => p.id === postId), tCom = tPost?.comments.find(c => c.id === commentId);
    if (tPost?.pending || tCom?.pending) return;
    const tempId = `temp-r-${Date.now()}`;
    setPosts(cur => cur.map(p => p.id !== postId ? p : {
      ...p, comments: p.comments.map(c => c.id !== commentId ? c : {
        ...c, replies: [...c.replies, { id: tempId, author: myName, authorId: myUserId, text: text.trim(), createdAtLabel: "Just now", pending: true }],
      }),
    }));
    try {
      const data = await apiPost(`/comments/${postId}/${commentId}/reply`, { content: text.trim() });
      const saved: ApiReply | null = data?.data?.reply ?? data?.data?.comment ?? data?.data ?? null;
      if (saved && (saved._id || saved.id)) {
        setPosts(cur => cur.map(p => p.id !== postId ? p : {
          ...p, comments: p.comments.map(c => c.id !== commentId ? c : {
            ...c, replies: c.replies.map(r => r.id !== tempId ? r : {
              id: saved._id ?? saved.id ?? tempId, author: resolveAuthorName(saved.createdBy, myUserId, myName),
              authorId: resolveAuthorId(saved.createdBy), text: saved.content ?? text,
              createdAtLabel: formatCreatedAt(saved.createdAt), pending: false,
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
        ...p, comments: p.comments.map(c => c.id !== commentId ? c : { ...c, replies: c.replies.filter(r => r.id !== tempId) }),
      }));
    }
  };

  const handleEditReply = async (postId: string, commentId: string, replyId: string, text: string) => {
    const prev = posts.find(p => p.id === postId)?.comments.find(c => c.id === commentId)?.replies.find(r => r.id === replyId)?.text ?? "";
    setPosts(cur => cur.map(p => p.id !== postId ? p : {
      ...p, comments: p.comments.map(c => c.id !== commentId ? c : { ...c, replies: c.replies.map(r => r.id !== replyId ? r : { ...r, text }) }),
    }));
    try { await apiPatch(`/comments/${commentId}/replies/${replyId}`, { content: text }); }
    catch { setPosts(cur => cur.map(p => p.id !== postId ? p : {
      ...p, comments: p.comments.map(c => c.id !== commentId ? c : { ...c, replies: c.replies.map(r => r.id !== replyId ? r : { ...r, text: prev }) }),
    })); }
  };

  const handleDeleteReply = async (postId: string, commentId: string, replyId: string) => {
    const prev = posts.find(p => p.id === postId)?.comments.find(c => c.id === commentId)?.replies ?? [];
    setPosts(cur => cur.map(p => p.id !== postId ? p : {
      ...p, comments: p.comments.map(c => c.id !== commentId ? c : { ...c, replies: c.replies.filter(r => r.id !== replyId) }),
    }));
    try { await apiDelete(`/comments/${commentId}/replies/${replyId}`); }
    catch { setPosts(cur => cur.map(p => p.id !== postId ? p : {
      ...p, comments: p.comments.map(c => c.id !== commentId ? c : { ...c, replies: prev }),
    })); }
  };

  /* ════════ CREATE POST ════════ */
  const handleCreatePost = async () => {
    const trimmed = newPostText.trim(); if (!trimmed) return;
    setPublishing(true);
    const uid    = await AsyncStorage.getItem("userId").then(v => v?.replace(/"/g, "") ?? "");
    const author = getUserName(`${profile.user?.firstName ?? ""} ${profile.user?.lastName ?? ""}`);
    const tags   = newPostTags.split(",").map(t => t.trim()).filter(Boolean);
    const tempId = `temp-post-${Date.now()}`;
    const payload = { content: trimmed, tags, allowComments: newPostAllowComments, availability: newPostAvailability };
    const optimistic: CommunityPost = {
      id: tempId, author, authorId: uid, initials: getInitials(author), vehicle: myVehicle,
      createdAtLabel: "Just now", content: trimmed, tags, allowComments: newPostAllowComments,
      availability: newPostAvailability, images: [], likes: 0, likedByMe: false, comments: [],
      followedAuthor: false, pending: true, rating: DEFAULT_RATING,
    };
    setPosts(cur => [optimistic, ...cur]);
    setNewPostText(""); setNewPostTags(""); setNewPostAllowComments("allow");
    setNewPostAvailability("public"); setComposerVisible(false);
    try {
      const data = await apiPost("/posts", payload);
      const saved: ApiPost | null = data?.data?.post ?? data?.data?.result ?? data?.data ?? null;
      if (saved && (saved._id || saved.id)) {
        if (myRole === 'admin') {
          const postId = saved._id ?? saved.id;
          await apiPatch(`/posts/${postId}/approve`);
          saved.status = 'approved';
        }
        setPosts(cur => cur.map(p => p.id !== tempId ? p : normalizePost(saved, uid, myName, followedAuthorIds, myVehicle)));
      } else {
        setPosts(cur => cur.filter(p => p.id !== tempId));
      }
    } catch { setPosts(cur => cur.filter(p => p.id !== tempId)); }
    finally { setPublishing(false); }
  };

  /* ════════════════════════════════════════
     RENDER
  ════════════════════════════════════════ */
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Same gradient as sign-in - Dark Mode only */}
      {isDark && (
        <LinearGradient
          colors={['#0f2040', '#0d1a35', '#0a1225', '#080A0F']}
          locations={[0, 0.25, 0.55, 1]}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
      )}

      <View style={styles.header}>
        <Text style={styles.title}>
          Auto<Text style={styles.titleAccent}>Care</Text>
          <Text style={styles.titleSub}> · Community</Text>
        </Text>
        <View style={styles.headerActions}>
          <NotificationBell iconSize={20} color={C.text} />
          <Pressable style={styles.headerIcon} hitSlop={10} onPress={() => router.push("/account")}>
            <Ionicons name="person-outline" size={20} color={C.text} />
          </Pressable>
        </View>
      </View>

      <View style={styles.divider} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 108 }]}
        showsVerticalScrollIndicator={false}
        onScroll={({ nativeEvent }) => {
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
          if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 60 && !loadingMore && page < totalPages)
            fetchPosts(page + 1, false);
        }}
        scrollEventThrottle={400}
      >
        <Pressable style={styles.createButton} onPress={() => setComposerVisible(true)}>
          <Ionicons name="add" size={26} color={C.text} />
          <Text style={styles.createButtonText}>Create Post</Text>
        </Pressable>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}>
          {BRAND_FILTERS.map(brand => (
            <Pressable key={brand} style={[styles.filterPill, brand === activeFilter && styles.filterPillActive]} onPress={() => setActiveFilter(brand)}>
              <Text style={[styles.filterText, brand === activeFilter && styles.filterTextActive]}>{brand}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {loading ? (
          <ActivityIndicator color={C.primarySoft} size="large" style={{ marginTop: 40 }} />
        ) : filteredPosts.length > 0 ? (
          <>
            {filteredPosts.map(post => (
              <CommunityPostCard
                key={post.id} post={post} myUserId={myUserId}
                onToggleLike={()            => handleToggleLike(post.id, post.likedByMe)}
                onToggleFollow={()          => handleToggleFollow(post.id, post.authorId, post.followedAuthor)}
                onAddComment={t            => handleAddComment(post.id, t)}
                onEditComment={(cId, t)    => handleEditComment(post.id, cId, t)}
                onDeleteComment={cId       => handleDeleteComment(post.id, cId)}
                onAddReply={(cId, t)       => handleAddReply(post.id, cId, t)}
                onEditReply={(cId, rId, t) => handleEditReply(post.id, cId, rId, t)}
                onDeleteReply={(cId, rId)  => handleDeleteReply(post.id, cId, rId)}
                onEdit={()                 => handleOpenEditPost(post)}
                onDelete={()               => handleDeletePost(post.id)}
                onMounted={()              => fetchRating(post.id)}
                onRate={v                  => handleRate(post.id, v)}
              />
            ))}
            {loadingMore && <ActivityIndicator color={C.primarySoft} style={{ marginVertical: 16 }} />}
          </>
        ) : (
          <View style={styles.emptyCard}>
            <Ionicons name="chatbubbles-outline" size={34} color={C.mutedDark} />
            <Text style={styles.emptyTitle}>No posts yet</Text>
            <Text style={styles.emptyText}>Be the first one to share a post{activeFilter !== "All" ? ` for ${activeFilter} owners` : ""}.</Text>
          </View>
        )}
      </ScrollView>

      <BottomNavbar activeTab="community" />

      {/* CREATE POST MODAL */}
      <Modal visible={composerVisible} transparent animationType="slide" onRequestClose={() => setComposerVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setComposerVisible(false)} />
          <View style={[styles.composerSheet, { paddingBottom: insets.bottom + 18 }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Create Post</Text>
              <Pressable style={styles.closeButton} onPress={() => setComposerVisible(false)} hitSlop={10}>
                <Ionicons name="close" size={22} color={C.text} />
              </Pressable>
            </View>
            <View style={styles.composerIdentityRow}>
              <View style={styles.avatarSmall}>
                <Text style={styles.avatarTextSmall}>{getInitials(myName)}</Text>
              </View>
              <View>
                <Text style={styles.composerName}>{myName}</Text>
                <Text style={styles.composerMeta}>Share with community</Text>
              </View>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <TextInput style={styles.composerInput} placeholder="Write your post..." placeholderTextColor={C.mutedDark} value={newPostText} onChangeText={setNewPostText} multiline textAlignVertical="top" />
              <Text style={styles.sheetLabel}>Tags (comma separated)</Text>
              <TextInput style={styles.tagsInput} placeholder="e.g. oil, maintenance, tips" placeholderTextColor={C.mutedDark} value={newPostTags} onChangeText={setNewPostTags} />
              <Text style={styles.sheetLabel}>Comments</Text>
              <View style={styles.toggleRow}>
                {(["allow","disable"] as AllowComments[]).map(opt => (
                  <Pressable key={opt} style={[styles.togglePill, newPostAllowComments === opt && styles.togglePillActive]} onPress={() => setNewPostAllowComments(opt)}>
                    <Ionicons name={opt === "allow" ? "chatbubble-outline" : "chatbubble-ellipses-outline"} size={13} color={newPostAllowComments === opt ? C.text : C.muted} />
                    <Text style={[styles.toggleText, newPostAllowComments === opt && styles.toggleTextActive]}>{opt === "allow" ? "Allow" : "Disable"}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.sheetLabel}>Visibility</Text>
              <View style={styles.toggleRow}>
                {AVAIL_OPTIONS.map(opt => (
                  <Pressable key={opt.value} style={[styles.togglePill, newPostAvailability === opt.value && styles.togglePillActive]} onPress={() => setNewPostAvailability(opt.value)}>
                    <Ionicons name={opt.icon as any} size={13} color={newPostAvailability === opt.value ? C.text : C.muted} />
                    <Text style={[styles.toggleText, newPostAvailability === opt.value && styles.toggleTextActive]}>{opt.label}</Text>
                  </Pressable>
                ))}
              </View>
              <Pressable style={[styles.publishButton, (!newPostText.trim() || publishing) && styles.publishButtonDisabled]} onPress={handleCreatePost} disabled={!newPostText.trim() || publishing}>
                {publishing ? <ActivityIndicator color={C.text} size="small" /> : <Text style={styles.publishButtonText}>Publish</Text>}
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* EDIT POST MODAL */}
      <Modal visible={!!editPostId} transparent animationType="slide" onRequestClose={() => setEditPostId(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setEditPostId(null)} />
          <View style={[styles.composerSheet, { paddingBottom: insets.bottom + 18 }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Edit Post</Text>
              <Pressable style={styles.closeButton} onPress={() => setEditPostId(null)} hitSlop={10}>
                <Ionicons name="close" size={22} color={C.text} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <TextInput style={styles.composerInput} value={editPostText} onChangeText={setEditPostText} multiline textAlignVertical="top" placeholderTextColor={C.mutedDark} />
              <Text style={styles.sheetLabel}>Tags (comma separated)</Text>
              <TextInput style={styles.tagsInput} placeholder="e.g. oil, maintenance, tips" placeholderTextColor={C.mutedDark} value={editPostTags} onChangeText={setEditPostTags} />
              <Pressable style={[styles.publishButton, (!editPostText.trim() || saving) && styles.publishButtonDisabled]} onPress={handleSaveEditPost} disabled={!editPostText.trim() || saving}>
                {saving ? <ActivityIndicator color={C.text} size="small" /> : <Text style={styles.publishButtonText}>Save Changes</Text>}
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

/* ════════════════════════════════════════
   STAR RATING COMPONENT
════════════════════════════════════════ */
function StarRating({
  rating, postId, isMyPost, isPending, onRate,
}: {
  rating: PostRating; postId: string; isMyPost: boolean; isPending: boolean;
  onRate: (value: number) => void;
}) {
  const C = useThemeColors();
  const starStyles = useMemo(() => createStarStyles(C), [C]);
  const canRate = !isMyPost && !isPending;

  return (
    <View style={starStyles.wrap}>
      <View style={starStyles.starsRow}>
        {[1, 2, 3, 4, 5].map(star => {
          const myR    = rating.myRating;
          const isMine = myR > 0 && star <= myR;
          const isAvg  = myR === 0 && star <= Math.round(rating.average);
          const filled = isMine || isAvg;
          return (
            <Pressable
              key={star}
              onPress={() => canRate && onRate(star)}
              hitSlop={4}
              style={({ pressed }) => [starStyles.star, pressed && canRate && { opacity: 0.6 }]}
              disabled={!canRate}
            >
              <Ionicons
                name={filled ? "star" : "star-outline"}
                size={18}
                color={isMine ? C.star : filled ? `${C.star}99` : C.starEmpty}
              />
            </Pressable>
          );
        })}
      </View>

      <View style={starStyles.info}>
        {rating.count > 0 ? (
          <>
            <Text style={starStyles.avg}>{rating.average.toFixed(1)}</Text>
            <Text style={starStyles.count}>({rating.count})</Text>
          </>
        ) : (
          <Text style={starStyles.noRating}>{isMyPost ? "No ratings yet" : "Be the first to rate"}</Text>
        )}
        {rating.myRating > 0 && (
          <View style={starStyles.myBadge}>
            <Text style={starStyles.myBadgeText}>Your rating: {rating.myRating}★</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const createStarStyles = (C: ThemeColors) => StyleSheet.create({
  wrap:        { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12, marginBottom: 4 },
  starsRow:    { flexDirection: "row", alignItems: "center", gap: 3 },
  star:        { padding: 2 },
  info:        { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  avg:         { color: C.star, fontSize: 14, fontWeight: "700" },
  count:       { color: C.mutedDark, fontSize: 13 },
  noRating:    { color: C.mutedDark, fontSize: 12 },
  myBadge:     { backgroundColor: "rgba(245,158,11,0.12)", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: "rgba(245,158,11,0.3)" },
  myBadgeText: { color: C.star, fontSize: 11, fontWeight: "700" },
});

/* ════════════════════════════════════════
   POST CARD
════════════════════════════════════════ */
function CommunityPostCard({
  post, myUserId,
  onToggleLike, onToggleFollow,
  onAddComment, onEditComment, onDeleteComment,
  onAddReply, onEditReply, onDeleteReply,
  onEdit, onDelete,
  onMounted, onRate,
}: {
  post: CommunityPost; myUserId: string;
  onToggleLike: () => void; onToggleFollow: () => void;
  onAddComment:    (t: string) => void;
  onEditComment:   (cId: string, t: string) => void;
  onDeleteComment: (cId: string) => void;
  onAddReply:    (cId: string, t: string) => void;
  onEditReply:   (cId: string, rId: string, t: string) => void;
  onDeleteReply: (cId: string, rId: string) => void;
  onEdit: () => void; onDelete: () => void;
  onMounted: () => void;
  onRate: (value: number) => void;
}) {
  const C = useThemeColors();
  const styles = useMemo(() => createStyles(C), [C]);
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [commentText,     setCommentText]     = useState("");
  const [showOptions,     setShowOptions]     = useState(false);
  const [confirmDelete,   setConfirmDelete]   = useState(false);
  const isMyPost  = post.authorId === myUserId;
  const isPending = !!post.pending;

  useEffect(() => { if (!isPending) onMounted(); }, [post.id]);

  const availIcon = post.availability === "public" ? "globe-outline" : post.availability === "friends" ? "people-outline" : "lock-closed-outline";
  const handleSendComment = () => { if (!commentText.trim()) return; onAddComment(commentText); setCommentText(""); setCommentsVisible(true); };
  const handleCloseOptions = () => { setShowOptions(false); setConfirmDelete(false); };

  return (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{post.initials}</Text></View>
        <View style={styles.postIdentity}>
          <View style={styles.authorRow}>
            <Text style={styles.author}>{post.author}</Text>
            {isPending && <View style={styles.pendingBadge}><Text style={styles.pendingText}>Pending approval</Text></View>}
            {!isMyPost && !isPending && (
              <Pressable style={[styles.followBtn, post.followedAuthor && styles.followBtnActive]} onPress={onToggleFollow}>
                <Ionicons name={post.followedAuthor ? "checkmark" : "person-add-outline"} size={12} color={post.followedAuthor ? C.text : C.primarySoft} />
                <Text style={[styles.followText, post.followedAuthor && styles.followTextActive]}>{post.followedAuthor ? "Following" : "Follow"}</Text>
              </Pressable>
            )}
          </View>
          <View style={styles.metaRow}>
            {!!post.vehicle && <><Text style={styles.vehicle}>{post.vehicle}</Text><Text style={styles.dot}>•</Text></>}
            <Text style={styles.time}>{post.createdAtLabel}</Text>
            <Text style={styles.dot}>•</Text>
            <Ionicons name={availIcon as any} size={12} color={C.mutedDark} />
          </View>
        </View>
        {isMyPost && !isPending && (
          <Pressable onPress={() => { setConfirmDelete(false); setShowOptions(true); }} hitSlop={12} style={styles.dotsBtn}>
            <Ionicons name="ellipsis-horizontal" size={20} color={C.muted} />
          </Pressable>
        )}
      </View>

      <Text style={styles.postText}>{post.content}</Text>

      {post.tags.length > 0 && (
        <View style={styles.tagsRow}>
          {post.tags.map(tag => <View key={tag} style={styles.tagPill}><Text style={styles.tagText}>#{tag}</Text></View>)}
        </View>
      )}

      {post.images.length > 0 && (
        <View style={[styles.imagesGrid, post.images.length > 1 && styles.imagesGridTwo]}>
          {post.images.slice(0, 2).map(uri => <Image key={uri} source={{ uri }} style={styles.postImage} resizeMode="cover" />)}
        </View>
      )}

      {!isPending && (
        <StarRating
          rating={post.rating}
          postId={post.id}
          isMyPost={isMyPost}
          isPending={isPending}
          onRate={onRate}
        />
      )}

      <View style={styles.actionsDivider} />

      <View style={[styles.actionsRow, isPending && { opacity: 0.4 }]}>
        <Pressable style={styles.actionButton} onPress={onToggleLike} disabled={isPending}>
          <Ionicons name={post.likedByMe ? "heart" : "heart-outline"} size={25} color={post.likedByMe ? C.primarySoft : C.muted} />
          <Text style={[styles.actionText, post.likedByMe && styles.actionTextActive]}>{post.likes}</Text>
        </Pressable>
        {post.allowComments === "allow" && (
          <Pressable style={styles.actionButton} onPress={() => setCommentsVisible(v => !v)} disabled={isPending}>
            <Ionicons name="chatbubble-outline" size={24} color={C.muted} />
            <Text style={styles.actionText}>{post.comments.length}</Text>
          </Pressable>
        )}
      </View>

      {post.allowComments === "allow" && !isPending && (
        <>
          <View style={[styles.commentInputRow, { marginTop: 14, borderTopWidth: 1, borderTopColor: C.divider, paddingTop: 12 }]}>
            <TextInput style={styles.commentInput} placeholder="Write a comment..." placeholderTextColor={C.mutedDark} value={commentText} onChangeText={setCommentText} multiline />
            <Pressable style={styles.sendButton} onPress={handleSendComment}>
              <Ionicons name="send" size={18} color={C.text} />
            </Pressable>
          </View>
          {commentsVisible && (
            <View style={styles.commentsWrap}>
              {post.comments.map(comment => (
                <CommentItem key={comment.id} comment={comment} myUserId={myUserId}
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

      <Modal visible={showOptions} transparent animationType="fade" onRequestClose={handleCloseOptions}>
        <Pressable style={styles.backdrop} onPress={handleCloseOptions}>
          <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
            {!confirmDelete ? (
              <>
                <View style={styles.handle} />
                <Text style={styles.sheetTitle}>Post Options</Text>
                <Pressable style={styles.optionRow} onPress={() => { handleCloseOptions(); onEdit(); }}>
                  <View style={[styles.iconWrap, { backgroundColor: `${C.primary}26` }]}>
                    <Ionicons name="create-outline" size={20} color={C.primarySoft} />
                  </View>
                  <View style={styles.optionText}><Text style={styles.optionLabel}>Edit Post</Text><Text style={styles.optionSub}>Change your post content</Text></View>
                  <Ionicons name="chevron-forward" size={16} color={C.mutedDark} />
                </Pressable>
                <View style={styles.separator} />
                <Pressable style={styles.optionRow} onPress={() => setConfirmDelete(true)}>
                  <View style={[styles.iconWrap, { backgroundColor: "rgba(239,68,68,0.12)" }]}>
                    <Ionicons name="trash-outline" size={20} color={C.danger} />
                  </View>
                  <View style={styles.optionText}><Text style={[styles.optionLabel, { color: C.danger }]}>Delete Post</Text><Text style={styles.optionSub}>This action cannot be undone</Text></View>
                  <Ionicons name="chevron-forward" size={16} color={C.mutedDark} />
                </Pressable>
                <Pressable style={styles.cancelBtn} onPress={handleCloseOptions}><Text style={styles.cancelText}>Cancel</Text></Pressable>
              </>
            ) : (
              <>
                <View style={styles.handle} />
                <View style={styles.confirmIcon}><Ionicons name="trash" size={32} color={C.danger} /></View>
                <Text style={styles.confirmTitle}>Delete Post?</Text>
                <Text style={styles.confirmSub}>This post will be permanently deleted and cannot be recovered.</Text>
                <Pressable style={styles.deleteBtn} onPress={() => { handleCloseOptions(); onDelete(); }}><Text style={styles.deleteBtnText}>Yes, Delete</Text></Pressable>
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
   COMMENT ITEM
════════════════════════════════════════ */
function CommentItem({ comment, myUserId, onEdit, onDelete, onAddReply, onEditReply, onDeleteReply }: {
  comment: CommunityComment; myUserId: string;
  onEdit: (t: string) => void; onDelete: () => void;
  onAddReply: (t: string) => void; onEditReply: (rId: string, t: string) => void; onDeleteReply: (rId: string) => void;
}) {
  const C = useThemeColors();
  const styles = useMemo(() => createStyles(C), [C]);
  const [repliesVisible, setRepliesVisible] = useState(false);
  const [replyText,      setReplyText]      = useState("");
  const [editing,        setEditing]        = useState(false);
  const [editText,       setEditText]       = useState(comment.text);
  const [showOptions,    setShowOptions]    = useState(false);
  const [confirmDelete,  setConfirmDelete]  = useState(false);
  const isMyComment = comment.authorId === myUserId;
  const handleCloseOptions = () => { setShowOptions(false); setConfirmDelete(false); };
  const handleSendReply = () => { if (!replyText.trim()) return; onAddReply(replyText); setReplyText(""); setRepliesVisible(true); };

  return (
    <View style={styles.commentItem}>
      {editing ? (
        <View>
          <TextInput style={styles.editInput} value={editText} onChangeText={setEditText} multiline placeholderTextColor={C.mutedDark} autoFocus />
          <View style={styles.editActions}>
            <Pressable onPress={() => setEditing(false)}><Text style={styles.cancelEditText}>Cancel</Text></Pressable>
            <Pressable style={styles.saveEditBtn} onPress={() => { onEdit(editText); setEditing(false); }}><Text style={styles.saveEditText}>Save</Text></Pressable>
          </View>
        </View>
      ) : (
        <>
          <View style={styles.commentHeader}>
            <Text style={styles.commentAuthor}>{comment.author}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={styles.commentTime}>{comment.createdAtLabel}</Text>
              {isMyComment && (
                <Pressable onPress={() => { setConfirmDelete(false); setShowOptions(true); }} hitSlop={8}>
                  <Ionicons name="ellipsis-horizontal" size={16} color={C.mutedDark} />
                </Pressable>
              )}
            </View>
          </View>
          <Text style={styles.commentText}>{comment.text}</Text>
          <Pressable style={styles.replyTrigger} onPress={() => setRepliesVisible(v => !v)}>
            <Ionicons name="return-down-forward-outline" size={13} color={C.primarySoft} />
            <Text style={styles.replyTriggerText}>{repliesVisible ? "Hide replies" : `Reply${comment.replies.length > 0 ? ` (${comment.replies.length})` : ""}`}</Text>
          </Pressable>
        </>
      )}
      {repliesVisible && (
        <View style={styles.repliesWrap}>
          {comment.replies.map(reply => (
            <ReplyItem key={reply.id} reply={reply} myUserId={myUserId} onEdit={t => onEditReply(reply.id, t)} onDelete={() => onDeleteReply(reply.id)} />
          ))}
          <View style={styles.commentInputRow}>
            <TextInput style={styles.commentInput} placeholder="Write a reply..." placeholderTextColor={C.mutedDark} value={replyText} onChangeText={setReplyText} multiline />
            <Pressable style={styles.sendButton} onPress={handleSendReply}><Ionicons name="send" size={16} color={C.text} /></Pressable>
          </View>
        </View>
      )}
      <Modal visible={showOptions} transparent animationType="fade" onRequestClose={handleCloseOptions}>
        <Pressable style={styles.backdrop} onPress={handleCloseOptions}>
          <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
            {!confirmDelete ? (
              <>
                <View style={styles.handle} />
                <Text style={styles.sheetTitle}>Comment Options</Text>
                <Pressable style={styles.optionRow} onPress={() => { setEditText(comment.text); handleCloseOptions(); setEditing(true); }}>
                  <View style={[styles.iconWrap, { backgroundColor: `${C.primary}26` }]}><Ionicons name="create-outline" size={20} color={C.primarySoft} /></View>
                  <View style={styles.optionText}><Text style={styles.optionLabel}>Edit Comment</Text><Text style={styles.optionSub}>Change your comment</Text></View>
                  <Ionicons name="chevron-forward" size={16} color={C.mutedDark} />
                </Pressable>
                <View style={styles.separator} />
                <Pressable style={styles.optionRow} onPress={() => setConfirmDelete(true)}>
                  <View style={[styles.iconWrap, { backgroundColor: "rgba(239,68,68,0.12)" }]}><Ionicons name="trash-outline" size={20} color={C.danger} /></View>
                  <View style={styles.optionText}><Text style={[styles.optionLabel, { color: C.danger }]}>Delete Comment</Text><Text style={styles.optionSub}>This action cannot be undone</Text></View>
                  <Ionicons name="chevron-forward" size={16} color={C.mutedDark} />
                </Pressable>
                <Pressable style={styles.cancelBtn} onPress={handleCloseOptions}><Text style={styles.cancelText}>Cancel</Text></Pressable>
              </>
            ) : (
              <>
                <View style={styles.handle} />
                <View style={styles.confirmIcon}><Ionicons name="trash" size={32} color={C.danger} /></View>
                <Text style={styles.confirmTitle}>Delete Comment?</Text>
                <Text style={styles.confirmSub}>This comment will be permanently deleted and cannot be recovered.</Text>
                <Pressable style={styles.deleteBtn} onPress={() => { handleCloseOptions(); onDelete(); }}><Text style={styles.deleteBtnText}>Yes, Delete</Text></Pressable>
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
  reply: CommunityReply; myUserId: string; onEdit: (t: string) => void; onDelete: () => void;
}) {
  const C = useThemeColors();
  const styles = useMemo(() => createStyles(C), [C]);
  const [editing,       setEditing]       = useState(false);
  const [editText,      setEditText]      = useState(reply.text);
  const [showOptions,   setShowOptions]   = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isMyReply = reply.authorId === myUserId;
  const handleCloseOptions = () => { setShowOptions(false); setConfirmDelete(false); };

  return (
    <View style={styles.replyItem}>
      {editing ? (
        <View>
          <TextInput style={styles.editInput} value={editText} onChangeText={setEditText} multiline placeholderTextColor={C.mutedDark} autoFocus />
          <View style={styles.editActions}>
            <Pressable onPress={() => setEditing(false)}><Text style={styles.cancelEditText}>Cancel</Text></Pressable>
            <Pressable style={styles.saveEditBtn} onPress={() => { onEdit(editText); setEditing(false); }}><Text style={styles.saveEditText}>Save</Text></Pressable>
          </View>
        </View>
      ) : (
        <>
          <View style={styles.commentHeader}>
            <Text style={styles.commentAuthor}>{reply.author}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={styles.commentTime}>{reply.createdAtLabel}</Text>
              {isMyReply && (
                <Pressable onPress={() => { setConfirmDelete(false); setShowOptions(true); }} hitSlop={8}>
                  <Ionicons name="ellipsis-horizontal" size={14} color={C.mutedDark} />
                </Pressable>
              )}
            </View>
          </View>
          <Text style={styles.commentText}>{reply.text}</Text>
        </>
      )}
      <Modal visible={showOptions} transparent animationType="fade" onRequestClose={handleCloseOptions}>
        <Pressable style={styles.backdrop} onPress={handleCloseOptions}>
          <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
            {!confirmDelete ? (
              <>
                <View style={styles.handle} />
                <Text style={styles.sheetTitle}>Reply Options</Text>
                <Pressable style={styles.optionRow} onPress={() => { setEditText(reply.text); handleCloseOptions(); setEditing(true); }}>
                  <View style={[styles.iconWrap, { backgroundColor: `${C.primary}26` }]}><Ionicons name="create-outline" size={20} color={C.primarySoft} /></View>
                  <View style={styles.optionText}><Text style={styles.optionLabel}>Edit Reply</Text><Text style={styles.optionSub}>Change your reply</Text></View>
                  <Ionicons name="chevron-forward" size={16} color={C.mutedDark} />
                </Pressable>
                <View style={styles.separator} />
                <Pressable style={styles.optionRow} onPress={() => setConfirmDelete(true)}>
                  <View style={[styles.iconWrap, { backgroundColor: "rgba(239,68,68,0.12)" }]}><Ionicons name="trash-outline" size={20} color={C.danger} /></View>
                  <View style={styles.optionText}><Text style={[styles.optionLabel, { color: C.danger }]}>Delete Reply</Text><Text style={styles.optionSub}>This action cannot be undone</Text></View>
                  <Ionicons name="chevron-forward" size={16} color={C.mutedDark} />
                </Pressable>
                <Pressable style={styles.cancelBtn} onPress={handleCloseOptions}><Text style={styles.cancelText}>Cancel</Text></Pressable>
              </>
            ) : (
              <>
                <View style={styles.handle} />
                <View style={styles.confirmIcon}><Ionicons name="trash" size={32} color={C.danger} /></View>
                <Text style={styles.confirmTitle}>Delete Reply?</Text>
                <Text style={styles.confirmSub}>This reply will be permanently deleted and cannot be recovered.</Text>
                <Pressable style={styles.deleteBtn} onPress={() => { handleCloseOptions(); onDelete(); }}><Text style={styles.deleteBtnText}>Yes, Delete</Text></Pressable>
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
   STYLES — theme-aware palette
════════════════════════════════════════ */
const createStyles = (C: ThemeColors) => StyleSheet.create({
  container:    { flex: 1, backgroundColor: C.background },

  // Header — matches sign-in header bar
  header:       { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 0 },
  title:        { fontSize: 22, fontWeight: '800', color: C.text, letterSpacing: 0.5 },
  titleAccent:  { color: C.primarySoft },
  titleSub:     { color: C.muted, fontWeight: '600', fontSize: 18 },
  headerActions:{ flexDirection: "row", alignItems: "center", gap: 16 },
  headerIcon:   { width: 36, height: 36, borderRadius: 18, borderWidth: 1, backgroundColor: C.input, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  divider:      { height: 1, backgroundColor: C.divider },

  scroll:       { flex: 1 },
  content:      { paddingTop: 20, paddingHorizontal: 20 },

  // Create button — same solid blue as sign-in button
  createButton:     { height: 54, borderRadius: 14, backgroundColor: C.primary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 20 },
  createButtonText: { color: C.text, fontSize: 16, fontWeight: "700", letterSpacing: 0.3 },

  // Filter pills — matches sign-in input border style
  filtersRow:       { gap: 10, paddingBottom: 20 },
  filterPill:       { minWidth: 68, height: 40, borderRadius: 20, paddingHorizontal: 16, borderWidth: 1, borderColor: C.border, backgroundColor: C.input, alignItems: "center", justifyContent: "center" },
  filterPillActive: { backgroundColor: C.primary, borderColor: C.primary },
  filterText:       { color: C.muted, fontSize: 14, fontWeight: "700" },
  filterTextActive: { color: C.text },

  // Post card — matches sign-in form surface
  postCard:     { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 16, marginBottom: 14 },
  postHeader:   { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 14 },
  avatar:       { width: 48, height: 48, borderRadius: 24, backgroundColor: C.primary, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.border },
  avatarText:   { color: C.text, fontSize: 16, fontWeight: "800" },
  postIdentity: { flex: 1 },
  authorRow:    { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  author:       { color: C.text, fontSize: 15, fontWeight: "800" },
  followBtn:       { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: C.primarySoft },
  followBtnActive: { backgroundColor: C.primary, borderColor: C.primary },
  followText:      { color: C.primarySoft, fontSize: 12, fontWeight: "700" },
  followTextActive:{ color: C.text },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3, flexWrap: "wrap" },
  vehicle: { color: C.primarySoft, fontSize: 13 },
  dot:     { color: C.mutedDark, fontSize: 13 },
  time:    { color: C.mutedDark, fontSize: 13 },
  postText: { color: C.muted, fontSize: 15, lineHeight: 24, marginBottom: 12 },
  tagsRow:  { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  tagPill:  { backgroundColor: `${C.primary}1F`, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: C.border },
  tagText:  { color: C.primarySoft, fontSize: 12, fontWeight: "600" },
  imagesGrid:    { width: "100%", height: 210, borderRadius: 12, overflow: "hidden", marginBottom: 16 },
  imagesGridTwo: { flexDirection: "row", gap: 8 },
  postImage:     { flex: 1, width: "100%", height: "100%", backgroundColor: C.input, borderRadius: 12 },
  actionsDivider: { height: 1, backgroundColor: C.divider, marginBottom: 12 },
  actionsRow:     { flexDirection: "row", alignItems: "center" },
  actionButton:   { flexDirection: "row", alignItems: "center", gap: 8, marginRight: 26 },
  actionText:     { color: C.muted, fontSize: 15 },
  actionTextActive:{ color: C.primarySoft, fontWeight: "700" },
  commentsWrap:  { marginTop: 10, gap: 10 },

  // Comment — matches input style
  commentItem:   { backgroundColor: C.input, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 10, gap: 6 },
  commentHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  commentAuthor: { color: C.text, fontSize: 13, fontWeight: "700" },
  commentText:   { color: C.muted, fontSize: 14, lineHeight: 20 },
  commentTime:   { color: C.mutedDark, fontSize: 11 },
  replyTrigger:     { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  replyTriggerText: { color: C.primarySoft, fontSize: 12, fontWeight: "700" },
  repliesWrap: { marginTop: 8, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: C.border, gap: 8 },
  replyItem:   { backgroundColor: C.surfaceLight, borderRadius: 10, padding: 8, gap: 4 },

  editInput:      { backgroundColor: C.input, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 10, color: C.text, fontSize: 14, minHeight: 60, marginBottom: 8 },
  editActions:    { flexDirection: "row", justifyContent: "flex-end", gap: 10 },
  cancelEditText: { color: C.muted, fontSize: 13, fontWeight: "700", paddingVertical: 6 },
  saveEditBtn:    { backgroundColor: C.primary, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 6 },
  saveEditText:   { color: C.text, fontSize: 13, fontWeight: "700" },

  commentInputRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginTop: 4 },
  commentInput:    { flex: 1, minHeight: 42, maxHeight: 92, borderRadius: 12, backgroundColor: C.input, borderWidth: 1, borderColor: C.border, color: C.text, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  sendButton:      { width: 42, height: 42, borderRadius: 12, backgroundColor: C.primary, alignItems: "center", justifyContent: "center" },

  emptyCard:  { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 22, alignItems: "center", gap: 8 },
  emptyTitle: { color: C.text, fontSize: 17, fontWeight: "800" },
  emptyText:  { color: C.muted, fontSize: 14, textAlign: "center", lineHeight: 20 },

  // Modals — same dark sheet as sign-in feel
  modalOverlay:   { flex: 1, justifyContent: "flex-end" },
  modalBackdrop:  { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.65)" },
  composerSheet:  { backgroundColor: C.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 14, borderWidth: 1, borderColor: C.border, maxHeight: "90%" },
  sheetHandle:    { width: 40, height: 4, backgroundColor: 'rgba(96,165,250,0.25)', borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  sheetHeader:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  sheetTitle:     { color: C.text, fontSize: 20, fontWeight: "800", letterSpacing: 0.3 },
  closeButton:    { width: 34, height: 34, borderRadius: 17, backgroundColor: C.input, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" },

  composerIdentityRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  avatarSmall:         { width: 42, height: 42, borderRadius: 21, backgroundColor: C.primary, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  avatarTextSmall:     { color: C.text, fontSize: 14, fontWeight: "800" },
  composerName:        { color: C.text, fontSize: 15, fontWeight: "800" },
  composerMeta:        { color: C.mutedDark, fontSize: 13, marginTop: 2 },

  // Composer inputs — exactly like sign-in TextInput
  composerInput:       { minHeight: 120, borderRadius: 12, backgroundColor: C.input, borderWidth: 1, borderColor: C.border, color: C.text, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, lineHeight: 22, marginBottom: 14 },
  sheetLabel:    { fontSize: 13, fontWeight: '600', color: 'rgba(186,214,255,0.85)', marginBottom: 8, marginTop: 4 },
  tagsInput:     { height: 52, borderRadius: 12, backgroundColor: C.input, borderWidth: 1, borderColor: C.border, color: C.text, paddingHorizontal: 16, fontSize: 15, marginBottom: 14 },

  toggleRow:     { flexDirection: "row", gap: 8, marginBottom: 14, flexWrap: "wrap" },
  togglePill:    { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: C.input },
  togglePillActive:  { backgroundColor: C.primary, borderColor: C.primary },
  toggleText:        { color: C.muted, fontSize: 13, fontWeight: "700" },
  toggleTextActive:  { color: C.text },

  // Publish button — same as sign-in button
  publishButton:         { height: 54, borderRadius: 14, backgroundColor: C.primary, alignItems: "center", justifyContent: "center", marginBottom: 8, marginTop: 8 },
  publishButtonDisabled: { opacity: 0.45 },
  publishButtonText:     { color: C.text, fontSize: 16, fontWeight: "700", letterSpacing: 0.3 },

  // Bottom sheets
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "flex-end" },
  sheet:    { backgroundColor: C.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 36, borderWidth: 1, borderColor: C.border },
  handle:   { width: 40, height: 4, backgroundColor: 'rgba(96,165,250,0.25)', borderRadius: 2, alignSelf: "center", marginBottom: 20 },

  optionRow:  { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 12 },
  iconWrap:   { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  optionText: { flex: 1 },
  optionLabel:{ color: C.text, fontSize: 15, fontWeight: "700" },
  optionSub:  { color: C.mutedDark, fontSize: 12, marginTop: 2 },
  separator:  { height: 1, backgroundColor: C.divider, marginVertical: 4 },
  cancelBtn:  { marginTop: 16, height: 50, borderRadius: 14, backgroundColor: C.input, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  cancelText: { color: C.muted, fontSize: 15, fontWeight: "700" },

  confirmIcon:  { width: 72, height: 72, borderRadius: 36, backgroundColor: "rgba(239,68,68,0.12)", alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 16 },
  confirmTitle: { color: C.text, fontSize: 20, fontWeight: "800", textAlign: "center", marginBottom: 8 },
  confirmSub:   { color: C.mutedDark, fontSize: 14, textAlign: "center", lineHeight: 20, marginBottom: 24 },
  deleteBtn:    { height: 50, borderRadius: 14, backgroundColor: C.danger, alignItems: "center", justifyContent: "center" },
  deleteBtnText:{ color: C.text, fontSize: 15, fontWeight: "800" },

  dotsBtn: { padding: 6, zIndex: 999, elevation: 10 },
  pendingBadge: { backgroundColor: "rgba(255,200,0,0.12)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: "rgba(255,200,0,0.25)" },
  pendingText:  { color: "#f5c400", fontSize: 11, fontWeight: "700" },
});