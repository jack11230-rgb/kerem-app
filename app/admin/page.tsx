'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { Av, Back, Bell, Icon, TabBar, Loading, DemoPill } from '@/components/ui';
import { useMe, useToast } from '@/components/Providers';
import { api, fmtDay, fmtTime, rel, KIND_LABEL } from '@/lib/client';

type App = { id: string; name: string; email: string; sponsor: string; reason: string; status: string; inviteCode: string | null; createdAt: number };
type Inv = { code: string; note: string; email: string | null; maxUses: number; uses: number; role: string; expiresAt: number | null; createdAt: number };
type Mem = { id: string; name: string; email: string; initials: string; color: number; role: string; isDemo: number; createdAt: number };
type EvR = { id: string; title: string; speaker: string; series: string; kind: string; description: string; startsAt: number; endsAt: number | null; location: string; onlineUrl: string; streamUrl: string; status: string };
type LibR = { id: string; title: string; speaker: string; category: string; mediaType: string; mediaUrl: string; recordedAt: number };
type O = { applications: App[]; invites: Inv[]; members: Mem[]; events: EvR[]; library: LibR[]; stats: { members: number; pending: number; avgAttendance: number } };
type Tab = 'applications' | 'members' | 'events' | 'invites' | 'library';

const toLocal = (t?: number | null) => { if (!t) return ''; const d = new Date(t); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const fromLocal = (s: string) => (s ? new Date(s).getTime() : undefined);

function AdminInner() {
  const { me, loaded } = useMe();
  const toast = useToast();
  const sp = useSearchParams();
  const router = useRouter();
  const [o, setO] = useState<O | null>(null);
  const [tab, setTab] = useState<Tab>((sp.get('tab') as Tab) || 'applications');
  const [sheet, setSheet] = useState<null | { kind: 'event' | 'library' | 'invite'; data?: any }>(null);
  const [approved, setApproved] = useState<Record<string, string>>({});
  const load = useCallback(() => api<O>('/api/admin/overview').then(setO), []);
  useEffect(() => { if (me?.role === 'admin') load(); }, [me, load]);
  useEffect(() => {
    const e = sp.get('edit');
    if (o && e) {
      const ev = o.events.find((x) => x.id === e); if (ev) setSheet({ kind: 'event', data: ev });
      const li = o.library.find((x) => x.id === e); if (li) api(`/api/library/${e}`).then((d) => setSheet({ kind: 'library', data: d.item }));
      router.replace(`/admin?tab=${tab}`);
    }
  }, [o, sp, router, tab]);
  if (loaded && me?.role !== 'admin') return <main className="page"><Back /><div className="empty mt16">Admins only.</div></main>;
  if (!o) return <main className="page"><Loading /></main>;

  const decide = async (a: App, action: 'approve' | 'decline') => {
    try { const r = await api<{ code?: string }>(`/api/admin/applications/${a.id}`, { body: { action } }); if (r.code) setApproved((x) => ({ ...x, [a.id]: r.code! })); else toast('Application declined'); await load(); } catch (e) { toast((e as Error).message, 'err'); }
  };
  const setRole = async (m: Mem, role: string) => { try { await api(`/api/admin/members/${m.id}`, { method: 'PATCH', body: { role } }); await load(); toast(`${m.name} is now ${role}`); } catch (e) { toast((e as Error).message, 'err'); } };
  const revoke = async (c: string) => { if (!confirm(`Revoke invite ${c}?`)) return; await api(`/api/admin/invites/${c}`, { method: 'DELETE' }); load(); };
  const del = async (kind: 'events' | 'library', id: string) => { if (!confirm('Delete permanently?')) return; await api(`/api/${kind}/${id}`, { method: 'DELETE' }); load(); };
  const copy = (s: string) => { navigator.clipboard?.writeText(s).then(() => toast('Copied'), () => toast(s)); };
  const pending = o.applications.filter((a) => a.status === 'pending');
  const done = o.applications.filter((a) => a.status !== 'pending');
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <main className="page">
      <div className="top"><div className="row gap10"><Back href="/profile" /><div><div className="eyebrow">Admin</div><div className="h1" style={{ marginTop: 6 }}>Membership</div></div></div><Bell /></div>
      <div className="card row" style={{ marginBottom: 14 }}>
        <div className="stat"><b>{o.stats.members}</b><span>members</span></div>
        <div className="stat" style={{ borderLeft: '1px solid var(--line)', borderRight: '1px solid var(--line)' }}><b>{o.stats.pending}</b><span>applications</span></div>
        <div className="stat"><b>{o.stats.avgAttendance}%</b><span>avg. attendance</span></div>
      </div>
      <div className="chips">
        {(['applications', 'members', 'events', 'invites', 'library'] as Tab[]).map((t) => <button key={t} className={`chip ${tab === t ? 'on' : ''}`} onClick={() => setTab(t)} data-testid={`admin-tab-${t}`}>{t[0].toUpperCase() + t.slice(1)}</button>)}
      </div>

      {tab === 'applications' ? <>
        {pending.length === 0 ? <div className="empty mb14">No pending applications. Share <b>{origin}/apply</b> with prospective members.</div> : null}
        {[...pending, ...done.filter((a) => approved[a.id])].map((a) => (
          <div key={a.id} className="card app-card">
            <div className="row gap10"><Av u={{ name: a.name, initials: a.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase(), color: (a.name.length % 6) + 1 }} size={40} />
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 15, fontWeight: 600 }}>{a.name}</div><div className="muted" style={{ fontSize: 11.5 }}>{a.sponsor ? `Sponsored by ${a.sponsor} · ` : ''}{a.email}</div></div>
              <span style={{ fontSize: 10.5, color: 'var(--gold2)', border: '1px solid var(--line)', padding: '3px 8px', borderRadius: 999 }}>{a.status === 'pending' ? 'Pending' : 'Approved'}</span></div>
            {a.reason ? <div style={{ fontSize: 12.8, lineHeight: 1.45, color: '#D0D4DE', margin: '10px 0 12px', fontStyle: 'italic' }}>“{a.reason}”</div> : <div className="mt10" />}
            {approved[a.id] ? <div className="approved" data-testid="approved">✓ Approved · invitation code <span className="code">{approved[a.id]}</span><div style={{ fontSize: 11.5, fontWeight: 500, marginTop: 4 }}>Send them: {origin}/join?code={approved[a.id]} <button className="btn ghost sm" style={{ height: 24, marginLeft: 6 }} onClick={() => copy(`${origin}/join?code=${approved[a.id]}`)}>Copy link</button></div></div>
              : <div className="row gap8"><button className="btn gold" style={{ flex: 1, height: 36 }} onClick={() => decide(a, 'approve')} data-testid="approve">Approve</button><button className="btn ghost" style={{ flex: 1, height: 36 }} onClick={() => decide(a, 'decline')}>Decline</button></div>}
          </div>
        ))}
        {done.filter((a) => !approved[a.id]).length ? <><div className="eyebrow mt16 mb10">History</div><div className="card" style={{ padding: '2px 14px' }}>{done.filter((a) => !approved[a.id]).map((a) => <div key={a.id} className="list-row"><div style={{ flex: 1 }}><div style={{ fontSize: 13.5 }}>{a.name}</div><div className="muted" style={{ fontSize: 11 }}>{a.email} · {rel(a.createdAt)}</div></div><span className="muted" style={{ fontSize: 11.5 }}>{a.status}{a.inviteCode ? ` · ${a.inviteCode}` : ''}</span></div>)}</div></> : null}
      </> : null}

      {tab === 'members' ? <div className="card" style={{ padding: '2px 14px' }}>{o.members.map((m) => (
        <div key={m.id} className="list-row">
          <Link href={`/members/${m.id}`}><Av u={m} size={36} /></Link>
          <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 14, fontWeight: 600 }}>{m.name} <DemoPill show={!!m.isDemo} /></div><div className="muted" style={{ fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.email} · joined {fmtDay(m.createdAt)}</div></div>
          {m.id === me?.id ? <span className="muted" style={{ fontSize: 11 }}>you · admin</span> : <select className="field" style={{ width: 100, height: 34, fontSize: 12.5, padding: '0 10px' }} value={m.role} onChange={(e) => setRole(m, e.target.value)}><option value="member">member</option><option value="admin">admin</option></select>}
        </div>
      ))}</div> : null}

      {tab === 'events' ? <>
        <button className="btn gold block mb14" onClick={() => setSheet({ kind: 'event' })} data-testid="new-event"><Icon k="plus" s={16} /> New event</button>
        <div className="card" style={{ padding: '2px 14px' }}>{o.events.map((e) => (
          <div key={e.id} className="list-row">
            <div style={{ flex: 1, minWidth: 0 }}><Link href={`/events/${e.id}`} style={{ fontSize: 14, fontWeight: 600 }}>{e.title}</Link><div className="muted" style={{ fontSize: 11 }}>{KIND_LABEL[e.kind]} · {fmtDay(e.startsAt)} {fmtTime(e.startsAt)} · {e.status}</div></div>
            <button className="iconbtn" aria-label="Edit" onClick={() => setSheet({ kind: 'event', data: e })}><Icon k="edit" s={16} /></button>
            <button className="iconbtn" aria-label="Delete" onClick={() => del('events', e.id)}><Icon k="x" s={16} /></button>
          </div>
        ))}</div>
      </> : null}

      {tab === 'invites' ? <>
        <button className="btn gold block mb14" onClick={() => setSheet({ kind: 'invite' })} data-testid="new-invite"><Icon k="plus" s={16} /> Create invite code</button>
        <div className="card" style={{ padding: '2px 14px' }}>{o.invites.map((i) => {
          const expired = i.expiresAt && i.expiresAt < Date.now(); const used = i.uses >= i.maxUses;
          return (
            <div key={i.code} className="list-row" data-testid="invite-row">
              <div style={{ flex: 1, minWidth: 0 }}><div className="code" style={{ fontSize: 15 }}>{i.code}</div><div className="muted" style={{ fontSize: 11 }}>{i.uses}/{i.maxUses} used{i.role === 'admin' ? ' · admin' : ''}{i.email ? ` · ${i.email}` : ''}{i.note ? ` · ${i.note}` : ''}{i.expiresAt ? ` · ${expired ? 'expired' : `expires ${fmtDay(i.expiresAt)}`}` : ''}</div></div>
              {!used && !expired ? <button className="btn ghost sm" onClick={() => copy(`${origin}/join?code=${i.code}`)}>Copy link</button> : <span className="muted" style={{ fontSize: 11 }}>{used ? 'used' : 'expired'}</span>}
              <button className="iconbtn" aria-label="Revoke" onClick={() => revoke(i.code)}><Icon k="x" s={16} /></button>
            </div>
          );
        })}</div>
      </> : null}

      {tab === 'library' ? <>
        <button className="btn gold block mb14" onClick={() => setSheet({ kind: 'library' })} data-testid="new-library"><Icon k="plus" s={16} /> Add library item</button>
        <div className="card" style={{ padding: '2px 14px' }}>{o.library.map((l) => (
          <div key={l.id} className="list-row">
            <div style={{ flex: 1, minWidth: 0 }}><Link href={`/library/${l.id}`} style={{ fontSize: 14, fontWeight: 600 }}>{l.title}</Link><div className="muted" style={{ fontSize: 11 }}>{KIND_LABEL[l.category]} · {l.speaker} · {l.mediaUrl ? l.mediaType : 'no media'}</div></div>
            <button className="iconbtn" aria-label="Edit" onClick={() => api(`/api/library/${l.id}`).then((d) => setSheet({ kind: 'library', data: d.item }))}><Icon k="edit" s={16} /></button>
            <button className="iconbtn" aria-label="Delete" onClick={() => del('library', l.id)}><Icon k="x" s={16} /></button>
          </div>
        ))}</div>
      </> : null}

      {sheet ? <Sheet onClose={() => setSheet(null)}>
        {sheet.kind === 'event' ? <EventForm ev={sheet.data} done={() => { setSheet(null); load(); toast('Event saved'); }} />
          : sheet.kind === 'library' ? <LibForm item={sheet.data} done={() => { setSheet(null); load(); toast('Library item saved'); }} />
          : <InviteForm done={(c) => { setSheet(null); load(); toast(`Invite ${c} created`); }} />}
      </Sheet> : null}
    </main>
  );
}

function Sheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return <div className="sheet" onClick={onClose}><div className="inner" onClick={(e) => e.stopPropagation()}><div className="row between mb10"><span /><button className="iconbtn" onClick={onClose} aria-label="Close"><Icon k="x" s={17} /></button></div>{children}</div></div>;
}
function useForm<T extends Record<string, any>>(init: T) { const [f, setF] = useState<T>(init); return { f, set: (k: keyof T) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value })), setF }; }

function EventForm({ ev, done }: { ev?: EvR; done: () => void }) {
  const { f, set } = useForm({ title: ev?.title ?? '', speaker: ev?.speaker ?? '', series: ev?.series ?? '', kind: ev?.kind ?? 'shiur', description: ev?.description ?? '', startsAt: toLocal(ev?.startsAt), endsAt: toLocal(ev?.endsAt), location: ev?.location ?? '', onlineUrl: ev?.onlineUrl ?? '', streamUrl: ev?.streamUrl ?? '' });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setBusy(true);
    const b = { ...f, startsAt: fromLocal(f.startsAt), endsAt: fromLocal(f.endsAt) ?? '' };
    try { if (ev) await api(`/api/events/${ev.id}`, { method: 'PATCH', body: b }); else await api('/api/events', { body: b }); done(); } catch (x) { setErr((x as Error).message); }
    setBusy(false);
  };
  return (
    <form onSubmit={submit} data-testid="event-form">
      <div className="h2">{ev ? 'Edit event' : 'New event'}</div>
      <label className="lbl">Title</label><input className="field" value={f.title} onChange={set('title')} required name="title" />
      <label className="lbl">Speaker</label><input className="field" value={f.speaker} onChange={set('speaker')} required name="speaker" />
      <div className="row gap8"><div style={{ flex: 1 }}><label className="lbl">Type</label><select className="field" value={f.kind} onChange={set('kind')}><option value="shiur">Shiur</option><option value="lecture">Lecture</option><option value="philosophy">Philosophy</option></select></div>
        <div style={{ flex: 1 }}><label className="lbl">Series</label><input className="field" value={f.series} onChange={set('series')} /></div></div>
      <label className="lbl">Starts</label><input className="field" type="datetime-local" value={f.startsAt} onChange={set('startsAt')} required name="startsAt" />
      <label className="lbl">Ends (optional)</label><input className="field" type="datetime-local" value={f.endsAt} onChange={set('endsAt')} />
      <label className="lbl">Location</label><input className="field" value={f.location} onChange={set('location')} placeholder="Main Hall · 14 Elm St" />
      <label className="lbl">Live stream URL (YouTube / Vimeo / mp4)</label><input className="field" value={f.streamUrl} onChange={set('streamUrl')} placeholder="https://www.youtube.com/live/…" />
      <label className="lbl">Online join link (Zoom etc.)</label><input className="field" value={f.onlineUrl} onChange={set('onlineUrl')} />
      <label className="lbl">Description</label><textarea className="field" value={f.description} onChange={set('description')} />
      {err ? <div className="err">{err}</div> : null}
      <button className="btn gold block lg mt14" disabled={busy}>{busy ? 'Saving…' : 'Save event'}</button>
    </form>
  );
}

