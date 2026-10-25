'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Av, Stack, type PU } from './ui';
import { useMe, useStream, useToast } from './Providers';
import { api, fmtTime } from '@/lib/client';

export type FC = { status: string; label: string; correction: string; source: string; method: 'ai' | 'offline' | 'demo' };
export type M = { id: string; roomId: string; kind: 'text' | 'system' | 'roomcard' | 'recap'; body: string; meta: any; factCheck: FC | null; movedToRoomId: string | null; createdAt: number; user: PU | null };

export function useRoom(roomId: string | null, initial?: M[]) {
  const [msgs, setMsgs] = useState<M[]>(initial ?? []);
  const [checking, setChecking] = useState<Set<string>>(new Set());
  const [heat, setHeat] = useState<{ score: number; heated: boolean; reasons: string[] } | null>(null);
  const [members, setMembers] = useState<PU[] | null>(null);
  useStream(roomId ? [`room:${roomId}`] : [], (type, data, ch) => {
    // (re)connected with this room subscribed: resync so nothing posted during the gap is missed
    if (type === 'hello' && roomId && data?.counts && `room:${roomId}` in data.counts) {
      api<{ messages: M[] }>(`/api/rooms/${roomId}`).then((r) => setMsgs(r.messages)).catch(() => {});
      return;
    }
    if (ch !== `room:${roomId}`) return;
    if (type === 'message') setMsgs((xs) => (xs.some((m) => m.id === data.id) ? xs : [...xs, data]));
    if (type === 'checking') setChecking((s) => new Set(s).add(data.id));
    if (type === 'factcheck') {
      setChecking((s) => { const n = new Set(s); n.delete(data.id); return n; });
      if (data.factCheck) setMsgs((xs) => xs.map((m) => (m.id === data.id ? { ...m, factCheck: data.factCheck } : m)));
    }
    if (type === 'moved') setMsgs((xs) => xs.filter((m) => !data.ids.includes(m.id)));
    if (type === 'heat') setHeat(data);
    if (type === 'members') setMembers(data);
  });
  return { msgs, setMsgs, checking, heat, setHeat, members, setMembers };
}

function FactCheck({ fc }: { fc: FC }) {
  if (fc.status === 'not_configured') return <div className="fc not_configured" data-testid="factcheck"><div className="flbl">✦ {fc.label || 'AI fact-check not configured'}</div><span className="muted" style={{ fontSize: 11.5 }}>This looks like a factual claim. Add an AI key to enable automatic fact-checking.</span></div>;
  const icon = fc.status === 'accurate' ? '✓' : fc.status === 'unverifiable' || fc.status === 'error' ? '?' : '⚠';
  return (
    <div className={`fc ${fc.status}`} data-testid="factcheck">
      <div className="flbl">{icon} Fact check · {fc.label}</div>
      {fc.correction}
      {fc.source || fc.method ? <div className="src">{fc.source ? `Source: ${fc.source} · ` : ''}✦ Kerem AI{fc.method === 'demo' ? ' (demo seed)' : ''}</div> : null}
    </div>
  );
}

function RoomCard({ m }: { m: M }) {
  const router = useRouter();
  const toast = useToast();
  const { me } = useMe();
  const meta = m.meta ?? {};
  const members: PU[] = meta.members ?? [];
  const joined = members.some((u) => u.id === me?.id);
  const archived = meta.status === 'archived';
  const join = async () => {
    try { if (!joined && !archived) await api(`/api/rooms/${meta.roomId}/join`, { body: {} }); router.push(`/rooms/${meta.roomId}`); } catch (e) { toast((e as Error).message, 'err'); }
  };
  return (
    <div className="roomcard" data-testid="roomcard">
      <div className="row gap8" style={{ fontSize: 11, color: 'var(--gold2)', fontWeight: 700, letterSpacing: '.08em' }}>✦ {meta.method === 'ai' ? 'KEREM AI' : 'KEREM'} · KEEPING THE HALL CALM</div>
      <div style={{ fontSize: 13.5, marginTop: 6, color: '#E9E2D3' }}>This debate moved to a side room:</div>
      <div className="serif" style={{ fontSize: 19, fontWeight: 600, marginTop: 2 }}>“{meta.title}”</div>
      {meta.method && meta.method !== 'ai' ? <div className="muted" style={{ fontSize: 10.5, marginTop: 3 }}>Detected by heuristics (AI not configured)</div> : null}
      <div className="row between" style={{ marginTop: 9 }}>
        <div className="row gap8"><Stack users={members} /><span style={{ fontSize: 12, color: 'var(--muted)' }}>{members.length} member{members.length === 1 ? '' : 's'}{archived ? ' · archived' : ''}</span></div>
        <button className="btn gold" style={{ height: 34, padding: '0 20px' }} onClick={join} data-testid="roomcard-join">{archived ? 'View' : joined ? 'Open' : 'Join'}</button>
      </div>
    </div>
  );
}

