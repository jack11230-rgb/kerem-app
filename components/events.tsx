'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Av, Icon, Stack, type PU } from './ui';
import { api, dayLabel, DOW, fmtTime, KIND_LABEL } from '@/lib/client';
import { useToast } from './Providers';

export type Ev = {
  id: string; title: string; speaker: string; series: string; kind: string; description: string; startsAt: number; endsAt: number | null;
  location: string; onlineUrl: string; streamUrl: string; status: 'scheduled' | 'live' | 'ended'; summary: any; libraryItemId: string | null;
  going: boolean; rsvpCount: number; attendees: PU[]; watching: number;
};
export function speakerInitials(s: string) {
  const w = s.replace(/^(Rabbi|Rav|R\.|Dr\.|Prof\.|Mrs?\.|Ms\.)\s+/i, '').split(/\s+/).filter((x) => /^[A-Za-z]/.test(x));
  return ((w[0]?.[0] ?? '') + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase();
}
export function useRsvp(ev: Ev, onChange: (patch: Partial<Ev>) => void) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    const prev = { going: ev.going, rsvpCount: ev.rsvpCount };
    onChange({ going: !ev.going, rsvpCount: ev.rsvpCount + (ev.going ? -1 : 1) });
    try {
      const { event: r } = await api<{ event: Ev }>(`/api/events/${ev.id}/rsvp`, { body: {} });
      onChange({ going: r.going, rsvpCount: r.rsvpCount, attendees: r.attendees });
      toast(r.going ? 'You’re going — we’ll remind you 15 min before' : 'RSVP cancelled');
    } catch (e) { onChange(prev); toast((e as Error).message, 'err'); }
    setBusy(false);
  };
  return { toggle, busy };
}
export function RsvpButton({ ev, onChange, size }: { ev: Ev; onChange: (p: Partial<Ev>) => void; size?: 'sm' }) {
  const { toggle, busy } = useRsvp(ev, onChange);
  if (ev.status === 'ended') return <span className="muted" style={{ fontSize: 12 }}>Ended</span>;
  return (
    <button data-testid={`rsvp-${ev.id}`} className={`btn ${ev.going ? 'going' : 'gold'} ${size ?? ''}`} onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(); }} disabled={busy} aria-pressed={ev.going}>
      {ev.going ? 'Going ✓' : 'RSVP'}
    </button>
  );
}
export function FeaturedCard({ ev, onChange }: { ev: Ev; onChange: (p: Partial<Ev>) => void }) {
  const live = ev.status === 'live';
  return (
    <Link href={live ? `/live/${ev.id}` : `/events/${ev.id}`} className="card feat" data-testid="featured">
      <div className="art">
        <i style={{ width: 220, height: 220, right: -60, top: -60 }} /><i style={{ width: 150, height: 150, right: -25, top: -25 }} /><i style={{ width: 80, height: 80, right: 10, top: 10, background: 'rgba(201,164,92,.15)' }} />
        <div style={{ position: 'absolute', left: 14, top: 14 }} className="eyebrow">{live ? <span className="livetxt">● Live now</span> : `${KIND_LABEL[ev.kind] ?? 'Event'} · ${dayLabel(ev.startsAt)}`}</div>
        <div style={{ position: 'absolute', left: 14, bottom: 12, right: 90, fontFamily: "'Playfair Display'", fontSize: 20, lineHeight: 1.2, fontWeight: 600 }}>{ev.title}</div>
      </div>
      <div style={{ padding: '12px 14px 14px' }}>
        <div className="row gap8" style={{ fontSize: 13 }}><Av u={{ initials: speakerInitials(ev.speaker), color: 1 }} /><div><b style={{ fontWeight: 600 }}>{ev.speaker}</b>{ev.series ? <div className="muted" style={{ fontSize: 11.5 }}>{ev.series}</div> : null}</div></div>
        <div className="row" style={{ gap: 14, fontSize: 12, color: '#C5CBD8', margin: '10px 0 12px', flexWrap: 'wrap' }}>
          <span className="row gap4"><Icon k="clock" s={14} c="#C9A45C" /> {fmtTime(ev.startsAt)}</span>
          {ev.location ? <span className="row gap4"><Icon k="pin" s={14} c="#C9A45C" /> {ev.location}</span> : null}
        </div>
        <div className="row between">
          <div className="row gap8"><Stack users={ev.attendees} /><span style={{ fontSize: 12, color: ev.going ? 'var(--gold2)' : undefined, fontWeight: ev.going ? 600 : 400 }} data-testid="going-count">{ev.rsvpCount} going</span></div>
          {live ? <span className="btn gold">Join live</span> : <RsvpButton ev={ev} onChange={onChange} />}
        </div>
      </div>
    </Link>
  );
}
export function EvRow({ ev, onChange, showRsvp = true }: { ev: Ev; onChange?: (p: Partial<Ev>) => void; showRsvp?: boolean }) {
  const d = new Date(ev.startsAt);
  const live = ev.status === 'live';
  return (
    <Link href={live ? `/live/${ev.id}` : ev.status === 'ended' && ev.summary ? `/events/${ev.id}/summary` : `/events/${ev.id}`} className="card ev" data-testid="ev-row">
      <div className="datebox"><b>{d.getDate()}</b><span>{DOW[d.getDay()].toUpperCase()}</span></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.3 }}>{ev.title}</div>
        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
          {ev.speaker} · {fmtTime(ev.startsAt)} · {live ? <span className="livetxt">● Live now</span> : ev.status === 'ended' ? 'Ended' : ev.streamUrl || ev.onlineUrl ? <>{ev.location ? `${ev.location} · ` : ''}<span style={{ color: '#F08A8D' }}>● Live online</span></> : ev.location}
        </div>
        {ev.rsvpCount ? <div className="row gap6 mt6" style={{ fontSize: 11.5 }}><Stack users={ev.attendees} max={3} /><span className="muted">{ev.rsvpCount} going</span></div> : null}
      </div>
      {showRsvp && onChange && ev.status !== 'ended' && !live ? <RsvpButton ev={ev} onChange={onChange} size="sm" /> : null}
    </Link>
  );
}
