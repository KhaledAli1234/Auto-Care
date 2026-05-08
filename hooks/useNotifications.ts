// hooks/useNotifications.ts
import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '@/constants/api';

export interface ApiNotification {
  _id: string;
  type: 'follow' | 'like' | 'comment' | 'reply' | 'mention' | 'system_alert';
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  sender?: {
    _id: string;
    username?: string;
    profileImage?: string;
  };
}

async function authHeaders() {
  const token = await AsyncStorage.getItem('access_token');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token?.replace(/"/g, '') ?? ''}`,
  };
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [loading,       setLoading]       = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const res  = await fetch(`${BASE_URL}/notifications`, {
        method: 'GET',
        headers: await authHeaders(),
      });
      const json = await res.json();
      if (res.ok) {
        setNotifications(json?.data?.notifications ?? []);
        setUnreadCount(json?.data?.unreadCount ?? 0);
      }
    } catch (err) {
      console.log('[notifications] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await fetch(`${BASE_URL}/notifications/read-all`, {
        method: 'PATCH',
        headers: await authHeaders(),
      });
      setUnreadCount(0);
      setNotifications(cur => cur.map(n => ({ ...n, read: true })));
    } catch (err) {
      console.log('[notifications] markAllAsRead error:', err);
    }
  }, []);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  return { notifications, unreadCount, loading, fetchNotifications, markAllAsRead };
}