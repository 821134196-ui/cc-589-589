import type { ApiError } from './types';

const BASE = '/api';

export function getCurrentUserId(): string {
  return localStorage.getItem('uid') || '';
}

interface Options {
  method?: string;
  body?: unknown;
  formData?: FormData;
  /** 显式指定操作人（规则演示页用），默认取当前切换的用户 */
  userId?: number | string;
}

export async function api<T = any>(path: string, opts: Options = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const uid = opts.userId ?? getCurrentUserId();
  if (uid !== '' && uid !== undefined && uid !== null) headers['x-user-id'] = String(uid);
  let body: BodyInit | undefined;
  if (opts.formData) {
    body = opts.formData;
  } else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  const res = await fetch(BASE + path, { method: opts.method ?? 'GET', headers, body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = Array.isArray(data.message) ? data.message.join('；') : data.message || res.statusText;
    throw { status: res.status, message: msg } as ApiError;
  }
  return data as T;
}