export function MessageList({ msgs, checking, compact }: { msgs: M[]; checking?: Set<string>; compact?: boolean }) {
  const { me } = useMe();
  let lastDay = '';
  return (
    <div className="chatlist" data-testid="chatlist">
      {msgs.map((m) => {
        const day = new Date(m.createdAt).toDateString();
        const showDay = day !== lastDay && !compact;
        lastDay = day;
        const dayEl = showDay ? <div className="sys">{day === new Date().toDateString() ? 'Today' : new Date(m.createdAt).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}</div> : null;
        if (m.kind === 'roomcard') return <div key={m.id}>{dayEl}<RoomCard m={m} /></div>;
        if (m.kind === 'recap') return <div key={m.id}>{dayEl}<div className="recap" data-testid="recap"><div style={{ fontSize: 11, color: 'var(--gold2)', fontWeight: 700, letterSpacing: '.08em', marginBottom: 4 }}>✦ SIDE ROOM RECAP · {m.meta?.title}</div>{m.body}{m.meta?.roomId ? <div className="mt6"><Link href={`/rooms/${m.meta.roomId}`} style={{ color: 'var(--gold2)', fontSize: 12 }}>Read the archived room →</Link></div> : null}</div></div>;
        if (m.kind === 'system') return <div key={m.id}>{dayEl}<div className={`sys ${m.meta?.movedCount ? 'box' : ''}`}>{m.body}</div></div>;
        const mine = m.user?.id === me?.id;
        return (
          <div key={m.id}>
            {dayEl}
            <div className={`msg ${mine ? 'me' : ''}`} data-testid="msg">
              {mine ? null : <Link href={`/members/${m.user?.id}`}><Av u={m.user} /></Link>}
              <div className="msgcol">
                <div className="bub">{mine ? null : <div className="nm">{m.user?.name}</div>}{m.body}</div>
                {checking?.has(m.id) ? <div className="checking">✦ Checking claim…</div> : null}
                {m.factCheck ? <FactCheck fc={m.factCheck} /> : null}
                <div className="time">{fmtTime(m.createdAt)}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function useAutoScroll(dep: unknown) {
  const ref = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const onScroll = useCallback(() => { const el = ref.current; if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120; }, []);
  useLayoutEffect(() => { const el = ref.current; if (el && stick.current) el.scrollTop = el.scrollHeight; }, [dep]);
  useEffect(() => { const el = ref.current; if (el) el.scrollTop = el.scrollHeight; }, []);
  return { ref, onScroll };
}

export function Composer({ roomId, placeholder, notab, onSent, disabled }: { roomId: string; placeholder: string; notab?: boolean; onSent?: (m: M) => void; disabled?: boolean }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const send = async () => {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    try { const r = await api<{ message: M }>(`/api/rooms/${roomId}/messages`, { body: { body: t } }); setText(''); onSent?.(r.message); }
    catch (e) { toast((e as Error).message, 'err'); }
    setBusy(false);
  };
  return (
    <form className={`composer ${notab ? 'notab' : ''}`} onSubmit={(e) => { e.preventDefault(); send(); }}>
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} aria-label="Message" data-testid="composer" disabled={disabled} maxLength={2000} enterKeyHint="send" />
      <button className="send" aria-label="Send" disabled={!text.trim() || busy || disabled}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0B1426" strokeWidth="2.2"><path d="M4 12l16-8-6 16-2.5-6.5z" /></svg></button>
    </form>
  );
}
