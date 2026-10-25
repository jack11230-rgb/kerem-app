'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Icon, Logo, TabBar } from '@/components/ui';
import { Composer, MessageList, useAutoScroll, useRoom, type M } from '@/components/chat';
import { useMe, useStream } from '@/components/Providers';
import { api } from '@/lib/client';

export default function Hall() {
  const { online } = useMe();
  const [total, setTotal] = useState(0);
  const [roomsActive, setRoomsActive] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const r = useRoom('hall');
  const { ref, onScroll } = useAutoScroll(r.msgs.length + r.checking.size + r.msgs.filter((m) => m.factCheck).length);
  const loadRooms = useCallback(() => api<{ counts: { active: number } }>('/api/rooms?filter=active').then((x) => setRoomsActive(x.counts.active)).catch(() => {}), []);
  useEffect(() => {
    api<{ messages: M[]; totalMembers: number }>('/api/rooms/hall').then((d) => { r.setMsgs(d.messages); setTotal(d.totalMembers); setLoaded(true); });
    loadRooms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useStream([], (t, _d, ch) => { if (ch === 'rooms') { loadRooms(); api<{ messages: M[] }>('/api/rooms/hall').then((d) => r.setMsgs(d.messages)); } });
  const hot = r.heat && r.heat.score >= 0.4;
  return (
    <div className="chatwrap">
      <div className="chathead">
        <Logo s={36} />
        <div style={{ flex: 1, minWidth: 0 }}><div className="t">Members' Hall</div><div className="s">{total} members · {online} online</div></div>
        {hot ? <div className="heat" data-testid="heat" title={r.heat?.reasons.join(', ')}>🔥 Heating up</div> : null}
        <Link href="/rooms" className="iconbtn" aria-label="Side rooms" data-testid="rooms-link"><Icon k="rooms" s={19} />{roomsActive ? <span className="badge-n">{roomsActive}</span> : null}</Link>
      </div>
      <div className="chatview" ref={ref} onScroll={onScroll}>
        {loaded && r.msgs.length === 0 ? <div className="empty" style={{ margin: 16 }}>The Hall is quiet. Say shalom 👋</div> : null}
        <MessageList msgs={r.msgs} checking={r.checking} />
      </div>
      <Composer roomId="hall" placeholder="Message the Hall…" onSent={(m) => r.setMsgs((xs) => (xs.some((x) => x.id === m.id) ? xs : [...xs, m]))} />
      <TabBar />
    </div>
  );
}
