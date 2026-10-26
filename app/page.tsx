'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Bell, Icon, TabBar, Loading, Logo } from '@/components/ui';
import { EvRow, FeaturedCard, type Ev } from '@/components/events';
import { useMe, useStream } from '@/components/Providers';
import { api, greeting, fmtTime, rel } from '@/lib/client';

const FILTERS = [['all', 'Upcoming'], ['shiur', 'Shiurim'], ['lecture', 'Lectures'], ['philosophy', 'Philosophy'], ['online', 'Online']] as const;

export default function Home() {
  const { me, ai } = useMe();
  const [evs, setEvs] = useState<Ev[] | null>(null);
  const [f, setF] = useState<string>('all');
  const load = useCallback(async () => { const r = await api<{ events: Ev[] }>('/api/events?scope=upcoming'); setEvs(r.events); }, []);
  useEffect(() => { load(); }, [load]);
  useStream([], (type, data, ch) => {
    if (ch === 'events' && type === 'update') load();
    if (ch === 'events' && type === 'rsvp') setEvs((xs) => xs?.map((e) => e.id === data.eventId ? { ...e, rsvpCount: data.rsvpCount, attendees: data.attendees, going: data.by === me?.id ? data.going : e.going } : e) ?? xs);
  });
  const patch = (id: string) => (p: Partial<Ev>) => setEvs((xs) => xs?.map((e) => (e.id === id ? { ...e, ...p } : e)) ?? xs);
  const list = (evs ?? []).filter((e) => f === 'all' || (f === 'online' ? !!(e.streamUrl || e.onlineUrl) : e.kind === f));
  const live = (evs ?? []).find((e) => e.status === 'live');
  const soon = (evs ?? []).find((e) => e.status === 'scheduled' && e.startsAt > Date.now() && e.startsAt - Date.now() < 60 * 60_000);
  const featured = live ?? list[0];
  const rest = list.filter((e) => e.id !== featured?.id);
  const today = new Date();
  return (
    <>
      <main className="page">
        <div className="top">
          <div className="row gap12" style={{ minWidth: 0 }}>
          <Logo s={46} />
          <div style={{ minWidth: 0 }}>
            <div className="eyebrow">{today.toLocaleDateString([], { weekday: 'long' })} · {today.toLocaleDateString([], { month: 'short', day: 'numeric' })}</div>
            <div className="h1" style={{ marginTop: 6 }}>{greeting()}, {me?.name.split(' ')[0] ?? ''}</div>
          </div>
          </div>
          <div className="row gap8"><Link href="/calendar" className="iconbtn" aria-label="Calendar"><Icon k="cal" s={19} /></Link><Bell /></div>
        </div>
        {soon && !live ? (
          <Link href={`/events/${soon.id}`} className="banner soon"><Icon k="clock" s={20} c="#E3C88A" /><div style={{ fontSize: 13 }}><b>{soon.title}</b><div className="muted" style={{ fontSize: 12 }}>Starts {rel(soon.startsAt)} · {fmtTime(soon.startsAt)}</div></div></Link>
        ) : null}
        <div className="chips">{FILTERS.map(([k, l]) => <button key={k} className={`chip ${f === k ? 'on' : ''}`} onClick={() => setF(k)}>{l}</button>)}</div>
        {!evs ? <Loading /> : !featured ? <div className="empty">No upcoming events in this category yet.</div> : (
          <>
            <FeaturedCard ev={featured} onChange={patch(featured.id)} />
            {rest.map((e) => <EvRow key={e.id} ev={e} onChange={patch(e.id)} />)}
          </>
        )}
        <div className="row between mt16" style={{ fontSize: 12.5 }}>
          <Link href="/calendar" style={{ color: 'var(--gold2)' }}>Full calendar →</Link>
          <Link href="/library" style={{ color: 'var(--gold2)' }}>Past recordings →</Link>
        </div>
        {ai && !ai.configured ? <div className="note mt16">AI features are running in offline mode (no AI key configured): heat detection uses heuristics, summaries are extractive, and fact-checks are disabled.</div> : null}
      </main>
      <TabBar />
    </>
  );
}
