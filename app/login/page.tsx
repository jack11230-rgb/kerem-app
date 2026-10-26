'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Logo } from '@/components/ui';
import { api } from '@/lib/client';

function Gate() {
  const sp = useSearchParams();
  const [mode, setMode] = useState<'invite' | 'signin'>(sp.get('mode') === 'signin' ? 'signin' : 'invite');
  const [code, setCode] = useState<string[]>(Array(6).fill(''));
  const [inv, setInv] = useState<{ email: string | null; note: string } | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [welcome, setWelcome] = useState('');
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const full = code.join('');

  useEffect(() => {
    const c = (sp.get('code') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    if (c) { setCode(c.padEnd(6, ' ').split('').map((x) => x.trim())); setMode('invite'); }
  }, [sp]);

  const setAt = (i: number, v: string) => {
    const clean = v.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (clean.length > 1) { // paste
      const arr = clean.slice(0, 6).padEnd(6, ' ').split('').map((x) => x.trim());
      setCode(arr); boxes.current[Math.min(5, clean.length)]?.focus(); return;
    }
    const n = [...code]; n[i] = clean; setCode(n); setInv(null); setErr('');
    if (clean && i < 5) boxes.current[i + 1]?.focus();
  };
  const verify = async () => {
    setErr(''); setBusy(true);
    try {
      const r = await api<{ valid: boolean; reason?: string; email: string | null; note: string }>('/api/auth/verify-invite', { body: { code: full } });
      if (!r.valid) setErr(r.reason || 'Invalid code');
      else { setInv({ email: r.email, note: r.note }); if (r.email) setEmail(r.email); }
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };
  const signup = async () => {
    setErr(''); setBusy(true);
    try {
      const r = await api<{ user: { name: string } }>('/api/auth/signup', { body: { code: full, name, email, password: pw } });
      setWelcome(`✓ Invitation verified — welcome, ${r.user.name.split(' ')[0]}`);
      setTimeout(() => { location.href = '/'; }, 700);
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  };
  const signin = async () => {
    setErr(''); setBusy(true);
    try { await api('/api/auth/login', { body: { email, password: pw } }); const n = sp.get('next') || '/'; location.href = n.startsWith('/') && !n.startsWith('//') ? n : '/'; }
    catch (e) { setErr((e as Error).message); setBusy(false); }
  };

  return (
    <div className="gate">
      <div style={{ marginTop: 10, display: 'flex', justifyContent: 'center' }}><Logo s={124} style={{ filter: 'drop-shadow(0 6px 22px rgba(201,164,92,.18))' }} /></div>
      <div className="sc" style={{ fontSize: 40, letterSpacing: '.32em', color: 'var(--gold2)', marginTop: 18, paddingLeft: 12 }}>KEREM</div>
      <div className="corm" style={{ fontSize: 21, fontStyle: 'italic', color: '#D9CFBB', marginTop: 6, lineHeight: 1.3 }}>A private circle for Torah,<br />philosophy &amp; conversation</div>
      <div className="divider" style={{ margin: '36px 0 14px' }}><i /><span className="eyebrow">{mode === 'invite' ? 'By invitation only' : 'Members sign in'}</span><i /></div>

      {mode === 'invite' ? (
        <>
          {!inv ? <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>Enter the code from your invitation</div> : null}
          <div className="codes" data-testid="code-boxes">
            {code.map((c, i) => (
              <input key={i} ref={(el) => { boxes.current[i] = el; }} className="cbox" value={c} inputMode="text" autoCapitalize="characters" autoComplete="off" aria-label={`Code character ${i + 1}`}
                maxLength={i === 0 ? 6 : 1} onChange={(e) => setAt(i, e.target.value)} disabled={!!inv}
                onKeyDown={(e) => { if (e.key === 'Backspace' && !code[i] && i > 0) boxes.current[i - 1]?.focus(); if (e.key === 'Enter' && full.length === 6) verify(); }} />
            ))}
          </div>
          {!inv ? (
            <button className="btn gold lg block" style={{ marginTop: 18 }} disabled={full.length !== 6 || busy} onClick={verify}>{busy ? 'Checking…' : 'Enter the Kerem'}</button>
          ) : welcome ? (
            <div className="btn lg block" style={{ marginTop: 18, background: '#1F3E35', color: '#A9E2C4' }}>{welcome}</div>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); signup(); }} style={{ textAlign: 'left', marginTop: 16 }}>
              <div className="ok" style={{ textAlign: 'center', marginTop: 0, marginBottom: 6 }}>✓ Invitation verified{inv.note ? ` · ${inv.note}` : ''}</div>
              <input className="field mt8" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" name="name" />
              <input className="field mt8" placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" name="email" readOnly={!!inv.email} />
              <input className="field mt8" placeholder="Choose a password (8+ characters)" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" name="password" />
              <button className="btn gold lg block" style={{ marginTop: 14 }} disabled={busy}>{busy ? 'Creating…' : 'Create my membership'}</button>
            </form>
          )}
        </>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); signin(); }}>
          <input className="field" placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" name="email" />
          <input className="field mt10" placeholder="Password" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" name="password" />
          <button className="btn gold lg block" style={{ marginTop: 16 }} disabled={busy || !email || !pw}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
      )}
      {err ? <div className="err" role="alert">{err}</div> : null}

      <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
        {mode === 'invite'
          ? <button style={{ color: 'var(--cream)' }} onClick={() => { setMode('signin'); setErr(''); }}>Already a member? <span style={{ color: 'var(--gold2)' }}>Sign in</span></button>
          : <button style={{ color: 'var(--cream)' }} onClick={() => { setMode('invite'); setErr(''); }}>Have an invitation code? <span style={{ color: 'var(--gold2)' }}>Join</span></button>}
        <Link href="/apply" style={{ color: 'var(--gold2)' }}>Request an invitation →</Link>
      </div>
      <div style={{ fontSize: 11, color: '#5E6882', marginTop: 34, lineHeight: 1.5 }}>Membership is reviewed by the Kerem committee.<br />Sponsored by an existing member.</div>
    </div>
  );
}
export default function LoginPage() { return <Suspense><Gate /></Suspense>; }
