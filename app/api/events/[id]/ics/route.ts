import { userApi, HttpError } from '@/lib/api';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';

const fmt = (t: number) => new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');

export const GET = userApi(async (req, { params }) => {
  const ev = await db.query.events.findFirst({ where: eq(schema.events.id, params.id) });
  if (!ev) throw new HttpError(404, 'Event not found');
  const origin = new URL(req.url).origin;
  const end = ev.endsAt ?? ev.startsAt + 75 * 60_000;
  const loc = [ev.location, ev.onlineUrl].filter(Boolean).join(' · ');
  const mins = Number(process.env.REMINDER_MINUTES || 15);
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Kerem//Members Club//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT', `UID:${ev.id}@kerem`, `DTSTAMP:${fmt(Date.now())}`, `DTSTART:${fmt(ev.startsAt)}`, `DTEND:${fmt(end)}`,
    `SUMMARY:${esc(ev.title)} — ${esc(ev.speaker)}`, `DESCRIPTION:${esc((ev.description || '') + `\n\n${origin}/events/${ev.id}`)}`,
    `LOCATION:${esc(loc)}`, `URL:${origin}/events/${ev.id}`,
    'BEGIN:VALARM', `TRIGGER:-PT${mins}M`, 'ACTION:DISPLAY', `DESCRIPTION:${esc(ev.title)} starts in ${mins} min`, 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR', '',
  ].join('\r\n');
  const slug = ev.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
  return new Response(ics, { headers: { 'content-type': 'text/calendar; charset=utf-8', 'content-disposition': `attachment; filename="kerem-${slug}.ics"` } });
});
