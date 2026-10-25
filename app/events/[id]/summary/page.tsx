'use client';
import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { Back, TabBar, Loading } from '@/components/ui';
import { DiscussionSummary } from '@/components/summary';
import type { Ev } from '@/components/events';
import { api, fmtLong } from '@/lib/client';
export default function SummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [ev, setEv] = useState<Ev | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => { api<{ event: Ev }>(`/api/events/${id}`).then((r) => setEv(r.event)).catch((e) => setErr(e.message)); }, [id]);
  return (
    <>
      <main className="page">
        <div className="top"><Back /><div className="eyebrow">Discussion summary</div><div style={{ width: 38 }} /></div>
        {err ? <div className="empty">{err}</div> : !ev ? <Loading /> : (
          <>
            <div className="muted mb10" style={{ fontSize: 12.5 }}>{ev.speaker} · {fmtLong(ev.startsAt)}</div>
            {ev.summary ? <DiscussionSummary s={ev.summary} title={ev.title} /> : <div className="empty">No summary yet — it is generated when the live session ends.</div>}
            {ev.libraryItemId ? <Link href={`/library/${ev.libraryItemId}`} className="btn ghost block mt16" style={{ height: 44 }}>Open recording in Library</Link> : null}
          </>
        )}
      </main>
      <TabBar />
    </>
  );
}
