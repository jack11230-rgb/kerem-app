import { adminApi } from '@/lib/api';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
export const DELETE = adminApi(async (_r, { params }) => { await db.delete(schema.invites).where(eq(schema.invites.code, params.code)); return { ok: true }; });
