'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '@/lib/client';

export type Me = { id: string; name: string; email: string; initials: string; color: number; role: 'member' | 'admin'; title: string; bio: string; interests: string[]; createdAt: number; isDemo: boolean };
type AI = { configured: boolean; model: string | null; label: string };
type Handler = (type: string, data: any, channel: string) => void;
type Notif = { id: string; title: string; body: string; link: string | null; kind: string };

const MeCtx = createContext<{ me: Me | null; ai: AI | null; unread: number; setUnread: (n: number) => void; refresh: () => Promise<void>; loaded: boolean; liveNow: string | null; online: number; toast: (m: string, kind?: 'ok' | 'err') => void }>(null as never);
const StreamCtx = createContext<{ subscribe: (channels: string[], h: Handler) => () => void; connected: boolean }>(null as never);

export const useMe = () => useContext(MeCtx);
export const useToast = () => useContext(MeCtx).toast;

export function useStream(channels: string[], handler: Handler) {
  const { subscribe } = useContext(StreamCtx);
  const ref = useRef(handler);
  ref.current = handler;
  const key = channels.filter(Boolean).join(',');
  useEffect(() => subscribe(key ? key.split(',') : [], (t, d, c) => ref.current(t, d, c)), [key, subscribe]);
}
export const useConnected = () => useContext(StreamCtx).connected;

const TYPES = ['hello', 'message', 'checking', 'factcheck', 'heat', 'moved', 'members', 'update', 'rsvp', 'status', 'questions', 'notification', 'presence'];
const PUBLIC = ['/login', '/join', '/apply'];

export function Providers({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [ai, setAi] = useState<AI | null>(null);
  const [unread, setUnread] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [liveNow, setLiveNow] = useState<string | null>(null);
  const [online, setOnline] = useState(0);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastKind, setToastKind] = useState<'ok' | 'err'>('ok');
  const [banner, setBanner] = useState<Notif | null>(null);
  const [connected, setConnected] = useState(false);
  const path = usePathname() || '/';
  const router = useRouter();
  const subs = useRef(new Map<number, { channels: string[]; h: Handler }>());
  const seq = useRef(0);
  const [chanKey, setChanKey] = useState('');
  const toastT = useRef<ReturnType<typeof setTimeout>>(undefined);
  const bannerT = useRef<ReturnType<typeof setTimeout>>(undefined);

  const toast = useCallback((m: string, kind: 'ok' | 'err' = 'ok') => { setToastMsg(m); setToastKind(kind); clearTimeout(toastT.current); toastT.current = setTimeout(() => setToastMsg(null), 2600); }, []);

  const refresh = useCallback(async () => {
    try {
      const r = await api<{ user: Me | null; unread: number; ai: AI }>('/api/me');
      setMe(r.user); setAi(r.ai); setUnread(r.unread ?? 0);
    } catch { setMe(null); }
    setLoaded(true);
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (loaded && !me && !PUBLIC.some((p) => path.startsWith(p))) router.replace('/login');
  }, [loaded, me, path, router]);

  const checkLive = useCallback(async () => {
    try { const r = await api<{ events: { id: string; status: string }[] }>('/api/events?scope=upcoming'); setLiveNow(r.events.find((e) => e.status === 'live')?.id ?? null); } catch { /* */ }
  }, []);
  useEffect(() => { if (me) checkLive(); }, [me, checkLive]);

  const recompute = useCallback(() => {
    const all = new Set<string>();
    for (const s of subs.current.values()) s.channels.forEach((c) => all.add(c));
    setChanKey([...all].sort().join(','));
  }, []);
  const subscribe = useCallback((channels: string[], h: Handler) => {
    const id = ++seq.current;
    subs.current.set(id, { channels, h });
    recompute();
    return () => { subs.current.delete(id); recompute(); };
  }, [recompute]);

  // service worker + PWA
  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);

  useEffect(() => {
    if (!me) return;
    let es: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let closed = false;
    const connect = () => {
      es = new EventSource(`/api/stream${chanKey ? `?ch=${encodeURIComponent(chanKey)}` : ''}`);
      es.onopen = () => setConnected(true);
      es.onerror = () => { setConnected(false); es?.close(); if (!closed) retry = setTimeout(connect, 2500); };
      for (const t of TYPES) es.addEventListener(t, (ev) => {
        let payload: { channel: string; data: any };
        try { payload = JSON.parse((ev as MessageEvent).data); } catch { return; }
        const { channel, data } = payload;
        if (t === 'hello') setOnline(data.online ?? 0);
        if (t === 'presence' && data?.channel === 'app') setOnline(data.count);
        if (channel === 'events' && (t === 'update')) checkLive();
        if (t === 'notification') {
          setUnread((n) => n + 1);
          setBanner(data); clearTimeout(bannerT.current); bannerT.current = setTimeout(() => setBanner(null), 6000);
          try {
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
              navigator.serviceWorker?.ready.then((reg) => reg.showNotification(data.title, { body: data.body, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', data: { link: data.link || '/' }, tag: data.id }));
            }
          } catch { /* */ }
        }
        for (const s of subs.current.values()) {
          if (!channel || s.channels.includes(channel) || ['rooms', 'events', 'presence'].includes(channel) || channel.startsWith('user:')) {
            try { s.h(t, data, channel); } catch (e) { console.error(e); }
          }
        }
      });
    };
    connect();
    return () => { closed = true; clearTimeout(retry); es?.close(); setConnected(false); };
  }, [me, chanKey, checkLive]);

  const ctx = useMemo(() => ({ me, ai, unread, setUnread, refresh, loaded, liveNow, online, toast }), [me, ai, unread, refresh, loaded, liveNow, online, toast]);
  return (
    <MeCtx.Provider value={ctx}>
      <StreamCtx.Provider value={{ subscribe, connected }}>
        {children}
        {banner ? (
          <div className="notif" role="status" onClick={() => { setBanner(null); if (banner.link) router.push(banner.link); }} data-testid="notif-banner">
            <div className="appic"><svg width="24" height="24" viewBox="0 0 120 120"><circle cx="60" cy="60" r="50" fill="none" stroke="#C9A45C" strokeWidth="4" />{[[60, 40], [49, 52], [71, 52], [60, 64], [49, 76], [71, 76]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="9" fill="#E3C88A" />)}</svg></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="row between"><b style={{ fontSize: 12, letterSpacing: '.06em', color: '#C5CBD8' }}>KEREM</b><span style={{ fontSize: 11.5, color: '#8C95AA' }}>now</span></div>
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>{banner.title}</div>
              <div style={{ fontSize: 13, color: '#C5CBD8', marginTop: 1, lineHeight: 1.35 }}>{banner.body}</div>
            </div>
          </div>
        ) : null}
        {toastMsg ? <div className="toast" role={toastKind === 'err' ? 'alert' : 'status'}><span style={{ width: 22, height: 22, borderRadius: '50%', background: toastKind === 'err' ? '#7A2E2E' : '#0B1426', color: toastKind === 'err' ? '#FFE1E1' : '#E3C88A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flex: 'none' }}>{toastKind === 'err' ? '!' : '✓'}</span>{toastMsg}</div> : null}
      </StreamCtx.Provider>
    </MeCtx.Provider>
  );
}
