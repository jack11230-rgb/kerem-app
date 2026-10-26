'use client';
import Link from 'next/link';
import { use, useCallback, useEffect, useState } from 'react';
import { Av, Back, Icon, Stack, TabBar, Loading, type PU } from '@/components/ui';
import { RsvpButton, speakerInitials, type Ev } from '@/components/events';
import { useMe, useStream, useToast } from '@/components/Providers';
import { api, fmtLong, fmtTime, KIND_LABEL } from '@/lib/client';

export default function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { me } = useMe();
  const toast = useToast();
  const [ev, setEv] = useState<Ev | null>(null);
  const [going, setGoing] = useState<PU[]>([]);
  const [err, setErr] = useState('');
  const [added, setAdded] = useState(false);
  const load = useCallback(async () => {
    try { const r = await api<{ event: Ev; going: PU[] }>(`/api/events/${id}`); setEv(r.event); setGoing(r.going); } catch (e) { setErr((e as Error).message); }
  }, [id]);
  useEffect(() => { load(); }, [load]);
  useStream([`event:${id}`], (t, d, ch) => { if ((ch === 'events' && d?.eventId === id) || ch === `event:${id}`) load(); });
  const admin = me?.role === 'admin';
  const start = async () => { await api(`/api/events/${id}/live`, { body: { action: 'start' } }); location.href = `/live/${id}`; };
  if (err) return <main className="page"><Back /><div className="empty mt16">{err}</div></main>;
  if (!ev) return <main className="page"><Loading /></main>;
  const end = ev.endsAt ?? ev.startsAt + 75 * 60_000;
  return (
    <>
      <main className="page">
        <div className="top"><Back /><div className="eyebrow">{KIND_LABEL[ev.kind]}</div><div style={{ width: 38 }} /></div>
        <div className="card feat" style={{ marginBottom: 16 }}>
          <div className="art" style={{ height: 150 }}>
            <i style={{ width: 240, height: 240, right: -70, top: -70 }} /><i style={{ width: 160, height: 160, right: -30, top: -30 }} />
            <div style={{ position: 'absolute', left: 16, top: 14 }} className="eyebrow">{ev.status === 'live' ? <span className="livetxt">● Live now</span> : ev.status === 'ended' ? 'Ended' : fmtLong(ev.startsAt)}</div>
            <div className="serif" style={{ position: 'absolute', left: 16, bottom: 14, right: 16, fontSize: 23, lineHeight: 1.2, fontWeight: 600 }}>{ev.title}</div>
          </div>
          <div style={{ padding: 16 }}>
            <div className="row gap10"><Av u={{ initials: speakerInitials(ev.speaker), color: 1 }} size={36} /><div><b>{ev.speaker}</b>{ev.series ? <div className="muted" style={{ fontSize: 12 }}>{ev.series}</div> : null}</div></div>
            <div style={{ fontSize: 13, color: '#C5CBD8', marginTop: 12, display: 'grid', gap: 6 }}>
              <span className="row gap6"><Icon k="clock" s={15} c="#C9A45C" /> {fmtLong(ev.startsAt)} · {fmtTime(ev.startsAt)}–{fmtTime(end)}</span>
              {ev.location ? <span className="row gap6"><Icon k="pin" s={15} c="#C9A45C" /> {ev.location}</span> : null}
              {ev.streamUrl || ev.onlineUrl ? <span className="row gap6"><Icon k="live" s={15} c="#C9A45C" /> Streamed live in the app</span> : null}
            </div>
            {ev.description ? <p style={{ fontSize: 14, lineHeight: 1.55, color: '#D9D3C5', marginTop: 14 }}>{ev.description}</p> : null}
            <div className="row between mt16">
              <div className="row gap8"><Stack users={ev.attendees} /><span style={{ fontSize: 12.5 }} data-testid="going-count">{ev.rsvpCount} going</span></div>
              {ev.status === 'live' ? <Link href={`/live/${ev.id}`} className="btn gold">Join live</Link> : <RsvpButton ev={ev} onChange={(p) => setEv({ ...ev, ...p })} />}
            </div>
          </div>
        </div>
        {ev.status !== 'ended' ? (
          added
            ? <div className="btn block" style={{ height: 44, background: '#1F3E35', color: '#A9E2C4' }}>✓ Added · reminder 15 min before</div>
            : <a className="btn ghost block" style={{ height: 44 }} href={`/api/events/${ev.id}/ics`} download onClick={() => { setAdded(true); toast('Calendar file downloaded'); }}><Icon k="cal" s={16} /> Add to my calendar (.ics)</a>
        ) : null}
        {ev.status === 'ended' && ev.summary ? <Link href={`/events/${ev.id}/summary`} className="btn gold block lg mt10">✦ View discussion summary</Link> : null}
        {ev.status === 'ended' && ev.libraryItemId ? <Link href={`/library/${ev.libraryItemId}`} className="btn ghost block mt10" style={{ height: 44 }}>Open in Library</Link> : null}
        {admin && ev.status === 'scheduled' ? <button className="btn gold block mt10" style={{ height: 44 }} onClick={start} data-testid="start-live">Start live shiur now</button> : null}
        {admin ? <Link href={`/admin?tab=events&edit=${ev.id}`} className="btn ghost block mt10" style={{ height: 40 }} data-testid="edit-event"><Icon k="edit" s={15} /> Edit event</Link> : null}
        {going.length ? (
          <>
            <div className="eyebrow mt20 mb10">Who’s going · {going.length}</div>
            <div className="card" style={{ padding: '4px 14px' }}>
              {going.map((u) => <Link key={u.id} href={`/members/${u.id}`} className="list-row"><Av u={u} /><span style={{ fontSize: 14 }}>{u.name}</span></Link>)}
            </div>
          </>
        ) : null}
      </main>
      <TabBar />
    </>
  );
}
