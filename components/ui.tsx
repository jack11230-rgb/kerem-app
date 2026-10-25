'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode, CSSProperties } from 'react';
import { useMe } from './Providers';

const IC: Record<string, ReactNode> = {
  home: <path d="M3 10.5L12 3l9 7.5V21h-6v-6H9v6H3z" />,
  lib: <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M10 9l5 3-5 3z" /></>,
  chat: <path d="M4 5h16v11H9l-5 4z" />,
  live: <><circle cx="12" cy="12" r="2.5" /><path d="M7.5 7.5a6.4 6.4 0 0 0 0 9M16.5 7.5a6.4 6.4 0 0 1 0 9M4.6 4.6a10.5 10.5 0 0 0 0 14.8M19.4 4.6a10.5 10.5 0 0 1 0 14.8" /></>,
  me: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>,
  bell: <path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4" />,
  cal: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></>,
  back: <path d="M15 5l-7 7 7 7" />,
  pin: <><path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z" /><circle cx="12" cy="10" r="2" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  send: <path d="M4 12l16-8-6 16-2-7z" />,
  play: <path d="M8 5l11 7-11 7z" />,
  check: <path d="M5 12.5l4.5 4.5L19 7" />,
  plus: <path d="M12 5v14M5 12h14" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  up: <path d="M6 15l6-6 6 6" />,
  shield: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />,
  rooms: <><path d="M4 5h11v8H8l-4 3z" /><path d="M9 16v1h7l4 3v-11h-3" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c1-3.5 3.5-5.5 6.5-5.5s5.5 2 6.5 5.5" /><circle cx="17" cy="9" r="2.5" /><path d="M17 14c2.3 0 4 1.5 4.6 4" /></>,
  download: <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />,
  edit: <path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4" />,
  logout: <path d="M10 5H5v14h5M14 8l4 4-4 4M18 12H9" />,
  bookmark: <path d="M6 4h12v17l-6-4-6 4z" />,
  flame: <path d="M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-3.5 2-5.5 1 1.5 2 2 2 2 0-2.5 0-4.5 1-6.5z" />,
  spark: <path d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6z" />,
  archive: <><rect x="3" y="4" width="18" height="5" rx="1.5" /><path d="M5 9v10h14V9M10 13h4" /></>,
};
export function Icon({ k, s = 16, c = 'currentColor', w = 1.7, style }: { k: string; s?: number; c?: string; w?: number; style?: CSSProperties }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden>{IC[k]}</svg>;
}
export type PU = { id: string; name: string; initials: string; color: number };
export function Av({ u, size, style }: { u?: Partial<PU> | null; size?: number; style?: CSSProperties }) {
  return <span className={`av a${u?.color ?? 1}`} title={u?.name} style={size ? { width: size, height: size, fontSize: size * 0.38, ...style } : style}>{u?.initials ?? '?'}</span>;
}
export function Stack({ users, max = 4 }: { users: (PU | null | undefined)[]; max?: number }) {
  return <span className="stack">{users.filter(Boolean).slice(0, max).map((u) => <Av key={u!.id} u={u} />)}</span>;
}
export function Logo({ s = 32 }: { s?: number }) {
  const dots = [[60, 40], [49, 50], [71, 50], [38, 61], [60, 61], [82, 61], [49, 72], [71, 72], [60, 83]];
  const gid = `gg${s}`;
  return (
    <svg width={s} height={s} viewBox="0 0 120 120" aria-label="Kerem">
      <defs><linearGradient id={gid} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#E3C88A" /><stop offset="1" stopColor="#B88F45" /></linearGradient></defs>
      <circle cx="60" cy="60" r="56" fill="none" stroke={`url(#${gid})`} strokeWidth="2" />
      <path d="M60 24c0 0 4-8 14-9" stroke={`url(#${gid})`} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M66 20c8-6 18-2 18 6-8 2-14-1-18-6z" fill={`url(#${gid})`} opacity=".85" />
      {dots.map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="9.2" fill={`url(#${gid})`} />)}
    </svg>
  );
}
export function TabBar() {
  const p = usePathname() || '/';
  const { liveNow } = useMe();
  const tabs: [string, string, string, (p: string) => boolean][] = [
    ['home', 'Home', '/', (x) => x === '/' || x.startsWith('/events') || x.startsWith('/calendar') || x.startsWith('/notifications')],
    ['lib', 'Library', '/library', (x) => x.startsWith('/library')],
    ['chat', 'Hall', '/hall', (x) => x.startsWith('/hall') || x.startsWith('/rooms')],
    ['live', 'Live', '/live', (x) => x.startsWith('/live')],
    ['me', 'Profile', '/profile', (x) => x.startsWith('/profile') || x.startsWith('/members') || x.startsWith('/admin')],
  ];
  return (
    <nav className="tabbar">
      {tabs.map(([k, l, href, on]) => (
        <Link key={k} href={href} className={`tab ${on(p) ? 'on' : ''}`} data-tab={k}>
          <svg viewBox="0 0 24 24">{IC[k]}</svg>{l}
          {k === 'live' && liveNow ? <i className="livedot" /> : null}
        </Link>
      ))}
    </nav>
  );
}
export function Back({ href, onClick }: { href?: string; onClick?: () => void }) {
  if (href) return <Link href={href} className="iconbtn" aria-label="Back"><Icon k="back" s={19} /></Link>;
  return <button className="iconbtn" aria-label="Back" onClick={onClick ?? (() => history.length > 1 ? history.back() : (location.href = '/'))}><Icon k="back" s={19} /></button>;
}
export function Bell() {
  const { unread } = useMe();
  return (
    <Link href="/notifications" className="iconbtn" aria-label="Notifications" data-testid="bell">
      <svg viewBox="0 0 24 24"><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4" /></svg>
      {unread > 0 ? <span className="badge-n">{unread > 9 ? '9+' : unread}</span> : null}
    </Link>
  );
}
export function Thumb({ n, children, h }: { n?: number | null; children?: ReactNode; h?: number }) {
  return <div className={`thumb t${n || 1}`} style={h ? { height: h } : undefined}>{children}</div>;
}
export function Loading() {
  return <div style={{ padding: 30, display: 'flex', justifyContent: 'center' }}><span className="spinner" /></div>;
}
export function DemoPill({ show }: { show?: boolean }) { return show ? <span className="pill demo">demo</span> : null; }
