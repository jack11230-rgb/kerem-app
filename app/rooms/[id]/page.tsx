'use client';
import { use, useEffect, useState } from 'react';
import { Back, Stack, TabBar, type PU } from '@/components/ui';
import { Composer, MessageList, useAutoScroll, useRoom, type M } from '@/components/chat';
import { useMe, useToast } from '@/components/Providers';
import { api } from '@/lib/client';

type Room = { id: string; title: string; topic: string; status: string; kind: string };
export default function SideRoom({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { me } = useMe();
  const toast = useToast();
  const [room, setRoom] = useState<Room | null>(null);
  const [err, setErr] = useState('');
  const r = useRoom(id);
  const { ref, onScroll } = useAutoScroll(r.msgs.length + r.checking.size);
  useEffect(() => {
    api<{ room: Room; members: PU[]; messages: M[] }>(`/api/rooms/${id}`).then((d) => { setRoom(d.room); r.setMembers(d.members); r.setMsgs(d.messages); }).catch((e) => setErr(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  const members = r.members ?? [];
  const joined = members.some((u) => u.id === me?.id);
  const archived = room?.status === 'archived';
  const join = async () => { try { const x = await api<{ members: PU[] }>(`/api/rooms/${id}/join`, { body: {} }); r.setMembers(x.members); } catch (e) { toast((e as Error).message, 'err'); } };
  const archive = async () => { await api(`/api/rooms/${id}/archive`, { body: {} }); setRoom(room ? { ...room, status: 'archived' } : room); toast('Room archived · recap posted to the Hall'); };
  if (err) return <main className="page"><Back href="/rooms" /><div className="empty mt16">{err}</div></main>;
  return (
    <div className="chatwrap">
      <div className="chathead">
        <Back href="/rooms" />
        <div style={{ flex: 1, minWidth: 0 }}><div className="t">{room?.title ?? ' '}</div><div className="s">{archived ? 'Archived side room' : "Side room · from Members' Hall"}</div></div>
        <div className="row gap6"><Stack users={members} /><span style={{ fontSize: 11.5, color: joined ? 'var(--gold2)' : 'var(--muted)' }} data-testid="member-count">{members.length}</span></div>
      </div>
      <div className="chatview" ref={ref} onScroll={onScroll}>
        <MessageList msgs={r.msgs} checking={r.checking} />
        {!joined && !archived && room ? <div style={{ padding: '0 16px 12px' }}><button className="btn gold block" onClick={join} data-testid="join-room">Join this room</button></div> : null}
        {me?.role === 'admin' && !archived && room ? <div style={{ padding: '0 16px 16px', textAlign: 'center' }}><button className="btn ghost sm" onClick={archive}>Archive now & post recap</button></div> : null}
      </div>
      {archived ? <div className="sys" style={{ margin: '8px 16px 0' }}>This room is archived. Posting a message will reopen it.</div> : null}
      <Composer roomId={id} placeholder="Add your two cents…" onSent={(m) => { r.setMsgs((xs) => (xs.some((x) => x.id === m.id) ? xs : [...xs, m])); if (archived && room) setRoom({ ...room, status: 'active' }); }} />
      <TabBar />
    </div>
  );
}
