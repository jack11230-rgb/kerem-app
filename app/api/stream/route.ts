import { getUser } from '@/lib/auth';
import { ensureDb } from '@/lib/db';
import { bus, presenceAdd, presenceRemove, presenceCount, publish } from '@/lib/bus';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Server-Sent Events: GET /api/stream?ch=room:abc,event:xyz  (user:<me>, rooms and events are always included)
export async function GET(req: Request) {
  await ensureDb();
  const u = await getUser();
  if (!u) return new Response('unauthorized', { status: 401 });
  const url = new URL(req.url);
  const req_ch = (url.searchParams.get('ch') || '').split(',').map((s) => s.trim()).filter((s) => /^(room|event):[A-Za-z0-9_-]+$/.test(s));
  const channels = new Set([`user:${u.id}`, 'rooms', 'events', 'presence', ...req_ch]);
  const enc = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream({
    start(ctrl) {
      const send = (type: string, data: unknown, channel = '') => {
        try { ctrl.enqueue(enc.encode(`event: ${type}\ndata: ${JSON.stringify({ channel, data })}\n\n`)); } catch { /* closed */ }
      };
      const onMsg = (e: { channel: string; type: string; data: unknown }) => { if (channels.has(e.channel)) send(e.type, e.data, e.channel); };
      bus.on('msg', onMsg);
      const pres = ['app', ...req_ch];
      for (const c of pres) { presenceAdd(c, u.id); publish(c === 'app' ? 'presence' : c, 'presence', { channel: c, count: presenceCount(c) }); }
      send('hello', { userId: u.id, online: presenceCount('app'), counts: Object.fromEntries(pres.map((c) => [c, presenceCount(c)])) });
      const ping = setInterval(() => { try { ctrl.enqueue(enc.encode(`: ping\n\n`)); } catch { /* */ } }, 20000);
      cleanup = () => {
        clearInterval(ping);
        bus.off('msg', onMsg);
        for (const c of pres) { presenceRemove(c, u.id); publish(c === 'app' ? 'presence' : c, 'presence', { channel: c, count: presenceCount(c) }); }
      };
      req.signal.addEventListener('abort', () => { cleanup(); try { ctrl.close(); } catch { /* */ } });
    },
    cancel() { cleanup(); },
  });
  return new Response(stream, { headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache, no-transform', connection: 'keep-alive', 'x-accel-buffering': 'no' } });
}
