'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/ui';
import { api } from '@/lib/client';
export default function Apply() {
  const [f, setF] = useState({ name: '', email: '', sponsor: '', reason: '' });
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true); setErr('');
    try { await api('/api/applications', { body: f }); setDone(true); } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };
  return (
    <div className="gate" style={{ textAlign: 'left' }}>
      <div style={{ display: 'flex', justifyContent: 'center' }}><Logo s={72} /></div>
      <div className="h1" style={{ textAlign: 'center', marginTop: 14 }}>Request an invitation</div>
      <div className="corm" style={{ fontSize: 18, fontStyle: 'italic', color: '#D9CFBB', textAlign: 'center', marginTop: 6 }}>The committee reviews every application.</div>
      {done ? (
        <div className="card" style={{ padding: 18, marginTop: 28, textAlign: 'center' }}>
          <div className="h2">Thank you</div>
          <p className="muted mt8" style={{ fontSize: 14, lineHeight: 1.5 }}>Your application has been received. Once approved, an administrator will send you a personal invitation code.</p>
          <Link className="btn ghost mt16" href="/login">Back to the gate</Link>
        </div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); submit(); }} style={{ marginTop: 20 }}>
          <label className="lbl">Full name</label><input className="field" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <label className="lbl">Email</label><input className="field" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          <label className="lbl">Sponsoring member (optional)</label><input className="field" value={f.sponsor} onChange={(e) => setF({ ...f, sponsor: e.target.value })} />
          <label className="lbl">What draws you to Kerem?</label><textarea className="field" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />
          {err ? <div className="err">{err}</div> : null}
          <button className="btn gold lg block mt16" disabled={busy}>{busy ? 'Sending…' : 'Submit application'}</button>
          <div style={{ textAlign: 'center', marginTop: 16 }}><Link href="/login" style={{ color: 'var(--gold2)', fontSize: 13 }}>← Back</Link></div>
        </form>
      )}
    </div>
  );
}
