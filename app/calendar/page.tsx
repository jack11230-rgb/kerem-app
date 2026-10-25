'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Back, Icon, TabBar } from '@/components/ui';
import { RsvpButton, type Ev } from '@/components/events';
import { useStream, useToast } from '@/components/Providers';
import { api, DOW, fmtLong, fmtTime } from '@/lib/client';

export default function Calendar() {
  const toast = useToast();
  const [cur, setCur] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [sel, setSel] = useState(() => new Date().toDateString());
  const [evs, setEvs] = useState<Ev[]>([]);
  const [added, setAdded] = useState<Record<string, boolean>>({});
  const from = cur.getTime(), to = new Date(cur.getFullYear(), cur.getMonth() + 1, 1).getTime();
  const load = useCallback(async () => { const r = await api<{ events: Ev[] }>(`/api/events?scope=month&from=${from}&to=${to}`); setEvs(r.events); }, [from, to]);
  useEffect(() => { load(); }, [load]);
  useStream([], (t, _d, ch) => { if (ch === 'events') load(); });
  const days = useMemo(() => {
    const first = cur.getDay(), n = new Date(cur.getFullYear(), cur.getMonth() + 1, 0).getDate();
    const cells: { d: Date; dim: boolean }[] = [];
    for (let i = first; i > 0; i--) cells.push({ d: new Date(cur.getFullYear(), cur.getMonth(), 1 - i), dim: true });
    for (let i = 1; i <= n; i++) cells.push({ d: new Date(cur.getFullYear(), cur.getMonth(), i), dim: false });
    while (cells.length % 7) cells.push({ d: new Date(cur.getFullYear(), cur.getMonth() + 1, cells.length - first - n + 1), dim: true });
    return cells;
  }, [cur]);
  const has = new Set(evs.map((e) => new Date(e.startsAt).toDateString()));
  const dayEvs = evs.filter((e) => new Date(e.startsAt).toDateString() === sel);
  const later = evs.filter((e) => e.startsAt > new Date(sel).getTime() + 86400_000 - 1).slice(0, 4);
  const patch = (id: string) => (p: Partial<Ev>) => setEvs((xs) => xs.map((e) => (e.id === id ? { ...e, ...p } : e)));
  const today = new Date().toDateString();
  return (
    <>
      <main className="page">
        <div className="top"><Back href="/" /><div className="h1" style={{ fontSize: 22 }}>Calendar</div><Link className="iconbtn" href="/library" aria-label="Search library"><Icon k="search" s={19} /></Link></div>
        <div className="card" style={{ padding: '14px 12px 10px' }}>
          <div className="row between" style={{ padding: '0 6px 10px' }}>
            <div className="serif" style={{ fontSize: 19, fontWeight: 600 }}>{cur.toLocaleDateString([], { month: 'long', year: 'numeric' })}</div>
            <div className="row gap6">
              <button className="iconbtn" style={{ width: 32, height: 32 }} aria-label="Previous month" onClick={() => setCur(new Date(cur.getFullYear(), cur.getMonth() - 1, 1))}>‹</button>
              <button className="iconbtn" style={{ width: 32, height: 32 }} aria-label="Next month" onClick={() => setCur(new Date(cur.getFullYear(), cur.getMonth() + 1, 1))}>›</button>
            </div>
          </div>
          <div className="cal">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <div key={i} className="dw">{d}</div>)}
            {days.map(({ d, dim }) => {
              const k = d.toDateString();
              return <button key={k + dim} className={`d ${dim ? 'dim' : ''} ${has.has(k) ? 'ev' : ''} ${k === sel ? 'sel' : ''} ${k === today ? 'today' : ''}`} onClick={() => { setSel(k); if (dim) setCur(new Date(d.getFullYear(), d.getMonth(), 1)); }}>{d.getDate()}</button>;
            })}
          </div>
        </div>
        <div className="eyebrow" style={{ margin: '18px 0 10px' }}>{fmtLong(new Date(sel).getTime())}</div>
        {dayEvs.length ? dayEvs.map((e) => (
          <div key={e.id} className="card" style={{ padding: 14, marginBottom: 10 }}>
            <Link href={`/events/${e.id}`} style={{ fontSize: 15, fontWeight: 600, display: 'block' }}>{e.title}</Link>
            <div className="muted" style={{ fontSize: 12.3, margin: '4px 0 12px' }}>{e.speaker} · {fmtTime(e.startsAt)}–{fmtTime(e.endsAt ?? e.startsAt + 75 * 60_000)}{e.location ? ` · ${e.location}` : ''}</div>
            <div className="row gap8">
              {added[e.id]
                ? <div className="btn" style={{ flex: 1, height: 40, background: '#1F3E35', color: '#A9E2C4', fontSize: 12.5 }}>✓ Added · reminder 15 min before</div>
                : <a className="btn ghost" style={{ flex: 1, height: 40 }} href={`/api/events/${e.id}/ics`} download data-testid="ics" onClick={() => { setAdded({ ...added, [e.id]: true }); toast('Calendar file downloaded'); }}><Icon k="cal" s={16} /> Add to my calendar</a>}
              {e.status !== 'ended' ? <RsvpButton ev={e} onChange={patch(e.id)} /> : null}
            </div>
          </div>
        )) : <div className="empty">Nothing scheduled this day.</div>}
        {later.length ? <div className="eyebrow mt20 mb10">Later this month</div> : null}
        {later.map((e) => { const d = new Date(e.startsAt); return (
          <Link key={e.id} href={`/events/${e.id}`} className="card" style={{ padding: '12px 14px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="datebox" style={{ width: 44, height: 48 }}><b style={{ fontSize: 18 }}>{d.getDate()}</b><span>{DOW[d.getDay()].toUpperCase()}</span></div>
            <div style={{ fontSize: 13 }}><b style={{ fontWeight: 600 }}>{e.title}</b><div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{e.speaker} · {fmtTime(e.startsAt)} · {e.streamUrl || e.onlineUrl ? 'Online' : e.location}</div></div>
          </Link>); })}
      </main>
      <TabBar />
    </>
  );
}
