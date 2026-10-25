'use client';
export class ApiError extends Error { constructor(public status: number, msg: string) { super(msg); } }
export async function api<T = any>(url: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const r = await fetch(url, { method: opts.method || (opts.body !== undefined ? 'POST' : 'GET'), headers: opts.body !== undefined ? { 'content-type': 'application/json' } : undefined, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined, cache: 'no-store' });
  let data: any = null;
  try { data = await r.json(); } catch { /* */ }
  if (r.status === 401 && typeof window !== 'undefined' && !location.pathname.startsWith('/login')) { location.href = '/login'; }
  if (!r.ok) throw new ApiError(r.status, data?.error || `Request failed (${r.status})`);
  return data as T;
}
export const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
export const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const fmtTime = (t: number) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
export const fmtDay = (t: number) => new Date(t).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
export const fmtLong = (t: number) => new Date(t).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
export function rel(t: number) {
  const d = Date.now() - t, a = Math.abs(d);
  const s = a < 60_000 ? 'just now' : a < 3600_000 ? `${Math.round(a / 60_000)} min` : a < 86400_000 ? `${Math.round(a / 3600_000)} h` : `${Math.round(a / 86400_000)} d`;
  if (s === 'just now') return s;
  return d >= 0 ? `${s} ago` : `in ${s}`;
}
export function dayLabel(t: number) {
  const d = new Date(t), n = new Date();
  const k = (x: Date) => x.toDateString();
  if (k(d) === k(n)) return 'Tonight';
  const tm = new Date(n); tm.setDate(n.getDate() + 1);
  if (k(d) === k(tm)) return 'Tomorrow';
  return d.toLocaleDateString([], { weekday: 'short' });
}
export function greeting() { const h = new Date().getHours(); return h < 5 ? 'Good evening' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; }
export const KIND_LABEL: Record<string, string> = { shiur: 'Shiur', lecture: 'Lecture', philosophy: 'Philosophy' };

export type Embed = { type: 'iframe' | 'video' | 'audio' | 'link'; src: string };
export function toEmbed(url?: string | null, mediaType?: string): Embed | null {
  if (!url) return null;
  try {
    const u = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    const h = u.hostname.replace(/^www\.|^m\./, '');
    if (h === 'youtube.com' || h === 'youtu.be' || h === 'youtube-nocookie.com') {
      let id = h === 'youtu.be' ? u.pathname.slice(1) : u.searchParams.get('v') || '';
      const m = u.pathname.match(/\/(embed|live|shorts)\/([\w-]+)/); if (m) id = m[2];
      if (id) return { type: 'iframe', src: `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1` };
    }
    if (h === 'vimeo.com' || h === 'player.vimeo.com') {
      const m = u.pathname.match(/(\d{5,})/);
      if (m) return { type: 'iframe', src: `https://player.vimeo.com/video/${m[1]}` };
    }
    if (/\.(mp3|m4a|ogg|wav|aac)(\?|$)/i.test(u.pathname) || mediaType === 'audio') return { type: 'audio', src: url };
    if (/\.(mp4|webm|mov|m3u8)(\?|$)/i.test(u.pathname)) return { type: 'video', src: url };
    return { type: 'link', src: url };
  } catch { return null; }
}
