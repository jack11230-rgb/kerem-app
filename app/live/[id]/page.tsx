'use client';
import Link from 'next/link';
import { use, useCallback, useEffect, useRef, useState } from 'react';
import { Back, Icon, TabBar, Loading, type PU } from '@/components/ui';
import { Composer, MessageList, useAutoScroll, useRoom, type M } from '@/components/chat';
import { speakerInitials, type Ev } from '@/components/events';
import { DiscussionSummary } from '@/components/summary';
import { useMe, useStream, useToast } from '@/components/Providers';
import { api, toEmbed } from '@/lib/client';

type Q = { id: string; body: string; status: 'open' | 'answering' | 'answered'; votes: number; voted: boolean; user: PU | null; createdAt: number };
const BARS = [14, 26, 34, 20, 38, 28, 16, 30, 40, 22, 12, 26, 34, 18, 10];

function elapsed(from: number) { const s = Math.max(0, Math.floor((Date.now() - from) / 1000)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60; return `${h ? `${h}:` : ''}${String(m).padStart(h ? 2 : 1, '0')}:${String(ss).padStart(2, '0')}`; }
function ago(t: number) { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'just now' : `${m} min ago`; }

export default function LivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { me } = useMe();
  const toast = useToast();
  const [ev, setEv] = useState<(Ev & { liveStartedAt?: number | null }) | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [qs, setQs] = useState<Q[]>([]);
  const [tab, setTab] = useState<'d' | 'q'>('d');
  const [watching, setWatching] = useState(0);
  const [qText, setQText] = useState('');
  const [busy, setBusy] = useState(false);
  const [, tick] = useState(0);
  const [err, setErr] = useState('');
  const r = useRoom(roomId);
  const { ref, onScroll } = useAutoScroll(r.msgs.length + qs.length + tab);
  const admin = me?.role === 'admin';

  const load = useCallback(async () => {
    try {
      const d = await api<{ event: Ev & { liveStartedAt: number | null }; room: { id: string }; messages: M[]; questions: Q[] }>(`/api/events/${id}/live`);
      setEv(d.event); setRoomId(d.room.id); r.setMsgs(d.messages); setQs(d.questions); setWatching(d.event.watching);
    } catch (e) { setErr((e as Error).message); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  const qSeq = useRef(0);
  const loadQs = useCallback(async () => { const n = ++qSeq.current; const d = await api<{ questions: Q[] }>(`/api/events/${id}/questions`); if (n === qSeq.current) setQs(d.questions); }, [id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 1000); return () => clearInterval(t); }, []);
  useStream([`event:${id}`], (type, data, ch) => {
    if (type === 'hello' && data?.counts && `event:${id}` in data.counts) { load(); return; } // resync after (re)connect
    if (ch !== `event:${id}`) return;
    if (type === 'questions') loadQs();
    if (type === 'status') load();
    if (type === 'presence') setWatching(data.count);
  });

  const ask = async () => {
    const t = qText.trim(); if (!t) return;
    setBusy(true);
    try { await api(`/api/events/${id}/questions`, { body: { body: t } }); setQText(''); await loadQs(); toast('Question posted'); } catch (e) { toast((e as Error).message, 'err'); }
    setBusy(false);
  };
  const vote = async (q: Q) => {
    setQs((xs) => xs.map((x) => (x.id === q.id ? { ...x, voted: !x.voted, votes: x.votes + (x.voted ? -1 : 1) } : x)));
    try { await api(`/api/questions/${q.id}/vote`, { body: {} }); } catch (e) { toast((e as Error).message, 'err'); loadQs(); }
  };
  const setStatus = async (q: Q, status: Q['status']) => { await api(`/api/questions/${q.id}`, { method: 'PATCH', body: { status } }); loadQs(); };
  const control = async (action: 'start' | 'end') => {
    if (action === 'end' && !confirm('End the live session and generate the discussion summary?')) return;
    setBusy(true);
    try { await api(`/api/events/${id}/live`, { body: { action } }); await load(); if (action === 'end') toast('Session ended · summary generated'); } catch (e) { toast((e as Error).message, 'err'); }
    setBusy(false);
  };

  if (err) return <main className="page"><Back href="/live" /><div className="empty mt16">{err}</div></main>;
  if (!ev || !roomId) return <main className="page"><Loading /></main>;
  const live = ev.status === 'live';
  const embed = live ? toEmbed(ev.streamUrl) : null;
  return (
    <div className="livepane">
      <div className="scroll" ref={ref} onScroll={onScroll}>
        <div className="stagevid" style={{ marginTop: 0 }}>
          {embed && (embed.type === 'iframe') ? <iframe src={embed.src} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen title="Live stream" />
            : embed && embed.type === 'video' ? <video src={embed.src} controls autoPlay playsInline muted />
            : <>
              <div className="thumb t1" style={{ position: 'absolute', inset: 0, height: 'auto', opacity: 0.6 }} />
              <div className="spk">{speakerInitials(ev.speaker)}</div>
              {live ? <div className="wave">{BARS.map((h, i) => <i key={i} style={{ height: h, animationDelay: `${(i % 5) * 0.12}s` }} />)}</div> : null}
            </>}
          <span style={{ position: 'absolute', left: 14, top: 12, zIndex: 5, display: live ? 'none' : 'block' }}><Back href="/live" /></span>
          {live ? <span className="livebadge" data-testid="livebadge"><i />LIVE · {elapsed(ev.liveStartedAt ?? ev.startsAt)}</span> : null}
          {live ? <span style={{ position: 'absolute', right: 14, top: 12, fontSize: 11.5, background: 'rgba(0,0,0,.45)', padding: '4px 9px', borderRadius: 6, zIndex: 4 }}>👁 {watching} watching</span> : null}
          {!live ? <div style={{ position: 'absolute', left: 0, right: 0, bottom: 18, textAlign: 'center', fontSize: 12.5, color: '#C5CBD8', zIndex: 3 }}>{ev.status === 'ended' ? 'This session has ended' : 'Not live yet'}</div> : null}
        </div>
        <div className="serif" style={{ fontSize: 18.5, fontWeight: 600, marginTop: 12 }}>{ev.title}</div>
        <div className="row between">
          <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>{ev.speaker}{ev.location ? ` · ${ev.location} + online` : ' · online'}</div>
          {admin && live ? <button className="btn danger sm" onClick={() => control('end')} disabled={busy} data-testid="end-live">{busy ? 'Summarizing…' : 'End & summarize'}</button> : null}
          {admin && ev.status === 'scheduled' ? <button className="btn gold sm" onClick={() => control('start')} disabled={busy} data-testid="start-live">Go live</button> : null}
        </div>
        {ev.status === 'ended' ? (
          <div className="mt16" style={{ paddingBottom: 20 }}>
            {ev.summary ? <DiscussionSummary s={ev.summary} title={ev.title} /> : <div className="empty">Summary not available.</div>}
            <div className="row gap8 mt14">
              {ev.libraryItemId ? <Link href={`/library/${ev.libraryItemId}`} className="btn gold" style={{ flex: 1 }}>Open in Library</Link> : null}
              <Link href="/rooms" className="btn ghost" style={{ flex: 1 }}>Open side rooms</Link>
            </div>
          </div>
        ) : (
          <>
            <div className="ltabs">
              <button className={tab === 'd' ? 'on' : ''} onClick={() => setTab('d')} data-testid="tab-discussion">Discussion</button>
              <button className={tab === 'q' ? 'on' : ''} onClick={() => setTab('q')} data-testid="tab-qa">Q&amp;A · {qs.length}</button>
            </div>
            {tab === 'd' ? (
              r.msgs.length ? <div style={{ margin: '0 -16px' }}><MessageList msgs={r.msgs} checking={r.checking} compact /></div> : <div className="empty mt8">{live ? 'Be the first to share a thought.' : 'Discussion opens when the shiur goes live.'}</div>
            ) : (
              <div className="mt8" style={{ paddingBottom: 12 }}>
                {qs.length ? qs.map((q) => (
                  <div key={q.id} className={`card qa ${q.status}`} data-testid="question" style={{ opacity: q.status === 'answered' ? 0.6 : 1 }}>
                    <button className={`up ${q.voted ? 'on' : ''}`} onClick={() => vote(q)} aria-pressed={q.voted} aria-label="Upvote" data-testid="upvote">▲<span>{q.votes}</span></button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.35 }}>{q.body}</div>
                      {q.status === 'answering' ? <div style={{ fontSize: 11, color: 'var(--green)', marginTop: 4 }}>● {ev.speaker.split(' ').slice(0, 2).join(' ')} is answering now</div>
                        : <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>{q.user?.name} · {ago(q.createdAt)}{q.status === 'answered' ? ' · answered' : ''}</div>}
                      {admin && live ? <div className="row gap6 mt6">
                        {q.status !== 'answering' ? <button className="btn ghost sm" style={{ height: 26, fontSize: 11 }} onClick={() => setStatus(q, 'answering')}>Answering</button> : null}
                        {q.status !== 'answered' ? <button className="btn ghost sm" style={{ height: 26, fontSize: 11 }} onClick={() => setStatus(q, 'answered')}>Answered</button> : null}
                      </div> : null}
                    </div>
                  </div>
                )) : <div className="empty">No questions yet. Ask the speaker something.</div>}
              </div>
            )}
          </>
        )}
      </div>
      {ev.status !== 'ended' ? (
        tab === 'd'
          ? <Composer roomId={roomId} placeholder={live ? 'Add your two cents…' : 'Chat opens when live'} disabled={!live} onSent={(m) => r.setMsgs((xs) => (xs.some((x) => x.id === m.id) ? xs : [...xs, m]))} />
          : <form className="composer" onSubmit={(e) => { e.preventDefault(); ask(); }}>
              <input value={qText} onChange={(e) => setQText(e.target.value)} placeholder="Ask the speaker a question…" data-testid="ask-input" maxLength={400} />
              <button className="send" aria-label="Ask" disabled={!qText.trim() || busy}><Icon k="plus" s={18} c="#0B1426" w={2.2} /></button>
            </form>
      ) : null}
      <TabBar />
    </div>
  );
}
