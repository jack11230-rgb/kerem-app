import { NextResponse } from 'next/server';
import { getUser, type SessionUser } from './auth';
import { ensureDb } from './db';
import { ensureScheduler } from './scheduler';

export class HttpError extends Error { constructor(public status: number, msg: string) { super(msg); } }
export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });

type Ctx = { params: Promise<Record<string, string>> };
type Fn<U> = (req: Request, ctx: { params: Record<string, string> }, user: U) => Promise<Response | unknown>;

function wrap<U>(auth: 'none' | 'user' | 'admin', fn: Fn<U>) {
  return async (req: Request, ctx: Ctx) => {
    try {
      await ensureDb();
      ensureScheduler();
      const user = await getUser();
      if (auth !== 'none' && !user) throw new HttpError(401, 'Please sign in');
      if (auth === 'admin' && user?.role !== 'admin') throw new HttpError(403, 'Admins only');
      const params = ctx?.params ? await ctx.params : {};
      const out = await fn(req, { params }, user as U);
      if (out instanceof Response) return out;
      return json(out ?? { ok: true });
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      console.error('[api]', e);
      return json({ error: 'Something went wrong' }, 500);
    }
  };
}
export const publicApi = (fn: Fn<SessionUser | null>) => wrap<SessionUser | null>('none', fn);
export const userApi = (fn: Fn<SessionUser>) => wrap<SessionUser>('user', fn);
export const adminApi = (fn: Fn<SessionUser>) => wrap<SessionUser>('admin', fn);

export async function body<T = Record<string, unknown>>(req: Request): Promise<T> {
  try { return (await req.json()) as T; } catch { return {} as T; }
}
export function str(v: unknown, max = 5000) {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}
