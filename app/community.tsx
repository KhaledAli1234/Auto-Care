import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

import { BottomNavbar } from "@/components/bottom-navbar";
import { useUserProfile } from "@/context/user-profile-context";
import { BASE_URL } from "@/constants/api";

/* ════════════════════════════════════════
   COLORS
════════════════════════════════════════ */
const COLORS = {
  background:   "#09182d",
  surface:      "#13243a",
  surfaceLight: "#172b44",
  border:       "rgba(255,255,255,0.07)",
  divider:      "rgba(255,255,255,0.06)",
  text:         "#f8fafc",
  muted:        "#aebbd0",
  mutedDark:    "#74849a",
  primary:      "#3268f7",
  primarySoft:  "#1e4fd6",
  input:        "#0f1f34",
  danger:       "#ef4444",
};

/* ════════════════════════════════════════
   TYPES
════════════════════════════════════════ */
type BrandFilter    = "All" | "Toyota" | "BMW" | "Honda" | "Kia" | "Ford";
type Availability   = "public" | "friends" | "onlyMe";
type AllowComments  = "allow" | "disable";

interface ApiReply {
  _id: string;
  id?: string;
  createdBy: string | { _id: string; firstName?: string; lastName?: string; username?: string };
  content: string;
  createdAt?: string;
}

interface ApiComment {
  _id: string;
  id?: string;
  createdBy: string | { _id: string; firstName?: string; lastName?: string; username?: string };
  content: string;
  createdAt?: string;
  replies?: ApiReply[];
}

interface ApiPost {
  _id?: string;
  id: string;
  createdBy: string | { _id: string; firstName?: string; lastName?: string; username?: string; car?: string; vehicle?: string; carModel?: string };
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
  // FIX #4: API may return follow state
  isFollowing?: boolean;
}

interface CommunityReply {
  id: string;
  author: string;
  authorId: string;
  text: string;
  createdAtLabel: string;
  pending?: boolean;
}

interface CommunityComment {
  id: string;
  author: string;
  authorId: string;
  text: string;
  createdAtLabel: string;
  replies: CommunityReply[];
  pending?: boolean;
}

interface CommunityPost {
  id: string;
  author: string;
  authorId: string;
  initials: string;
  vehicle: string;
  createdAtLabel: string;
  content: string;
  tags: string[];
  allowComments: AllowComments;
  availability: Availability;
  images: string[];
  likes: number;
  comments: CommunityComment[];
  shares: number;
  likedByMe: boolean;
  followedAuthor: boolean;
  pending?: boolean;
}

/* ════════════════════════════════════════
   CONSTANTS
════════════════════════════════════════ */
const BRAND_FILTERS: BrandFilter[] = ["All", "Toyota", "BMW", "Honda", "Kia", "Ford"];

const AVAIL_OPTIONS: { value: Availability; label: string; icon: string }[] = [
  { value: "public",  label: "Public",  icon: "globe-outline" },
  { value: "friends", label: "Friends", icon: "people-outline" },
  { value: "onlyMe",  label: "Only Me", icon: "lock-closed-outline" },
];

/* ════════════════════════════════════════
   HELPERS
════════════════════════════════════════ */
function getInitials(name: string) {
  const n = name.trim();
  if (!n) return "U";
  const p = n.split(/\s+/);
  return `${p[0][0] ?? ""}${p[1]?.[0] ?? ""}`.toUpperCase();
}

function getUserName(full?: string) {
  return full?.trim() || "You";
}

function formatCreatedAt(dateStr?: string) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now   = new Date();
  const diffMs    = now.getTime() - date.getTime();
  const diffMins  = Math.floor(diffMs / 60000);
  if (diffMins < 1)  return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

const resolveAuthorId = (author: any) => {
  if (!author) return '';

  if (typeof author === 'string') {
    return author;
  }

  return author?._id || '';
};

// FIX #3: When createdBy is a populated object, always use its fields.
// Only fall back to myName when the ID matches the logged-in user.
function resolveAuthorName(
  createdBy: ApiPost["createdBy"],
  myUserId?: string,
  myName?: string,
): string {

  if (!createdBy) {
    return "User";
  }

  if (typeof createdBy === "string") {

    if (myUserId && myName && createdBy === myUserId) {
      return myName;
    }

    return "User";
  }

  if (createdBy?.username) {
    return createdBy.username;
  }

  const fullName =
    `${createdBy?.firstName ?? ""} ${createdBy?.lastName ?? ""}`.trim();

  if (fullName) {
    return fullName;
  }

  if (
    myUserId &&
    myName &&
    createdBy?._id === myUserId
  ) {
    return myName;
  }

  return "User";
}

// FIX #6: Extract vehicle from populated createdBy (after backend populate fix)
function resolveAuthorVehicle(createdBy: ApiPost["createdBy"]): string {

  if (!createdBy) return "";

  if (typeof createdBy === "string") return "";

  const v = (createdBy as any)?.vehicleId;

  if (!v) return "";

  return [v.brand, v.model, v.year]
    .filter(Boolean)
    .join(" ");
}

function normalizeComment(c: ApiComment, myUserId: string, myName: string): CommunityComment {
  return {
    id:             c._id ?? c.id ?? "",
    author:         resolveAuthorName(c.createdBy, myUserId, myName),
    authorId:       resolveAuthorId(c.createdBy),
    text:           c.content ?? "",
    createdAtLabel: formatCreatedAt(c.createdAt),
    replies: (c.replies ?? []).map(r => ({
      id:             r._id ?? r.id ?? "",
      // FIX #2: Pass myUserId + myName so reply author resolves correctly
      author:         resolveAuthorName(r.createdBy, myUserId, myName),
      authorId:       resolveAuthorId(r.createdBy),
      text:           r.content ?? "",
      createdAtLabel: formatCreatedAt(r.createdAt),
    })),
  };
}

function normalizePost(
  p: ApiPost,
  myUserId: string,
  myName: string,
  followedAuthorIds: Set<string>,   // FIX #4 & #5: global follow state
  myVehicle?: string,               // FIX #6: my vehicle from profile context
): CommunityPost {
  const authorId = resolveAuthorId(p.createdBy);
  const isMyPost = authorId === myUserId;
  return {
    id:             p._id ?? p.id ?? "",
    author:         resolveAuthorName(p.createdBy, myUserId, myName),
    authorId,
    initials:       getInitials(resolveAuthorName(p.createdBy, myUserId, myName)),
    // FIX #6: own posts use profile context vehicle; others use populated createdBy (after backend fix)
    vehicle:        isMyPost ? (myVehicle ?? "") : resolveAuthorVehicle(p.createdBy),
    createdAtLabel: formatCreatedAt(p.createdAt),
    content:        p.content ?? "",
    tags:           p.tags ?? [],
    allowComments:  p.allowComments ?? "allow",
    availability:   p.availability ?? "public",
    images:         p.attachments ?? [],
    likes:          Array.isArray(p.likes) ? p.likes.length : 0,
    likedByMe:      Array.isArray(p.likes) ? p.likes.includes(myUserId) : false,
    comments:       (p.comments ?? []).map(c => normalizeComment(c, myUserId, myName)),
    shares:         0,
    // FIX #4 & #5: use global followedAuthorIds set so state persists across cards
    followedAuthor: p.isFollowing ?? followedAuthorIds.has(authorId),
    pending:        false,
  };
}

