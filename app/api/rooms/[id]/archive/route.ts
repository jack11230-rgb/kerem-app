import { adminApi } from '@/lib/api';
import { archiveRoom } from '@/lib/scheduler';
export const POST = adminApi(async (_r, { params }) => { await archiveRoom(params.id); return { ok: true }; });