function LibForm({ item, done }: { item?: any; done: () => void }) {
  const { f, set, setF } = useForm({ title: item?.title ?? '', speaker: item?.speaker ?? '', category: item?.category ?? 'shiur', mediaType: item?.mediaType ?? 'video', mediaUrl: item?.mediaUrl ?? '', duration: item?.duration ?? '', recordedAt: item?.recordedAt ? toLocal(item.recordedAt).slice(0, 10) : '', summary: item?.summary ?? '', keyPoints: (item?.keyPoints ?? []).map((k: { ts: string; text: string }) => (k.ts ? `${k.ts} | ${k.text}` : k.text)).join('\n'), transcript: item?.transcript ?? '' });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [up, setUp] = useState(false);
  const { ai } = useMe();
  const upload = async (file: File) => {
    setUp(true); setErr('');
    try { const fd = new FormData(); fd.append('file', file); const r = await fetch('/api/admin/upload', { method: 'POST', body: fd }); const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Upload failed'); setF((x) => ({ ...x, mediaUrl: d.url, mediaType: d.mediaType })); }
    catch (x) { setErr((x as Error).message); }
    setUp(false);
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setBusy(true);
    const keyPoints = f.keyPoints.split('\n').map((l: string) => l.trim()).filter(Boolean).map((l: string) => { const m = l.match(/^(\d{1,2}:\d{2}(?::\d{2})?)\s*\|\s*(.+)$/); return m ? { ts: m[1], text: m[2] } : { ts: '', text: l }; });
    const b = { ...f, mediaType: f.mediaUrl ? f.mediaType : 'none', keyPoints };
    try { if (item) await api(`/api/library/${item.id}`, { method: 'PATCH', body: b }); else await api('/api/library', { body: b }); done(); } catch (x) { setErr((x as Error).message); }
    setBusy(false);
  };
  return (
    <form onSubmit={submit} data-testid="library-form">
      <div className="h2">{item ? 'Edit library item' : 'Add to library'}</div>
      <label className="lbl">Title</label><input className="field" value={f.title} onChange={set('title')} required />
      <label className="lbl">Speaker</label><input className="field" value={f.speaker} onChange={set('speaker')} required />
      <div className="row gap8"><div style={{ flex: 1 }}><label className="lbl">Category</label><select className="field" value={f.category} onChange={set('category')}><option value="shiur">Shiur</option><option value="lecture">Lecture</option><option value="philosophy">Philosophy</option></select></div>
        <div style={{ flex: 1 }}><label className="lbl">Duration</label><input className="field" value={f.duration} onChange={set('duration')} placeholder="58 min" /></div></div>
      <label className="lbl">Media link (YouTube, Vimeo, mp4/mp3 URL)</label><input className="field" value={f.mediaUrl} onChange={set('mediaUrl')} placeholder="https://youtu.be/…" />
      <label className="lbl">…or upload a file</label><input type="file" accept="video/*,audio/*" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} style={{ fontSize: 12.5 }} />{up ? <span className="muted" style={{ fontSize: 12 }}> Uploading…</span> : null}
      <div className="row gap8"><div style={{ flex: 1 }}><label className="lbl">Media type</label><select className="field" value={f.mediaType} onChange={set('mediaType')}><option value="video">Video</option><option value="audio">Audio</option></select></div>
        <div style={{ flex: 1 }}><label className="lbl">Recorded</label><input className="field" type="date" value={f.recordedAt} onChange={set('recordedAt')} /></div></div>
      <label className="lbl">Summary {item ? '' : `(leave blank to auto-generate${ai?.configured ? ' with AI' : ' — needs AI key or transcript'})`}</label><textarea className="field" value={f.summary} onChange={set('summary')} />
      <label className="lbl">Key points — one per line, optional “12:30 | text”</label><textarea className="field" value={f.keyPoints} onChange={set('keyPoints')} />
      <label className="lbl">Transcript (optional)</label><textarea className="field" value={f.transcript} onChange={set('transcript')} />
      {err ? <div className="err">{err}</div> : null}
      <button className="btn gold block lg mt14" disabled={busy || up}>{busy ? 'Saving…' : 'Save'}</button>
    </form>
  );
}

