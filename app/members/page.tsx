'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Av, Back, TabBar, Loading, DemoPill, type PU } from '@/components/ui';
import { api } from '@/lib/client';
type Mem = PU & { title: string; role: string; online: boolean; isDemo: boolean };
export default function Members() {
  const [ms, setMs] = useState<Mem[] | null>(null);
  const [q, setQ] = useState('');
  useEffect(() => { api<{ members: Mem[] }>('/api/members').then((d) => setMs(d.members)); }, []);
  const list = ms?.filter((m) => m.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <main className="page">
        <div className="top"><div className="row gap10"><Back /><div><div className="eyebrow">Kerem</div><div className="h1" style={{ marginTop: 4 }}>Members</div></div></div></div>
        <input className="field mb14" placeholder="Search members" value={q} onChange={(e) => setQ(e.target.value)} />
        {!list ? <Loading /> : <div className="card" style={{ padding: '2px 14px' }}>{list.map((m) => (
          <Link key={m.id} href={`/members/${m.id}`} className="list-row">
            <span style={{ position: 'relative' }}><Av u={m} size={38} />{m.online ? <i style={{ position: 'absolute', right: -1, bottom: -1, width: 10, height: 10, borderRadius: 5, background: 'var(--green)', border: '2px solid var(--card)' }} /> : null}</span>
            <div style={{ flex: 1 }}><div style={{ fontSize: 14.5, fontWeight: 600 }}>{m.name} <DemoPill show={m.isDemo} /></div><div className="muted" style={{ fontSize: 11.5 }}>{m.role === 'admin' ? 'Admin · ' : ''}{m.title}</div></div>
          </Link>
        ))}</div>}
      </main>
      <TabBar />
    </>
  );
}
