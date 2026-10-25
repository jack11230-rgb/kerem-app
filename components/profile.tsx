'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Back, Bell, Icon, Loading, DemoPill } from './ui';
import { useMe, useToast } from './Providers';
import { api } from '@/lib/client';

type P = { member: { id: string; name: string; initials: string; color: number; role: string; title: string; bio: string; interests: string[]; createdAt: number; isDemo: boolean }; stats: { attended: number; streak: number; notes: number; weeks: number[] }; highlights: { id: string; text: string; ts: string; sourceTitle: string; libraryItemId: string | null }[]; isMe: boolean };

export function Profile({ id }: { id: string }) {
  const { me, refresh } = useMe();
  const toast = useToast();
  const [p, setP] = useState<P | null>(null);
  const [err, setErr] = useState('');
  const [edit, setEdit] = useState(false);
  const [bio, setBio] = useState('');
  const [name, setName] = useState('');
  const [ints, setInts] = useState('');
  const [perm, setPerm] = useState<string>('default');
  const load = useCallback(() => api<P>(`/api/members/${id}`).then((x) => { setP(x); setBio(x.member.bio); setName(x.member.name); setInts(x.member.interests.join(', ')); }).catch((e) => setErr(e.message)), [id]);
  useEffect(() => { load(); setPerm(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission); }, [load]);
  if (err) return <main className="page"><Back /><div className="empty mt16">{err}</div></main>;
  if (!p) return <main className="page"><Loading /></main>;
  const m = p.member;
  const save = async () => {
    await api('/api/me', { method: 'PATCH', body: { bio, name, interests: ints.split(',').map((s) => s.trim()).filter(Boolean) } });
    setEdit(false); await load(); await refresh(); toast('Profile saved');
  };
  const enablePush = async () => {
    if (typeof Notification === 'undefined') return toast('Notifications are not supported in this browser');
    const r = await Notification.requestPermission(); setPerm(r);
    toast(r === 'granted' ? 'Notifications enabled on this device' : 'Notifications were not allowed');
  };
  const logout = async () => { await api('/api/auth/logout', { body: {} }); location.href = '/login?mode=signin'; };
  const since = new Date(m.createdAt).getFullYear();
  const maxW = Math.max(1, ...p.stats.weeks);
  return (
    <main className="page">
      <div className="top">
        {p.isMe ? <div className="eyebrow">Your profile</div> : <div className="row gap10"><Back /><div className="eyebrow">Member profile</div></div>}
        {p.isMe ? <Bell /> : null}
      </div>
      <div style={{ textAlign: 'center' }}>
        <div className={`bigav a${m.color}`}>{m.initials}</div>
        <div className="serif" style={{ fontSize: 24, fontWeight: 600, marginTop: 12 }} data-testid="profile-name">{m.name} <DemoPill show={m.isDemo} /></div>
        <div style={{ fontSize: 12, color: 'var(--gold2)', marginTop: 3 }}>{m.role === 'admin' ? 'Admin · ' : ''}{m.title || 'Member'} · Member since {since}</div>
        {edit ? null : <div style={{ fontSize: 13, color: '#C5CBD8', lineHeight: 1.5, margin: '10px 6px 0' }}>{m.bio || (p.isMe ? 'Add a short bio so members know who you are.' : '')}</div>}
      </div>
      {edit ? (
        <div className="card mt14" style={{ padding: 14 }}>
          <label className="lbl" style={{ marginTop: 0 }}>Name</label><input className="field" value={name} onChange={(e) => setName(e.target.value)} />
          <label className="lbl">Bio</label><textarea className="field" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={600} data-testid="bio" />
          <label className="lbl">Interests (comma separated)</label><input className="field" value={ints} onChange={(e) => setInts(e.target.value)} placeholder="Rambam, Ethics, Talmud" />
          <div className="row gap8 mt12"><button className="btn gold" style={{ flex: 1 }} onClick={save} data-testid="save-profile">Save</button><button className="btn ghost" style={{ flex: 1 }} onClick={() => setEdit(false)}>Cancel</button></div>
        </div>
      ) : null}
      <div className="card row" style={{ marginTop: 14 }}>
        <div className="stat"><b>🔥 {p.stats.streak}</b><span>week streak</span></div>
        <div className="stat" style={{ borderLeft: '1px solid var(--line)', borderRight: '1px solid var(--line)' }}><b data-testid="attended">{p.stats.attended}</b><span>shiurim attended</span></div>
        <div className="stat"><b>{p.stats.notes}</b><span>saved notes</span></div>
      </div>
      <div className="eyebrow" style={{ margin: '16px 0 8px' }}>Attendance · last 12 weeks</div>
      <div className="streak">{p.stats.weeks.map((w, i) => <i key={i} className={w ? '' : 'off'} style={w ? { opacity: 0.45 + 0.55 * (w / maxW) } : undefined} title={`${w} session${w === 1 ? '' : 's'}`} />)}</div>
      {m.interests.length ? <><div className="eyebrow" style={{ margin: '16px 0 8px' }}>Interests</div><div className="row" style={{ gap: 7, flexWrap: 'wrap' }}>{m.interests.map((x) => <span key={x} className="chip">{x}</span>)}</div></> : null}
      <div className="eyebrow" style={{ margin: '16px 0 8px' }}>{p.isMe ? 'My highlights' : 'Recent highlights'}</div>
      {p.highlights.length ? p.highlights.slice(0, p.isMe ? 10 : 3).map((h) => (
        <Link key={h.id} href={h.libraryItemId ? `/library/${h.libraryItemId}` : '#'} className="card hlcard" style={{ display: 'block', padding: '11px 12px', fontSize: 12.8, lineHeight: 1.45, borderLeft: '3px solid var(--gold)', marginBottom: 8 }}>
          {h.text}<div className="muted" style={{ fontSize: 11, marginTop: 3 }}>{h.sourceTitle}{h.ts ? ` · ${h.ts}` : ''}</div>
        </Link>
      )) : <div className="empty">{p.isMe ? 'Tap a key point in any library item to save it here.' : 'No highlights yet.'}</div>}
      {p.isMe ? (
        <div className="mt20">
          {!edit ? <button className="btn ghost block mb10" onClick={() => setEdit(true)} data-testid="edit-profile"><Icon k="edit" s={15} /> Edit profile</button> : null}
          <Link href="/members" className="btn ghost block mb10"><Icon k="users" s={15} /> Member directory</Link>
          {perm !== 'granted' && perm !== 'unsupported' ? <button className="btn ghost block mb10" onClick={enablePush}><Icon k="bell" s={15} /> Enable device notifications</button> : null}
          {me?.role === 'admin' ? <Link href="/admin" className="btn gold block mb10" data-testid="admin-link"><Icon k="shield" s={15} /> Admin panel</Link> : null}
          <button className="btn ghost block" onClick={logout} data-testid="logout"><Icon k="logout" s={15} /> Sign out</button>
        </div>
      ) : null}
    </main>
  );
}