function InviteForm({ done }: { done: (code: string) => void }) {
  const { f, set } = useForm({ code: '', note: '', email: '', maxUses: '1', role: 'member', expiresDays: '30' });
  const [err, setErr] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('');
    try { const r = await api<{ code: string }>('/api/admin/invites', { body: { ...f, maxUses: Number(f.maxUses), expiresDays: Number(f.expiresDays) } }); done(r.code); } catch (x) { setErr((x as Error).message); }
  };
  return (
    <form onSubmit={submit} data-testid="invite-form">
      <div className="h2">New invite code</div>
      <label className="lbl">Code (blank = random 6 characters)</label><input className="field" value={f.code} onChange={set('code')} maxLength={6} style={{ textTransform: 'uppercase', letterSpacing: '.2em' }} />
      <label className="lbl">For (note)</label><input className="field" value={f.note} onChange={set('note')} placeholder="Guest of Miriam" />
      <label className="lbl">Restrict to email (optional)</label><input className="field" type="email" value={f.email} onChange={set('email')} />
      <div className="row gap8"><div style={{ flex: 1 }}><label className="lbl">Max uses</label><input className="field" type="number" min={1} max={500} value={f.maxUses} onChange={set('maxUses')} /></div>
        <div style={{ flex: 1 }}><label className="lbl">Expires (days)</label><input className="field" type="number" min={0} max={365} value={f.expiresDays} onChange={set('expiresDays')} /></div>
        <div style={{ flex: 1 }}><label className="lbl">Role</label><select className="field" value={f.role} onChange={set('role')}><option value="member">member</option><option value="admin">admin</option></select></div></div>
      {err ? <div className="err">{err}</div> : null}
      <button className="btn gold block lg mt14">Create code</button>
    </form>
  );
}

export default function Admin() { return <><Suspense fallback={<main className="page"><Loading /></main>}><AdminInner /></Suspense><TabBar /></>; }