/* ════════════════════════════════════════
   API HELPERS
════════════════════════════════════════ */
async function authHeaders() {
  const token = await AsyncStorage.getItem("access_token");
  return {
    "Content-Type": "application/json",
    Authorization:  `Bearer ${token?.replace(/"/g, "") ?? ""}`,
  };
}

async function apiGet(path: string) {
  const res  = await fetch(`${BASE_URL}${path}`, { method: "GET", headers: await authHeaders() });
  const json = await res.json();
  if (!res.ok) console.warn(`[GET ${path}] ${res.status}`, json);
  return json;
}

async function apiPost(path: string, body?: object) {
  const res  = await fetch(`${BASE_URL}${path}`, {
    method: "POST", headers: await authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) console.warn(`[POST ${path}] ${res.status}`, json);
  return json;
}

async function apiPatch(path: string, body?: object) {
  const res  = await fetch(`${BASE_URL}${path}`, {
    method: "PATCH", headers: await authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) console.warn(`[PATCH ${path}] ${res.status}`, json);
  return json;
}

async function apiDelete(path: string) {
  const res  = await fetch(`${BASE_URL}${path}`, { method: "DELETE", headers: await authHeaders() });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) console.warn(`[DELETE ${path}] ${res.status}`, json);
  return json;
}

/* ════════════════════════════════════════
   SCREEN
════════════════════════════════════════ */
export default function CommunityScreen() {
  const insets   = useSafeAreaInsets();
  const { profile, updateProfile  } = useUserProfile();

  const [myUserId, setMyUserId] = useState("");

  const [activeFilter, setActiveFilter] = useState<BrandFilter>("All");
  const [posts,        setPosts]         = useState<CommunityPost[]>([]);
  const [loading,      setLoading]       = useState(true);
  const [page,         setPage]          = useState(1);
  const [totalPages,   setTotalPages]    = useState(1);
  const [loadingMore,  setLoadingMore]   = useState(false);

  // FIX #4 & #5: Track followed author IDs globally so all cards stay in sync
  // and state persists across page re-fetches
  const [followedAuthorIds, setFollowedAuthorIds] = useState<Set<string>>(new Set());

  // composer
  const [composerVisible,        setComposerVisible]        = useState(false);
  const [newPostText,            setNewPostText]            = useState("");
  const [newPostTags,            setNewPostTags]            = useState("");
  const [newPostAllowComments,   setNewPostAllowComments]   = useState<AllowComments>("allow");
  const [newPostAvailability,    setNewPostAvailability]    = useState<Availability>("public");
  const [publishing,             setPublishing]             = useState(false);

  // edit post
  const [editPostId,   setEditPostId]   = useState<string | null>(null);
  const [editPostText, setEditPostText] = useState("");
  const [editPostTags, setEditPostTags] = useState("");
  const [saving,       setSaving]       = useState(false);

  const myName = getUserName(
    `${profile.user?.firstName ?? ""} ${profile.user?.lastName ?? ""}`.trim()
  );
  // FIX #6: Build vehicle string from profile context
  const myVehicle = profile.vehicle
    ? [profile.vehicle.brand, profile.vehicle.model, profile.vehicle.year].filter(Boolean).join(" ")
    : "";

  /* ── load userId once ── */
  useEffect(() => {
    AsyncStorage.getItem("userId").then(id => setMyUserId(id?.replace(/"/g, "") ?? ""));
  }, []);

  /* ── fetch posts ── */
  const fetchPosts = useCallback(async (pageNum = 1, replace = true) => {
    try {
      pageNum === 1 ? setLoading(true) : setLoadingMore(true);
      const data = await apiGet(`/posts?page=${pageNum}&size=10`);
      const uid  = await AsyncStorage.getItem("userId").then(v => v?.replace(/"/g, "") ?? "");
      const result: ApiPost[] = data?.data?.posts?.result ?? [];

      // FIX #4: Build the follow set from the API response (isFollowing field)
      // then merge with existing local follow state so user actions aren't lost
      setFollowedAuthorIds(prev => {
        const next = new Set(prev);
        result.forEach(p => {
          const authorId = resolveAuthorId(p.createdBy);
          if (p.isFollowing === true)  next.add(authorId);
          if (p.isFollowing === false && !prev.has(authorId)) next.delete(authorId);
        });
        return next;
      });

      // We need the latest followedAuthorIds when normalizing — use a local copy
      setFollowedAuthorIds(prev => {
        const normalized = result.map(p => normalizePost(p, uid, myName, prev, myVehicle));
        setPosts(cur => replace ? normalized : [...cur, ...normalized]);
        return prev;
      });

      setTotalPages(data?.data?.posts?.pages ?? 1);
      setPage(pageNum);
    } catch (err) {
      console.log("fetchPosts error:", err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [myName]);

  useEffect(() => { fetchPosts(1); }, [fetchPosts]);

  // FIX #5: When followedAuthorIds changes, sync all posts so every card
  // showing the same author updates at once
  useEffect(() => {
    setPosts(cur => cur.map(p => ({
      ...p,
      followedAuthor: followedAuthorIds.has(p.authorId),
    })));
  }, [followedAuthorIds]);

  const filteredPosts = useMemo(() => {
    if (activeFilter === "All") return posts;
    return posts.filter(p => p.vehicle.toLowerCase().includes(activeFilter.toLowerCase()));
  }, [activeFilter, posts]);

  /* ════════ POST HANDLERS ════════ */

  const handleToggleLike = async (postId: string, likedByMe: boolean) => {
    if (posts.find(p => p.id === postId)?.pending) return;
    setPosts(cur => cur.map(p => p.id !== postId ? p : {
      ...p,
      likedByMe: !likedByMe,
      likes: !likedByMe ? p.likes + 1 : Math.max(0, p.likes - 1),
    }));
    try {
      const action = likedByMe ? "unlike" : "like";
      await apiPatch(`/posts/${postId}/like?action=${action}`);
    } catch (err) {
      setPosts(cur => cur.map(p => p.id !== postId ? p : {
        ...p,
        likedByMe,
        likes: likedByMe ? p.likes + 1 : Math.max(0, p.likes - 1),
      }));
      console.log("toggleLike error:", err);
    }
  };

  const handleToggleFollow = async (
    postId: string,
    authorId: string,
    followedAuthor: boolean
  ) => {
    if (posts.find(p => p.id === postId)?.pending) return;

    const stats = {
      followersCount: profile.stats?.followersCount ?? 0,
      followingCount: profile.stats?.followingCount ?? 0,
      postsCount: profile.stats?.postsCount ?? 0,
    };
    setFollowedAuthorIds(prev => {
      const next = new Set(prev);

      if (followedAuthor) next.delete(authorId);
      else next.add(authorId);

      return next;
    });
    updateProfile({
      stats: {
        ...stats,
        followingCount: followedAuthor
          ? Math.max(0, stats.followingCount - 1)
          : stats.followingCount + 1,
      },
    });

    try {
      if (followedAuthor) {
        await apiDelete(`/follow/${authorId}`);
      } else {
        await apiPost(`/follow/${authorId}`);
      }
    } catch (err) {
      // rollback follow state
      setFollowedAuthorIds(prev => {
        const next = new Set(prev);

        if (followedAuthor) next.add(authorId);
        else next.delete(authorId);

        return next;
      });
      updateProfile({
        stats: {
          ...stats,
          followingCount: followedAuthor
            ? stats.followingCount + 1
            : Math.max(0, stats.followingCount - 1),
        },
      });

      console.log("toggleFollow error:", err);
    }
  };

  const handleShare = (id: string) => {
    if (posts.find(p => p.id === id)?.pending) return;
    setPosts(cur => cur.map(p => p.id !== id ? p : { ...p, shares: p.shares + 1 }));
  };

  const handleDeletePost = async (postId: string) => {
    if (posts.find(p => p.id === postId)?.pending) return;
    setPosts(cur => cur.filter(p => p.id !== postId));
    try {
      const data = await apiDelete(`/posts/${postId}`);
      console.log("[deletePost] full response:", JSON.stringify(data));
    } catch (err) {
      console.log("[deletePost] error:", err);
      fetchPosts(1);
    }
  };

  const handleOpenEditPost = (post: CommunityPost) => {
    setEditPostId(post.id);
    setEditPostText(post.content);
    setEditPostTags(post.tags.join(", "));
  };

  const handleSaveEditPost = async () => {
    if (!editPostId || !editPostText.trim()) return;
    setSaving(true);
    const currentPost = posts.find(p => p.id === editPostId);
    const newTags = editPostTags.split(",").map(t => t.trim()).filter(Boolean);
    const prevContent = currentPost?.content ?? "";
    const prevTags    = currentPost?.tags ?? [];
    // Optimistic update for both content and tags
    setPosts(cur => cur.map(p => p.id !== editPostId ? p : {
      ...p, content: editPostText.trim(), tags: newTags,
    }));
    try {
      const data = await apiPatch(`/posts/${editPostId}`, {
        content:       editPostText.trim(),
        tags:          newTags,
        allowComments: currentPost?.allowComments ?? "allow",
        availability:  currentPost?.availability ?? "public",
      });
      console.log("[editPost] full response:", JSON.stringify(data));
      setEditPostId(null);
      setEditPostText("");
      setEditPostTags("");
    } catch (err) {
      setPosts(cur => cur.map(p => p.id !== editPostId ? p : {
        ...p, content: prevContent, tags: prevTags,
      }));
      console.log("[editPost] error:", err);
    } finally {
      setSaving(false);
    }
  };

  /* ════════ COMMENT HANDLERS ════════ */

  const handleAddComment = async (postId: string, text: string) => {
    if (!text.trim()) return;
    const targetPost = posts.find(p => p.id === postId);
    if (targetPost?.pending) return;

    const tempId = `temp-c-${Date.now()}`;
    const author = getUserName(`${profile.user?.firstName ?? ""} ${profile.user?.lastName ?? ""}`);
    setPosts(cur => cur.map(p => p.id !== postId ? p : {
      ...p,
      comments: [...p.comments, {
        id: tempId, author, authorId: myUserId,
        text: text.trim(), createdAtLabel: "Just now", replies: [],
        pending: true,
      }],
    }));
    try {
      const data = await apiPost(`/comments/${postId}`, { content: text.trim() });
      console.log("[addComment] full response:", JSON.stringify(data));

      const saved: ApiComment | null =
        data?.data?.comment ??
        data?.data?.result ??
        data?.data ??
        null;

      if (saved && (saved._id || saved.id)) {
        setPosts(cur => cur.map(p => p.id !== postId ? p : {
          ...p,
          comments: p.comments.map(c => c.id !== tempId ? c : normalizeComment(saved, myUserId, myName)),
        }));
      } else {
        console.warn("[addComment] no saved comment in response:", JSON.stringify(data));
        setPosts(cur => cur.map(p => p.id !== postId ? p : {
          ...p,
          comments: p.comments.map(c => c.id !== tempId ? c : { ...c, pending: false }),
        }));
      }
    } catch (err) {
      setPosts(cur => cur.map(p => p.id !== postId ? p : {
        ...p, comments: p.comments.filter(c => c.id !== tempId),
      }));
      console.log("[addComment] error:", err);
    }
  };

  const handleEditComment = async (postId: string, commentId: string, text: string) => {
    const targetComment = posts.find(p => p.id === postId)?.comments.find(c => c.id === commentId);
    if (targetComment?.pending) return;

    const prev = targetComment?.text ?? "";
    setPosts(cur => cur.map(p => p.id !== postId ? p : {
      ...p, comments: p.comments.map(c => c.id !== commentId ? c : { ...c, text }),
    }));
    try {
      const data = await apiPatch(`/comments/${commentId}`, { content: text });
      console.log("[editComment] full response:", JSON.stringify(data));
    } catch (err) {
      setPosts(cur => cur.map(p => p.id !== postId ? p : {
        ...p, comments: p.comments.map(c => c.id !== commentId ? c : { ...c, text: prev }),
      }));
      console.log("[editComment] error:", err);
    }
  };

  const handleDeleteComment = async (postId: string, commentId: string) => {
    const targetComment = posts.find(p => p.id === postId)?.comments.find(c => c.id === commentId);
    if (targetComment?.pending) return;

    const prevComments = posts.find(p => p.id === postId)?.comments ?? [];
    setPosts(cur => cur.map(p => p.id !== postId ? p : {
      ...p, comments: p.comments.filter(c => c.id !== commentId),
    }));
    try {
      const data = await apiDelete(`/comments/${commentId}`);
      console.log("[deleteComment] full response:", JSON.stringify(data));
    } catch (err) {
      setPosts(cur => cur.map(p => p.id !== postId ? p : { ...p, comments: prevComments }));
      console.log("[deleteComment] error:", err);
    }
  };

  /* ════════ REPLY HANDLERS ════════ */

  const handleAddReply = async (postId: string, commentId: string, text: string) => {
    if (!text.trim()) return;
    const targetPost    = posts.find(p => p.id === postId);
    const targetComment = targetPost?.comments.find(c => c.id === commentId);
    if (targetPost?.pending || targetComment?.pending) return;

    const tempId = `temp-r-${Date.now()}`;
    // FIX #2: Use the resolved myName so reply author shows correctly
    const author = myName;
    setPosts(cur => cur.map(p => p.id !== postId ? p : {
      ...p,
      comments: p.comments.map(c => c.id !== commentId ? c : {
        ...c,
        replies: [...c.replies, {
          id: tempId, author, authorId: myUserId,
          text: text.trim(), createdAtLabel: "Just now",
          pending: true,
        }],
      }),
    }));
    try {
      const data = await apiPost(`/comments/${postId}/${commentId}/reply`, { content: text.trim() });
      console.log("[addReply] full response:", JSON.stringify(data));

      const saved: ApiReply | null =
        data?.data?.reply ??
        data?.data?.comment ??
        data?.data ??
        null;

      if (saved && (saved._id || saved.id)) {
        setPosts(cur => cur.map(p => p.id !== postId ? p : {
          ...p,
          comments: p.comments.map(c => c.id !== commentId ? c : {
            ...c,
            replies: c.replies.map(r => r.id !== tempId ? r : {
              id:             saved._id ?? saved.id ?? tempId,
              // FIX #2: Pass myUserId + myName to resolveAuthorName
              author:         resolveAuthorName(saved.createdBy, myUserId, myName),
              authorId:       resolveAuthorId(saved.createdBy),
              text:           saved.content ?? text,
              createdAtLabel: formatCreatedAt(saved.createdAt),
              pending:        false,
            }),
          }),
        }));
      } else {
        console.warn("[addReply] no saved reply in response:", JSON.stringify(data));
        setPosts(cur => cur.map(p => p.id !== postId ? p : {
          ...p,
          comments: p.comments.map(c => c.id !== commentId ? c : {
            ...c,
            replies: c.replies.map(r => r.id !== tempId ? r : { ...r, pending: false }),
          }),
        }));
      }
    } catch (err) {
      setPosts(cur => cur.map(p => p.id !== postId ? p : {
        ...p,
        comments: p.comments.map(c => c.id !== commentId ? c : {
          ...c, replies: c.replies.filter(r => r.id !== tempId),
        }),
      }));
      console.log("[addReply] error:", err);
    }
  };

  const handleEditReply = async (postId: string, commentId: string, replyId: string, text: string) => {
    const targetReply = posts
      .find(p => p.id === postId)?.comments
      .find(c => c.id === commentId)?.replies
      .find(r => r.id === replyId);
    if (targetReply?.pending) return;

    const prevText = targetReply?.text ?? "";
    setPosts(cur => cur.map(p => p.id !== postId ? p : {
      ...p,
      comments: p.comments.map(c => c.id !== commentId ? c : {
        ...c, replies: c.replies.map(r => r.id !== replyId ? r : { ...r, text }),
      }),
    }));
    try {
      const data = await apiPatch(`/comments/${commentId}/replies/${replyId}`, { content: text });
      console.log("[editReply] full response:", JSON.stringify(data));
    } catch (err) {
      setPosts(cur => cur.map(p => p.id !== postId ? p : {
        ...p,
        comments: p.comments.map(c => c.id !== commentId ? c : {
          ...c, replies: c.replies.map(r => r.id !== replyId ? r : { ...r, text: prevText }),
        }),
      }));
      console.log("[editReply] error:", err);
    }
  };

  const handleDeleteReply = async (postId: string, commentId: string, replyId: string) => {
    const targetReply = posts
      .find(p => p.id === postId)?.comments
      .find(c => c.id === commentId)?.replies
      .find(r => r.id === replyId);
    if (targetReply?.pending) return;

    const prevReplies = posts
      .find(p => p.id === postId)?.comments
      .find(c => c.id === commentId)?.replies ?? [];
    setPosts(cur => cur.map(p => p.id !== postId ? p : {
      ...p,
      comments: p.comments.map(c => c.id !== commentId ? c : {
        ...c, replies: c.replies.filter(r => r.id !== replyId),
      }),
    }));
    try {
      const data = await apiDelete(`/comments/${commentId}/replies/${replyId}`);
      console.log("[deleteReply] full response:", JSON.stringify(data));
    } catch (err) {
      setPosts(cur => cur.map(p => p.id !== postId ? p : {
        ...p,
        comments: p.comments.map(c => c.id !== commentId ? c : { ...c, replies: prevReplies }),
      }));
      console.log("[deleteReply] error:", err);
    }
  };

  /* ════════ CREATE POST ════════ */

  const handleCreatePost = async () => {
    const trimmed = newPostText.trim();
    if (!trimmed) return;
    setPublishing(true);

    const uid    = await AsyncStorage.getItem("userId").then(v => v?.replace(/"/g, "") ?? "");
    const author = getUserName(`${profile.user?.firstName ?? ""} ${profile.user?.lastName ?? ""}`);
    // FIX #1: Capture tags BEFORE clearing state
    const tags   = newPostTags.split(",").map(t => t.trim()).filter(Boolean);
    const tempId = `temp-post-${Date.now()}`;

    const optimisticPost: CommunityPost = {
      id:             tempId,
      author,
      authorId:       uid,
      initials:       getInitials(author),
      vehicle:        myVehicle,
      createdAtLabel: "Just now",
      content:        trimmed,
      tags,
      allowComments:  newPostAllowComments,
      availability:   newPostAvailability,
      images:         [],
      likes:          0,
      likedByMe:      false,
      comments:       [],
      shares:         0,
      followedAuthor: false,
      pending:        true,
    };

    // FIX #1: Capture values needed for the API call BEFORE resetting state
    const postPayload = {
      content:       trimmed,
      tags,                         // ← already captured above, not affected by state reset
      allowComments: newPostAllowComments,
      availability:  newPostAvailability,
    };

    setPosts(cur => [optimisticPost, ...cur]);
    // Reset UI state — this no longer affects postPayload
    setNewPostText("");
    setNewPostTags("");
    setNewPostAllowComments("allow");
    setNewPostAvailability("public");
    setComposerVisible(false);

    try {
      // FIX #1: Send captured payload, not potentially-reset state
      const data = await apiPost("/posts", postPayload);

      console.log("[createPost] full response:", JSON.stringify(data));

      const saved: ApiPost | null =
        data?.data?.post ??
        data?.data?.result ??
        data?.data ??
        null;

      if (saved && (saved._id || saved.id)) {
        setPosts(cur => cur.map(p => p.id !== tempId ? p : normalizePost(saved, uid, myName, followedAuthorIds, myVehicle)));
      } else {
        console.warn("[createPost] no saved post in response, removing optimistic post");
        setPosts(cur => cur.filter(p => p.id !== tempId));
      }
    } catch (err) {
      console.log("[createPost] error:", err);
      setPosts(cur => cur.filter(p => p.id !== tempId));
    } finally {
      setPublishing(false);
    }
  };

  /* ════════════════════════════════════════
     RENDER
  ════════════════════════════════════════ */
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* header */}
      <View style={styles.header}>
        <Text style={styles.title}>Community</Text>
        <View style={styles.headerActions}>
          <Pressable style={styles.headerIcon} hitSlop={10}>
            <Ionicons name="notifications-outline" size={22} color={COLORS.text} />
          </Pressable>
          <Pressable style={styles.headerIcon} hitSlop={10} onPress={() => router.push("/account")}>
            <Ionicons name="person-outline" size={22} color={COLORS.text} />
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
          const isBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 60;
          if (isBottom && !loadingMore && page < totalPages) {
            fetchPosts(page + 1, false);
          }
        }}
        scrollEventThrottle={400}
      >
        <Pressable style={styles.createButton} onPress={() => setComposerVisible(true)}>
          <Ionicons name="add" size={28} color={COLORS.text} />
          <Text style={styles.createButtonText}>Create Post</Text>
        </Pressable>

        {/* filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}>
          {BRAND_FILTERS.map(brand => (
            <Pressable
              key={brand}
              style={[styles.filterPill, brand === activeFilter && styles.filterPillActive]}
              onPress={() => setActiveFilter(brand)}
            >
              <Text style={[styles.filterText, brand === activeFilter && styles.filterTextActive]}>{brand}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {loading ? (
          <ActivityIndicator color={COLORS.primary} size="large" style={{ marginTop: 40 }} />
        ) : filteredPosts.length > 0 ? (
          <>
            {filteredPosts.map(post => (
              <CommunityPostCard
                key={post.id}
                post={post}
                myUserId={myUserId}
                onToggleLike={()              => handleToggleLike(post.id, post.likedByMe)}
                onToggleFollow={()            => handleToggleFollow(post.id, post.authorId, post.followedAuthor)}
                onAddComment={t              => handleAddComment(post.id, t)}
                onEditComment={(cId, t)      => handleEditComment(post.id, cId, t)}
                onDeleteComment={cId         => handleDeleteComment(post.id, cId)}
                onAddReply={(cId, t)         => handleAddReply(post.id, cId, t)}
                onEditReply={(cId, rId, t)   => handleEditReply(post.id, cId, rId, t)}
                onDeleteReply={(cId, rId)    => handleDeleteReply(post.id, cId, rId)}
                onShare={()                  => handleShare(post.id)}
                onEdit={()                   => handleOpenEditPost(post)}
                onDelete={()                 => handleDeletePost(post.id)}
              />
            ))}
            {loadingMore && <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 16 }} />}
          </>
        ) : (
          <View style={styles.emptyCard}>
            <Ionicons name="chatbubbles-outline" size={34} color={COLORS.muted} />
            <Text style={styles.emptyTitle}>No posts yet</Text>
            <Text style={styles.emptyText}>
              Be the first one to share a post{activeFilter !== "All" ? ` for ${activeFilter} owners` : ""}.
            </Text>
          </View>
        )}
      </ScrollView>

      <BottomNavbar activeTab="community" />

      {/* ── CREATE POST MODAL ── */}
      <Modal visible={composerVisible} transparent animationType="slide" onRequestClose={() => setComposerVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setComposerVisible(false)} />
          <View style={[styles.composerSheet, { paddingBottom: insets.bottom + 18 }]}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Create Post</Text>
              <Pressable style={styles.closeButton} onPress={() => setComposerVisible(false)} hitSlop={10}>
                <Ionicons name="close" size={22} color={COLORS.text} />
              </Pressable>
            </View>

            <View style={styles.composerIdentityRow}>
              <View style={styles.avatarSmall}>
                <Text style={styles.avatarTextSmall}>
                  {getInitials(getUserName(`${profile.user?.firstName ?? ""} ${profile.user?.lastName ?? ""}`))}
                </Text>
              </View>
              <View>
                <Text style={styles.composerName}>
                  {getUserName(`${profile.user?.firstName ?? ""} ${profile.user?.lastName ?? ""}`)}
                </Text>
                <Text style={styles.composerMeta}>Share with community</Text>
              </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <TextInput
                style={styles.composerInput}
                placeholder="Write your post..."
                placeholderTextColor={COLORS.mutedDark}
                value={newPostText}
                onChangeText={setNewPostText}
                multiline
                textAlignVertical="top"
              />

              <Text style={styles.sheetLabel}>Tags (comma separated)</Text>
              <TextInput
                style={styles.tagsInput}
                placeholder="e.g. oil, maintenance, tips"
                placeholderTextColor={COLORS.mutedDark}
                value={newPostTags}
                onChangeText={setNewPostTags}
              />

              <Text style={styles.sheetLabel}>Comments</Text>
              <View style={styles.toggleRow}>
                {(["allow", "disable"] as AllowComments[]).map(opt => (
                  <Pressable
                    key={opt}
                    style={[styles.togglePill, newPostAllowComments === opt && styles.togglePillActive]}
                    onPress={() => setNewPostAllowComments(opt)}
                  >
                    <Ionicons
                      name={opt === "allow" ? "chatbubble-outline" : "chatbubble-ellipses-outline"}
                      size={13}
                      color={newPostAllowComments === opt ? COLORS.text : COLORS.muted}
                    />
                    <Text style={[styles.toggleText, newPostAllowComments === opt && styles.toggleTextActive]}>
                      {opt === "allow" ? "Allow" : "Disable"}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.sheetLabel}>Visibility</Text>
              <View style={styles.toggleRow}>
                {AVAIL_OPTIONS.map(opt => (
                  <Pressable
                    key={opt.value}
                    style={[styles.togglePill, newPostAvailability === opt.value && styles.togglePillActive]}
                    onPress={() => setNewPostAvailability(opt.value)}
                  >
                    <Ionicons
                      name={opt.icon as any}
                      size={13}
                      color={newPostAvailability === opt.value ? COLORS.text : COLORS.muted}
                    />
                    <Text style={[styles.toggleText, newPostAvailability === opt.value && styles.toggleTextActive]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Pressable
                style={[styles.publishButton, (!newPostText.trim() || publishing) && styles.publishButtonDisabled]}
                onPress={handleCreatePost}
                disabled={!newPostText.trim() || publishing}
              >
                {publishing
                  ? <ActivityIndicator color={COLORS.text} size="small" />
                  : <Text style={styles.publishButtonText}>Publish</Text>
                }
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── EDIT POST MODAL ── */}
      <Modal visible={!!editPostId} transparent animationType="slide" onRequestClose={() => setEditPostId(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalOverlay}>
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
                onPress={handleSaveEditPost}
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
    </View>
  );
}

/* ════════════════════════════════════════
   POST CARD
════════════════════════════════════════ */
function CommunityPostCard({
  post, myUserId,
  onToggleLike, onToggleFollow,
  onAddComment, onEditComment, onDeleteComment,
  onAddReply, onEditReply, onDeleteReply,
  onShare, onEdit, onDelete,
}: {
  post: CommunityPost; myUserId: string;
  onToggleLike: () => void; onToggleFollow: () => void;
  onAddComment:    (t: string) => void;
  onEditComment:   (cId: string, t: string) => void;
  onDeleteComment: (cId: string) => void;
  onAddReply:    (cId: string, t: string) => void;
  onEditReply:   (cId: string, rId: string, t: string) => void;
  onDeleteReply: (cId: string, rId: string) => void;
  onShare: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [commentText,     setCommentText]     = useState("");
  const [showOptions,     setShowOptions]     = useState(false);
  const [confirmDelete,   setConfirmDelete]   = useState(false);
  const isMyPost = post.authorId === myUserId;
  const isPending = !!post.pending;

  const availIcon =
    post.availability === "public"  ? "globe-outline"      :
    post.availability === "friends" ? "people-outline"     :
                                      "lock-closed-outline";

  const handleSendComment = () => {
    if (!commentText.trim()) return;
    onAddComment(commentText);
    setCommentText("");
    setCommentsVisible(true);
  };

  const handleCloseOptions = () => { setShowOptions(false); setConfirmDelete(false); };

  return (
    <View style={styles.postCard}>
      {/* header */}
      <View style={styles.postHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{post.initials}</Text>
        </View>

        <View style={styles.postIdentity}>
          <View style={styles.authorRow}>
            <Text style={styles.author}>{post.author}</Text>
            {isPending && (
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingText}>Pending approval</Text>
              </View>
            )}
            {!isMyPost && !isPending && (
              <Pressable
                style={[styles.followBtn, post.followedAuthor && styles.followBtnActive]}
                onPress={onToggleFollow}
              >
                <Ionicons
                  name={post.followedAuthor ? "checkmark" : "person-add-outline"}
                  size={12}
                  color={post.followedAuthor ? COLORS.text : COLORS.primary}
                />
                <Text style={[styles.followText, post.followedAuthor && styles.followTextActive]}>
                  {post.followedAuthor ? "Following" : "Follow"}
                </Text>
              </Pressable>
            )}
          </View>
          <View style={styles.metaRow}>
            {/* FIX #6: Show vehicle model if available */}
            {!!post.vehicle && <><Text style={styles.vehicle}>{post.vehicle}</Text><Text style={styles.dot}>•</Text></>}
            <Text style={styles.time}>{post.createdAtLabel}</Text>
            <Text style={styles.dot}>•</Text>
            <Ionicons name={availIcon as any} size={12} color={COLORS.mutedDark} />
          </View>
        </View>

        {isMyPost && !isPending && (
          <Pressable
            onPress={() => { setConfirmDelete(false); setShowOptions(true); }}
            hitSlop={12}
            style={styles.dotsBtn}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color={COLORS.muted} />
          </Pressable>
        )}
      </View>

      {/* content */}
      <Text style={styles.postText}>{post.content}</Text>

      {/* tags */}
      {post.tags.length > 0 && (
        <View style={styles.tagsRow}>
          {post.tags.map(tag => (
            <View key={tag} style={styles.tagPill}>
              <Text style={styles.tagText}>#{tag}</Text>
            </View>
          ))}
        </View>
      )}

      {/* images */}
      {post.images.length > 0 && (
        <View style={[styles.imagesGrid, post.images.length > 1 && styles.imagesGridTwo]}>
          {post.images.slice(0, 2).map(uri => (
            <Image key={uri} source={{ uri }} style={styles.postImage} resizeMode="cover" />
          ))}
        </View>
      )}

      <View style={styles.actionsDivider} />

      {/* actions */}
      <View style={[styles.actionsRow, isPending && { opacity: 0.4 }]}>
        <Pressable style={styles.actionButton} onPress={onToggleLike} disabled={isPending}>
          <Ionicons
            name={post.likedByMe ? "heart" : "heart-outline"}
            size={25}
            color={post.likedByMe ? COLORS.primary : COLORS.muted}
          />
          <Text style={[styles.actionText, post.likedByMe && styles.actionTextActive]}>{post.likes}</Text>
        </Pressable>

        {post.allowComments === "allow" && (
          <Pressable style={styles.actionButton} onPress={() => setCommentsVisible(v => !v)} disabled={isPending}>
            <Ionicons name="chatbubble-outline" size={24} color={COLORS.muted} />
            <Text style={styles.actionText}>{post.comments.length}</Text>
          </Pressable>
        )}

        <Pressable style={styles.shareButton} onPress={onShare} disabled={isPending}>
          <Ionicons name="share-social-outline" size={24} color={COLORS.muted} />
          {post.shares > 0 && <Text style={styles.shareCount}>{post.shares}</Text>}
        </Pressable>
      </View>

      {/* comments section */}
      {post.allowComments === "allow" && !isPending && (
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
            <Pressable style={styles.sendButton} onPress={handleSendComment}>
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
                  onEdit={t           => onEditComment(comment.id, t)}
                  onDelete={()        => onDeleteComment(comment.id)}
                  onAddReply={t       => onAddReply(comment.id, t)}
                  onEditReply={(rId, t) => onEditReply(comment.id, rId, t)}
                  onDeleteReply={rId  => onDeleteReply(comment.id, rId)}
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
                  <View style={[styles.iconWrap, { backgroundColor: "rgba(50,104,247,0.12)" }]}>
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
                  <View style={[styles.iconWrap, { backgroundColor: "rgba(239,68,68,0.12)" }]}>
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
                <Text style={styles.confirmSub}>This post will be permanently deleted and cannot be recovered.</Text>
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
function CommentItem({
  comment, myUserId, onEdit, onDelete, onAddReply, onEditReply, onDeleteReply,
}: {
  comment: CommunityComment; myUserId: string;
  onEdit: (t: string) => void; onDelete: () => void;
  onAddReply:    (t: string) => void;
  onEditReply:   (rId: string, t: string) => void;
  onDeleteReply: (rId: string) => void;
}) {
  const [repliesVisible, setRepliesVisible] = useState(false);
  const [replyText,      setReplyText]      = useState("");
  const [editing,        setEditing]        = useState(false);
  const [editText,       setEditText]       = useState(comment.text);
  const [showOptions,    setShowOptions]    = useState(false);
  const [confirmDelete,  setConfirmDelete]  = useState(false);

  const isMyComment = comment.authorId === myUserId;
  const handleCloseOptions = () => { setShowOptions(false); setConfirmDelete(false); };

  const handleSendReply = () => {
    if (!replyText.trim()) return;
    onAddReply(replyText);
    setReplyText("");
    setRepliesVisible(true);
  };

  return (
    <View style={styles.commentItem}>
      {editing ? (
        <View>
          <TextInput
            style={styles.editInput}
            value={editText}
            onChangeText={setEditText}
            multiline
            placeholderTextColor={COLORS.mutedDark}
            autoFocus
          />
          <View style={styles.editActions}>
            <Pressable onPress={() => setEditing(false)}>
              <Text style={styles.cancelEditText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.saveEditBtn} onPress={() => { onEdit(editText); setEditing(false); }}>
              <Text style={styles.saveEditText}>Save</Text>
            </Pressable>
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
                  <Ionicons name="ellipsis-horizontal" size={16} color={COLORS.mutedDark} />
                </Pressable>
              )}
            </View>
          </View>
          <Text style={styles.commentText}>{comment.text}</Text>
          <Pressable style={styles.replyTrigger} onPress={() => setRepliesVisible(v => !v)}>
            <Ionicons name="return-down-forward-outline" size={13} color={COLORS.primary} />
            <Text style={styles.replyTriggerText}>
              {repliesVisible ? "Hide replies" : `Reply${comment.replies.length > 0 ? ` (${comment.replies.length})` : ""}`}
            </Text>
          </Pressable>
        </>
      )}

      {repliesVisible && (
        <View style={styles.repliesWrap}>
          {comment.replies.map(reply => (
            <ReplyItem
              key={reply.id} reply={reply} myUserId={myUserId}
              onEdit={t  => onEditReply(reply.id, t)}
              onDelete={() => onDeleteReply(reply.id)}
            />
          ))}
          <View style={styles.commentInputRow}>
            <TextInput
              style={styles.commentInput}
              placeholder="Write a reply..."
              placeholderTextColor={COLORS.mutedDark}
              value={replyText}
              onChangeText={setReplyText}
              multiline
            />
            <Pressable style={styles.sendButton} onPress={handleSendReply}>
              <Ionicons name="send" size={16} color={COLORS.text} />
            </Pressable>
          </View>
        </View>
      )}

      {/* COMMENT OPTIONS MODAL */}
      <Modal visible={showOptions} transparent animationType="fade" onRequestClose={handleCloseOptions}>
        <Pressable style={styles.backdrop} onPress={handleCloseOptions}>
          <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
            {!confirmDelete ? (
              <>
                <View style={styles.handle} />
                <Text style={styles.sheetTitle}>Comment Options</Text>
                <Pressable style={styles.optionRow} onPress={() => { setEditText(comment.text); handleCloseOptions(); setEditing(true); }}>
                  <View style={[styles.iconWrap, { backgroundColor: "rgba(50,104,247,0.12)" }]}>
                    <Ionicons name="create-outline" size={20} color={COLORS.primary} />
                  </View>
                  <View style={styles.optionText}>
                    <Text style={styles.optionLabel}>Edit Comment</Text>
                    <Text style={styles.optionSub}>Change your comment</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={COLORS.mutedDark} />
                </Pressable>
                <View style={styles.separator} />
                <Pressable style={styles.optionRow} onPress={() => setConfirmDelete(true)}>
                  <View style={[styles.iconWrap, { backgroundColor: "rgba(239,68,68,0.12)" }]}>
                    <Ionicons name="trash-outline" size={20} color={COLORS.danger} />
                  </View>
                  <View style={styles.optionText}>
                    <Text style={[styles.optionLabel, { color: COLORS.danger }]}>Delete Comment</Text>
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
                <Text style={styles.confirmTitle}>Delete Comment?</Text>
                <Text style={styles.confirmSub}>This comment will be permanently deleted and cannot be recovered.</Text>
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
   REPLY ITEM
════════════════════════════════════════ */
function ReplyItem({ reply, myUserId, onEdit, onDelete }: {
  reply: CommunityReply; myUserId: string;
  onEdit: (t: string) => void; onDelete: () => void;
}) {
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
          <TextInput
            style={styles.editInput}
            value={editText}
            onChangeText={setEditText}
            multiline
            placeholderTextColor={COLORS.mutedDark}
            autoFocus
          />
          <View style={styles.editActions}>
            <Pressable onPress={() => setEditing(false)}>
              <Text style={styles.cancelEditText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.saveEditBtn} onPress={() => { onEdit(editText); setEditing(false); }}>
              <Text style={styles.saveEditText}>Save</Text>
            </Pressable>
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
                  <Ionicons name="ellipsis-horizontal" size={14} color={COLORS.mutedDark} />
                </Pressable>
              )}
            </View>
          </View>
          <Text style={styles.commentText}>{reply.text}</Text>
        </>
      )}

      {/* REPLY OPTIONS MODAL */}
      <Modal visible={showOptions} transparent animationType="fade" onRequestClose={handleCloseOptions}>
        <Pressable style={styles.backdrop} onPress={handleCloseOptions}>
          <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
            {!confirmDelete ? (
              <>
                <View style={styles.handle} />
                <Text style={styles.sheetTitle}>Reply Options</Text>
                <Pressable style={styles.optionRow} onPress={() => { setEditText(reply.text); handleCloseOptions(); setEditing(true); }}>
                  <View style={[styles.iconWrap, { backgroundColor: "rgba(50,104,247,0.12)" }]}>
                    <Ionicons name="create-outline" size={20} color={COLORS.primary} />
                  </View>
                  <View style={styles.optionText}>
                    <Text style={styles.optionLabel}>Edit Reply</Text>
                    <Text style={styles.optionSub}>Change your reply</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={COLORS.mutedDark} />
                </Pressable>
                <View style={styles.separator} />
                <Pressable style={styles.optionRow} onPress={() => setConfirmDelete(true)}>
                  <View style={[styles.iconWrap, { backgroundColor: "rgba(239,68,68,0.12)" }]}>
                    <Ionicons name="trash-outline" size={20} color={COLORS.danger} />
                  </View>
                  <View style={styles.optionText}>
                    <Text style={[styles.optionLabel, { color: COLORS.danger }]}>Delete Reply</Text>
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
                <Text style={styles.confirmTitle}>Delete Reply?</Text>
                <Text style={styles.confirmSub}>This reply will be permanently deleted and cannot be recovered.</Text>
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
   STYLES
════════════════════════════════════════ */
const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLORS.background },
  header:       { paddingHorizontal: 22,paddingTop: 14, paddingBottom: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title:        { color: COLORS.text, fontSize: 24, fontWeight: "800" },
  headerActions:{ flexDirection: "row", alignItems: "center", gap: 16 },
  headerIcon:   { width: 40, height: 40, borderRadius: 20,borderWidth: 1,backgroundColor: COLORS.surfaceLight,borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  divider:      { height: 1, backgroundColor: COLORS.divider },
  scroll:       { flex: 1 },
  content:      { paddingTop: 20, paddingHorizontal: 20 },

  createButton:     { height: 60, borderRadius: 17, backgroundColor: COLORS.primary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 20 },
  createButtonText: { color: COLORS.text, fontSize: 17, fontWeight: "700" },

  filtersRow:       { gap: 10, paddingBottom: 20 },
  filterPill:       { minWidth: 68, height: 46, borderRadius: 23, paddingHorizontal: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.46)", alignItems: "center", justifyContent: "center" },
  filterPillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterText:       { color: COLORS.muted, fontSize: 15, fontWeight: "700" },
  filterTextActive: { color: COLORS.text },

  postCard:     { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 18, padding: 18, marginBottom: 16 },
  postHeader:   { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 14 },
  avatar:       { width: 52, height: 52, borderRadius: 26, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  avatarText:   { color: COLORS.text, fontSize: 18, fontWeight: "800" },
  postIdentity: { flex: 1 },
  authorRow:    { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  author:       { color: COLORS.text, fontSize: 16, fontWeight: "800" },

  followBtn:       { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: COLORS.primary },
  followBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  followText:      { color: COLORS.primary, fontSize: 12, fontWeight: "700" },
  followTextActive:{ color: COLORS.text },

  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3, flexWrap: "wrap" },
  vehicle: { color: "#5da0ff", fontSize: 14 },
  dot:     { color: COLORS.mutedDark, fontSize: 14 },
  time:    { color: COLORS.mutedDark, fontSize: 14 },

  postText: { color: COLORS.muted, fontSize: 17, lineHeight: 28, marginBottom: 12 },
  tagsRow:  { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  tagPill:  { backgroundColor: COLORS.surfaceLight, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  tagText:  { color: COLORS.primary, fontSize: 13, fontWeight: "600" },

  imagesGrid:    { width: "100%", height: 210, borderRadius: 12, overflow: "hidden", marginBottom: 16 },
  imagesGridTwo: { flexDirection: "row", gap: 8 },
  postImage:     { flex: 1, width: "100%", height: "100%", backgroundColor: COLORS.input, borderRadius: 12 },

  actionsDivider: { height: 1, backgroundColor: COLORS.divider, marginBottom: 14 },
  actionsRow:     { flexDirection: "row", alignItems: "center" },
  actionButton:   { flexDirection: "row", alignItems: "center", gap: 8, marginRight: 26 },
  actionText:     { color: COLORS.muted, fontSize: 16 },
  actionTextActive:{ color: COLORS.primary, fontWeight: "700" },
  shareButton:    { marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 5 },
  shareCount:     { color: COLORS.muted, fontSize: 14 },

  commentsWrap:  { marginTop: 10, gap: 10 },
  commentItem:   { backgroundColor: COLORS.surfaceLight, borderRadius: 12, padding: 10, gap: 6 },
  commentHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  commentAuthor: { color: COLORS.text, fontSize: 13, fontWeight: "700" },
  commentText:   { color: COLORS.muted, fontSize: 14, lineHeight: 20 },
  commentTime:   { color: COLORS.mutedDark, fontSize: 11 },

  replyTrigger:     { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  replyTriggerText: { color: COLORS.primary, fontSize: 12, fontWeight: "700" },

  repliesWrap: { marginTop: 8, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: COLORS.primary, gap: 8 },
  replyItem:   { backgroundColor: COLORS.input, borderRadius: 10, padding: 8, gap: 4 },

  editInput:      { backgroundColor: COLORS.input, borderRadius: 10, padding: 10, color: COLORS.text, fontSize: 14, minHeight: 60, marginBottom: 8 },
  editActions:    { flexDirection: "row", justifyContent: "flex-end", gap: 10 },
  cancelEditText: { color: COLORS.muted, fontSize: 13, fontWeight: "700", paddingVertical: 6 },
  saveEditBtn:    { backgroundColor: COLORS.primary, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 6 },
  saveEditText:   { color: COLORS.text, fontSize: 13, fontWeight: "700" },

  commentInputRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginTop: 4 },
  commentInput:    { flex: 1, minHeight: 42, maxHeight: 92, borderRadius: 14, backgroundColor: COLORS.input, color: COLORS.text, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  sendButton:      { width: 42, height: 42, borderRadius: 14, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },

  emptyCard:  { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 18, padding: 22, alignItems: "center", gap: 8 },
  emptyTitle: { color: COLORS.text, fontSize: 18, fontWeight: "800" },
  emptyText:  { color: COLORS.muted, fontSize: 14, textAlign: "center", lineHeight: 20 },

  modalOverlay:   { flex: 1, justifyContent: "flex-end" },
  modalBackdrop:  { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.58)" },
  composerSheet:  { backgroundColor: COLORS.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 20, paddingTop: 18, borderWidth: 1, borderColor: COLORS.border, maxHeight: "90%" },
  sheetHeader:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  sheetTitle:     { color: COLORS.text, fontSize: 22, fontWeight: "800" },
  closeButton:    { width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.input, alignItems: "center", justifyContent: "center" },

  composerIdentityRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  avatarSmall:         { width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  avatarTextSmall:     { color: COLORS.text, fontSize: 14, fontWeight: "800" },
  composerName:        { color: COLORS.text, fontSize: 15, fontWeight: "800" },
  composerMeta:        { color: COLORS.mutedDark, fontSize: 13, marginTop: 2 },
  composerInput:       { minHeight: 120, borderRadius: 16, backgroundColor: COLORS.input, color: COLORS.text, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, lineHeight: 23, marginBottom: 14 },

  sheetLabel:    { color: COLORS.muted, fontSize: 14, fontWeight: "700", marginBottom: 10 },
  tagsInput:     { height: 44, borderRadius: 12, backgroundColor: COLORS.input, color: COLORS.text, paddingHorizontal: 12, fontSize: 14, marginBottom: 14 },
  toggleRow:     { flexDirection: "row", gap: 8, marginBottom: 14, flexWrap: "wrap" },
  togglePill:    { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  togglePillActive:  { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  toggleText:        { color: COLORS.muted, fontSize: 13, fontWeight: "700" },
  toggleTextActive:  { color: COLORS.text },

  publishButton:         { height: 54, borderRadius: 17, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  publishButtonDisabled: { opacity: 0.45 },
  publishButtonText:     { color: COLORS.text, fontSize: 17, fontWeight: "800" },

  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet:    { backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 36, borderWidth: 1, borderColor: COLORS.border },
  handle:   { width: 40, height: 4, backgroundColor: COLORS.mutedDark, borderRadius: 2, alignSelf: "center", marginBottom: 20, opacity: 0.5 },

  optionRow:  { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 12 },
  iconWrap:   { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  optionText: { flex: 1 },
  optionLabel:{ color: COLORS.text, fontSize: 15, fontWeight: "700" },
  optionSub:  { color: COLORS.mutedDark, fontSize: 12, marginTop: 2 },
  separator:  { height: 1, backgroundColor: COLORS.divider, marginVertical: 4 },
  cancelBtn:  { marginTop: 16, height: 50, borderRadius: 14, backgroundColor: COLORS.surfaceLight, alignItems: "center", justifyContent: "center" },
  cancelText: { color: COLORS.muted, fontSize: 15, fontWeight: "700" },

  confirmIcon:  { width: 72, height: 72, borderRadius: 36, backgroundColor: "rgba(239,68,68,0.12)", alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 16 },
  confirmTitle: { color: COLORS.text, fontSize: 20, fontWeight: "800", textAlign: "center", marginBottom: 8 },
  confirmSub:   { color: COLORS.mutedDark, fontSize: 14, textAlign: "center", lineHeight: 20, marginBottom: 24 },
  deleteBtn:    { height: 50, borderRadius: 14, backgroundColor: COLORS.danger, alignItems: "center", justifyContent: "center" },
  deleteBtnText:{ color: COLORS.text, fontSize: 15, fontWeight: "800" },

  dotsBtn: { padding: 6, zIndex: 999, elevation: 10 },

  pendingBadge: { backgroundColor: "rgba(255,200,0,0.15)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: "rgba(255,200,0,0.3)" },
  pendingText:  { color: "#f5c400", fontSize: 11, fontWeight: "700" },

  sheetFiltersRow: { gap: 10, paddingBottom: 16 },
  sheetFilterPill: { height: 40, borderRadius: 20, paddingHorizontal: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.35)", alignItems: "center", justifyContent: "center" },
});