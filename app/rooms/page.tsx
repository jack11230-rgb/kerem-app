'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Back, Stack, TabBar, Loading, type PU } from '@/components/ui';
import { useStream } from '@/components/Providers';
import { api, rel } from '@/lib/client';

type R = { id: string; title: string; topic: string; status: string; memberCount: number; members: PU[]; joined: boolean; recent: number; activity: 'hot' | 'lively' | 'quiet' | 'archived'; quietMin: number; isNew: boolean; lastActivityAt: number; archivedAt: number | null };

export default function Rooms() {
  const [f, setF] = useState<'active' | 'archived' | 'mine'>('active');
  const [d, setD] = useState<{ rooms: R[]; counts: { active: number; archived: number } } | null>(null);
  const load = useCallback(() => api(`/api/rooms?filter=${f}`).then(setD), [f]);
  useEffect(() => { load(); }, [load]);
  useStream([], (_t, _d, ch) => { if (ch === 'rooms') load(); });
  useEffect(() => { const t = setInterval(load, 60_000); return () => clearInterval(t); }, [load]);
  return (
    <>
      <main className="page">
        <div className="top">
          <div className="row gap10"><Back href="/hall" /><div><div className="eyebrow">Members' Hall</div><div className="h1" style={{ marginTop: 4 }}>Side Rooms</div></div></div>
        </div>
        <div className="chips">
          <button className={`chip ${f === 'active' ? 'on' : ''}`} onClick={() => setF('active')}>Active · {d?.counts.active ?? 0}</button>
          <button className={`chip ${f === 'archived' ? 'on' : ''}`} onClick={() => setF('archived')}>Archived{d?.counts.archived ? ` · ${d.counts.archived}` : ''}</button>
          <button className={`chip ${f === 'mine' ? 'on' : ''}`} onClick={() => setF('mine')}>My rooms</button>
        </div>
        {!d ? <Loading /> : d.rooms.length === 0 ? <div className="empty">{f === 'active' ? 'No side rooms right now — the Hall is calm.' : f === 'archived' ? 'No archived rooms yet.' : 'You haven’t joined any side rooms.'}</div> : d.rooms.map((r) => (
          <Link key={r.id} href={`/rooms/${r.id}`} className="card" style={{ padding: '13px 14px', marginBottom: 10, display: 'block' }} data-testid="room-row">
            <div className="row between gap8">
              <div className="serif" style={{ fontSize: 16.5, fontWeight: 600 }}>{r.title}</div>
              {r.activity === 'hot' ? <span className="pill hot">🔥 Hot</span> : r.isNew && r.status === 'active' ? <span className="pill new">New</span> : null}
            </div>
            <div className="row between" style={{ marginTop: 9 }}>
              <div className="row gap8"><Stack users={r.members} /><span style={{ fontSize: 12, color: 'var(--muted)' }}>{r.memberCount} member{r.memberCount === 1 ? '' : 's'}{r.joined ? ' · joined' : ''}</span></div>
              <span style={{ fontSize: 11.5, color: r.activity === 'hot' || r.activity === 'lively' ? '#F2A65A' : 'var(--muted)' }}>
                {r.activity === 'archived' ? `Archived ${r.archivedAt ? rel(r.archivedAt) : ''}` : r.activity === 'quiet' ? `Quiet · ${rel(r.lastActivityAt).replace(' ago', '')}` : r.recent >= 3 ? `● ${r.recent} new` : '● Lively now'}
              </span>
            </div>
          </Link>
        ))}
        <div className="note mt14">✦ Rooms open automatically when a thread gets heated, and archive after 24h of quiet. A short recap is posted back to the Hall. Anyone can join any room.</div>
      </main>
      <TabBar />
    </>
  );
}
