'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Icon, TabBar, Thumb, Loading } from '@/components/ui';
import { api } from '@/lib/client';

export type Lib = { id: string; title: string; speaker: string; category: string; mediaType: string; mediaUrl: string; duration: string; recordedAt: number; summary: string; keyPoints: { text: string; ts: string }[]; transcript: string; thumb: number; eventId: string | null; summaryMethod: string };
const CATS = [['all', 'All'], ['shiur', 'Shiurim'], ['lecture', 'Lectures'], ['philosophy', 'Philosophy']] as const;

export default function Library() {
  const [cat, setCat] = useState('all');
  const [items, setItems] = useState<Lib[] | null>(null);
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  useEffect(() => { setItems(null); api<{ items: Lib[] }>(`/api/library?category=${cat}`).then((r) => setItems(r.items)); }, [cat]);
  const shown = (items ?? []).filter((i) => !q || `${i.title} ${i.speaker} ${i.summary}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <main className="page">
        <div className="top">
          <div><div className="eyebrow">{items ? `${items.length} recording${items.length === 1 ? '' : 's'}` : ' '}</div><div className="h1" style={{ marginTop: 6 }}>Library</div></div>
          <button className="iconbtn" aria-label="Search" onClick={() => setSearching(!searching)}><Icon k="search" s={19} /></button>
        </div>
        {searching ? <div className="search"><Icon k="search" s={16} c="#9AA3B5" /><input autoFocus placeholder="Search titles, speakers, topics" value={q} onChange={(e) => setQ(e.target.value)} /></div> : null}
        <div className="chips">{CATS.map(([k, l]) => <button key={k} className={`chip ${cat === k ? 'on' : ''}`} onClick={() => setCat(k)} data-testid={`cat-${k}`}>{l}</button>)}</div>
        {!items ? <Loading /> : shown.length === 0 ? <div className="empty">No recordings here yet.</div> : (
          <div className="grid">
            {shown.map((v) => (
              <Link key={v.id} href={`/library/${v.id}`} className="vid" data-testid="lib-item">
                <Thumb n={v.thumb}>
                  {v.summary ? <span className="ai">✦ {v.summaryMethod === 'ai' ? 'AI summary' : 'Summary'}</span> : null}
                  <span className="pl"><svg width="12" height="12" viewBox="0 0 12 12"><path d="M3 1.5l7 4.5-7 4.5z" fill="#0B1426" /></svg></span>
                  {v.duration ? <span className="dur">{v.duration}</span> : null}
                </Thumb>
                <div className="vt"><b>{v.title}</b><span>{v.speaker}</span></div>
              </Link>
            ))}
          </div>
        )}
      </main>
      <TabBar />
    </>
  );
}
