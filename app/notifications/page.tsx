'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Back, Icon, TabBar, Loading } from '@/components/ui';
import { useMe, useStream } from '@/components/Providers';
import { api, rel } from '@/lib/client';
type N = { id: string; kind: string; title: string; body: string; link: string; readAt: number | null; createdAt: number };
const ICON: Record<string, string> = { reminder: 'clock', live: 'live', summary: 'spark', room: 'rooms', recap: 'archive', application: 'users', rsvp: 'check', welcome: 'shield' };
export default function Notifs() {
  const { setUnread } = useMe();
  const [ns, setNs] = useState<N[] | null>(null);
  const load = useCallback(() => api<{ notifications: N[] }>('/api/notifications').then((d) => setNs(d.notifications)), []);
  useEffect(() => { load(); }, [load]);
  useStream([], (t) => { if (t === 'notification') load(); });
  const markAll = async () => { await api('/api/notifications/read', { body: {} }); setUnread(0); setNs((xs) => xs?.map((n) => ({ ...n, readAt: n.readAt ?? Date.now() })) ?? xs); };
  const open = (n: N) => { if (!n.readAt) { api('/api/notifications/read', { body: { ids: [n.id] } }); setNs((xs) => xs?.map((x) => (x.id === n.id ? { ...x, readAt: Date.now() } : x)) ?? xs); } };
  const unread = ns?.filter((n) => !n.readAt).length ?? 0;
  useEffect(() => { if (ns) setUnread(unread); }, [ns, unread, setUnread]);
  return (
    <>
      <main className="page">
        <div className="top"><div className="row gap10"><Back /><div className="h1">Notifications</div></div>{unread ? <button className="btn ghost sm" onClick={markAll} data-testid="mark-all">Mark all read</button> : null}</div>
        {!ns ? <Loading /> : ns.length === 0 ? <div className="empty">You’re all caught up.</div> : ns.map((n) => (
          <Link key={n.id} href={n.link || '#'} onClick={() => open(n)} className="card row gap10" style={{ padding: '12px 14px', marginBottom: 9, alignItems: 'flex-start', borderColor: n.readAt ? undefined : 'rgba(227,200,138,.45)' }} data-testid="notification">
            <span className="iconbtn" style={{ width: 34, height: 34, flex: 'none', color: 'var(--gold2)' }}><Icon k={ICON[n.kind] ?? 'bell'} s={16} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: n.readAt ? 500 : 700 }}>{n.title}</div>
              {n.body ? <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{n.body}</div> : null}
              <div style={{ fontSize: 10.5, color: '#6E7891', marginTop: 4 }}>{rel(n.createdAt)}</div>
            </div>
            {!n.readAt ? <i style={{ width: 8, height: 8, borderRadius: 4, background: 'var(--gold)', marginTop: 6 }} /> : null}
          </Link>
        ))}
      </main>
      <TabBar />
    </>
  );
}
