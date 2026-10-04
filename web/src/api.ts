// 后端 API 封装：自动带上当前登录人（x-user-id，演示用登录态）
const BASE = '/api';

export interface ApiUser {
  id: string;
  login: string;
  name: string;
  roles: string[];
}

let currentUserId: string | null = localStorage.getItem('uid');

export function setCurrentUser(id: string | null) {
  currentUserId = id;
  if (id) localStorage.setItem('uid', id);
  else localStorage.removeItem('uid');
}
export function getCurrentUserId() {
  return currentUserId;
}

export async function api<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (currentUserId) headers.set('x-user-id', currentUserId);
  if (options.body && !(options.body instanceof FormData)) {
    headers.set('content-type', 'application/json');
  }
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = Array.isArray(data?.message) ? data.message.join('；') : data?.message;
    const err = new Error(msg || `请求失败 HTTP ${res.status}`);
    (err as any).status = res.status;
    throw err;
  }
  return data as T;
}

export const upload = <T = any>(path: string, form: FormData) =>
  api<T>(path, { method: 'POST', body: form });
