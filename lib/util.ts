import crypto from 'node:crypto';
export const uid = (n = 12) => crypto.randomBytes(16).toString('base64url').replace(/[-_]/g, '').slice(0, n);
export const now = () => Date.now();
export function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
export function inviteCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  const b = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) s += A[b[i] % A.length];
  return s;
}
export function parseJSON<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try { return JSON.parse(s) as T; } catch { return fallback; }
}
