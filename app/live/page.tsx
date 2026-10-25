'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Icon, TabBar, Loading } from '@/components/ui';
import { EvRow, type Ev } from '@/components/events';
import { useMe, useStream, useToast } from '@/components/Providers';
import { api, fmtTime, rel } from '@/lib/client';

export default function LiveIndex() {
  const { me } = useMe();
  const toast = useToast();
  const router = useRouter();
  const [up, setUp] = useState<Ev[] | null>(null);
  const [past, setPast] = useState<Ev[]>([]);
  const load = useCallback(async () => {
    const [a, b] = await Promise.all([api<{ events: Ev[] }>('/api/events?scope=upcoming'), api<{ events: Ev[] }>('/api/events?scope=past')]);
    setUp(a.events); setPast(b.events.filter((e) => e.summary).slice(0, 5));
  }, []);
  useEffect(() => { load(); }, [load]);
  useStream([], (_t, _d, ch) => { if (ch === 'events') load(); });
  const live = up?.find((e) => e.status === 'live');
  const start = async (id: string) => { try { await api(`/api/events/${id}/live`, { body: { action: 'start' } }); router.push(`/live/${id}`); } catch (e) { toast((e as Error).message, 'err'); } };
  return (
    <>
      <main className="page">
        <div className="top"><div><div className="eyebrow">Live Shiur</div><div className="h1" style={{ marginTop: 6 }}>Live</div></div></div>
        {!up ? <Loading /> : live ? (
          <Link href={`/live/${live.id}`} className="banner" data-testid="live-banner">
            <span className="pill live">● LIVE</span>
            <div style={{ flex: 1 }}><b style={{ fontSize: 14 }}>{live.title}</b><div className="muted" style={{ fontSize: 12 }}>{live.speaker} · {live.watching} watching</div></div>
            <span className="btn gold sm">Join</span>
          </Link>
        ) : <div className="empty" style={{ marginBottom: 16 }}>No shiur is live right now. You’ll get a notification when one starts.</div>}
        <div className="eyebrow mb10 mt16">Coming up</div>
        {up?.filter((e) => e.status === 'scheduled').slice(0, 5).map((e) => (
          <div key={e.id}>
            <EvRow ev={e} onChange={(p) => setUp((xs) => xs?.map((x) => (x.id === e.id ? { ...x, ...p } : x)) ?? xs)} />
            {me?.role === 'admin' ? <div style={{ margin: '-4px 0 12px', textAlign: 'right' }}><button className="btn ghost sm" onClick={() => start(e.id)} data-testid={`start-${e.id}`}><Icon k="live" s={14} /> Go live now</button></div> : null}
          </div>
        ))}
        {past.length ? <>
          <div className="eyebrow mb10 mt20">Recent discussion summaries</div>
          {past.map((e) => (
            <Link key={e.id} href={`/events/${e.id}/summary`} className="card" style={{ padding: '12px 14px', marginBottom: 10, display: 'block' }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{e.title}</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>{e.speaker} · {rel(e.startsAt)} · {fmtTime(e.startsAt)}</div>
              <div style={{ fontSize: 12, color: 'var(--gold2)', marginTop: 6 }}>✦ {e.summary?.stats?.comments ?? 0} comments · {e.summary?.stats?.questions ?? 0} questions →</div>
            </Link>
          ))}
        </> : null}
      </main>
      <TabBar />
    </>
  );
}
