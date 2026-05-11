import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from './api';

export async function authHeaders() {
  const token = await AsyncStorage.getItem('access_token');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token?.replace(/"/g, '') ?? ''}`,
    'ngrok-skip-browser-warning': 'true',
  };
}

export async function apiGet(path: string) {
  const res  = await fetch(`${BASE_URL}${path}`, { method: 'GET', headers: await authHeaders() });
  const json = await res.json();
  if (!res.ok) console.warn(`[GET ${path}]`, json);
  return json;
}

export async function apiPost(path: string, body?: object) {
  const res  = await fetch(`${BASE_URL}${path}`, {
    method: 'POST', headers: await authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) console.warn(`[POST ${path}]`, json);
  return json;
}

export async function apiPatch(path: string, body?: object) {
  const res  = await fetch(`${BASE_URL}${path}`, {
    method: 'PATCH', headers: await authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) console.warn(`[PATCH ${path}]`, json);
  return json;
}

export async function apiDelete(path: string) {
  const res  = await fetch(`${BASE_URL}${path}`, { method: 'DELETE', headers: await authHeaders() });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) console.warn(`[DELETE ${path}]`, json);
  return json;
}