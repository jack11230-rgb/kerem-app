import { publicApi, HttpError } from '@/lib/api';
import { runJobs } from '@/lib/scheduler';
// For hosts without a long-running process: call GET /api/cron?key=$CRON_SECRET every minute.
export const GET = publicApi(async (req) => {
  const key = new URL(req.url).searchParams.get('key');
  if (process.env.CRON_SECRET && key !== process.env.CRON_SECRET) throw new HttpError(401, 'bad key');
  await runJobs();
  return { ok: true };
});
