'use client';
import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { Back, Icon, TabBar, Loading } from '@/components/ui';
import { Player } from '@/components/media';
import { DiscussionSummary, type DSum } from '@/components/summary';
import { useToast, useMe } from '@/components/Providers';
import { api, KIND_LABEL } from '@/lib/client';
import type { Lib } from '../page';

type Note = { id: string; text: string; ts: string; createdAt: number };

export default function LibItem({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const toast = useToast();
  const { me } = useMe();
  const [d, setD] = useState<{ item: Lib; discussion: DSum | null; eventId: string | null; notes: Note[] } | null>(null);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState<'sum' | 'tr' | 'notes'>('sum');
  const [draft, setDraft] = useState('');
  useEffect(() => { api(`/api/library/${id}`).then(setD).catch((e) => setErr(e.message)); }, [id]);
  if (err) return <main className="page"><Back /><div className="empty mt16">{err}</div></main>;
  if (!d) return <main className="page"><Loading /></main>;
  const { item } = d;
  const saved = new Set(d.notes.map((n) => n.text));
  const addNote = async (text: string, ts = '') => {
    const existing = d.notes.find((n) => n.text === text);
    if (existing) { await api(`/api/notes/${existing.id}`, { method: 'DELETE' }); setD({ ...d, notes: d.notes.filter((n) => n.id !== existing.id) }); toast('Highlight removed'); return; }
    const r = await api<{ id: string }>('/api/notes', { body: { libraryItemId: item.id, text, ts } });
    setD({ ...d, notes: [{ id: r.id, text, ts, createdAt: Date.now() }, ...d.notes] });
    toast('✦ Highlight saved to My Notes');
  };
  const del = async (n: Note) => { await api(`/api/notes/${n.id}`, { method: 'DELETE' }); setD({ ...d, notes: d.notes.filter((x) => x.id !== n.id) }); };
  return (
    <>
      <main className="page" style={{ paddingTop: 0 }}>
        <Player url={item.mediaUrl} mediaType={item.mediaType} thumb={item.thumb}><span className="backbtn" style={{ position: 'absolute', left: 14, top: 'calc(var(--safe-t) + 12px)', zIndex: 5 }}><Back /></span></Player>
        <div className="serif" style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.25, marginTop: 14 }}>{item.title}</div>
        <div className="muted" style={{ fontSize: 12, marginTop: 5 }}>{item.speaker} · {KIND_LABEL[item.category]} · Recorded {new Date(item.recordedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}{item.duration ? ` · ${item.duration}` : ''}</div>
        <div className="ltabs">
          <button className={tab === 'sum' ? 'on' : ''} onClick={() => setTab('sum')}>✦ {item.summaryMethod === 'ai' ? 'AI ' : ''}Summary</button>
          <button className={tab === 'tr' ? 'on' : ''} onClick={() => setTab('tr')}>Transcript</button>
          <button className={tab === 'notes' ? 'on' : ''} onClick={() => setTab('notes')} data-testid="tab-notes">My Notes{d.notes.length ? ` · ${d.notes.length}` : ''}</button>
        </div>
        {tab === 'sum' ? (
          <>
            {item.summary ? <div className="tldr"><b style={{ color: 'var(--gold2)' }}>In short:</b> {item.summary}</div> : <div className="empty">No summary yet.</div>}
            {item.summaryMethod === 'extractive' ? <div className="muted" style={{ fontSize: 11, marginBottom: 6 }}>Extractive summary (AI not configured)</div> : null}
            {item.keyPoints.length ? <>
              <div className="row between" style={{ margin: '12px 0 2px' }}><span className="eyebrow">Key points</span><span className="muted" style={{ fontSize: 11 }}>Tap to highlight</span></div>
              {item.keyPoints.map((k, i) => (
                <button key={i} className={`kp ${saved.has(k.text) ? 'saved' : ''}`} onClick={() => addNote(k.text, k.ts)} data-testid="keypoint">
                  <span className="n">{i + 1}</span><span style={{ flex: 1 }}>{k.text}</span>{k.ts ? <span className="ts">{k.ts}</span> : null}
                </button>
              ))}
            </> : null}
            {d.discussion ? <>
              <div className="eyebrow mt20 mb10">From the live discussion</div>
              <DiscussionSummary s={d.discussion} />
            </> : null}
            {me?.role === 'admin' ? <Link href={`/admin?tab=library&edit=${item.id}`} className="btn ghost block mt16" style={{ height: 40 }}><Icon k="edit" s={15} /> Edit item</Link> : null}
          </>
        ) : tab === 'tr' ? (
          item.transcript ? <div style={{ fontSize: 13.5, lineHeight: 1.65, color: '#D9D3C5', whiteSpace: 'pre-wrap', marginTop: 8 }}>{item.transcript}</div> : <div className="empty mt8">No transcript available for this recording.</div>
        ) : (
          <div className="mt8">
            <form onSubmit={async (e) => { e.preventDefault(); if (!draft.trim()) return; await addNote(draft.trim()); setDraft(''); }}>
              <textarea className="field" placeholder="Write a note or a line worth remembering…" value={draft} onChange={(e) => setDraft(e.target.value)} />
              <button className="btn gold sm mt8" disabled={!draft.trim()}>Save note</button>
            </form>
            <div className="mt14">
              {d.notes.length ? d.notes.map((n) => (
                <div key={n.id} className="card hlcard row gap10" style={{ alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>{n.text}{n.ts ? <span className="ts" style={{ marginLeft: 6, fontSize: 10.5, color: 'var(--gold2)' }}>{n.ts}</span> : null}</div>
                  <button aria-label="Delete note" onClick={() => del(n)} className="muted"><Icon k="x" s={14} /></button>
                </div>
              )) : <div className="empty">Tap a key point to save it here, or write your own note.</div>}
            </div>
          </div>
        )}
      </main>
      <TabBar />
    </>
  );
}
