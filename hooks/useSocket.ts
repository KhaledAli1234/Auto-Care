
import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { BASE_URL } from '@/constants/api';

let _socket: Socket | null = null;
let _socketUserId: string | null = null;

export function getSocket(): Socket | null {
  return _socket;
}

export function useSocket(
  userId: string | undefined,
  onNotification: (notification: any) => void,
) {
  const onNotificationRef = useRef(onNotification);
  onNotificationRef.current = onNotification;

  useEffect(() => {

    if (!userId || userId.trim() === '') {
      return;
    }

    if (_socket && _socketUserId !== userId) {
      console.log(`[Socket] userId changed (${_socketUserId} → ${userId}). Recreating.`);
      _socket.removeAllListeners();
      _socket.disconnect();
      _socket = null;
      _socketUserId = null;
    }

    if (!_socket) {
      console.log(`[Socket] Creating socket for userId=${userId}, server=${BASE_URL}`);

      _socket = io(BASE_URL, {
        transports: ['websocket'],
        query: { userId },
        reconnection: true,
        reconnectionDelay: 3000,
        reconnectionDelayMax: 10000,
        reconnectionAttempts: 10,
        timeout: 10000,
      });

      _socketUserId = userId;

      _socket.on('connect', () => {
        console.log(`[Socket] ✅ connected — id=${_socket?.id} room=userId:${userId}`);
      });

      _socket.on('disconnect', (reason) => {
        console.log(`[Socket] disconnected — reason=${reason}`);
      });

      _socket.on('connect_error', (err) => {
        console.warn(`[Socket] connect_error: ${err.message}`);
      });

      _socket.on('reconnect_failed', () => {
        console.warn('[Socket] reconnect_failed — gave up after max attempts.');
      });
    }

    const handleNotification = (data: any) => {
      onNotificationRef.current(data);
    };

    _socket.on('notification', handleNotification);

    return () => {
      _socket?.off('notification', handleNotification);
    };
  }, [userId]);
}

export function disconnectSocket() {
  if (_socket) {
    console.log('[Socket] disconnecting on logout.');
    _socket.removeAllListeners();
    _socket.disconnect();
    _socket = null;
    _socketUserId = null;
  }
}
