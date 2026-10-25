import { publicApi } from '@/lib/api';
import { destroySession } from '@/lib/auth';
export const POST = publicApi(async () => { await destroySession(); return { ok: true }; });
