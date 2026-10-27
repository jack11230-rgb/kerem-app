import { createClient, type Client } from '@libsql/client';
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';
import * as schema from './schema';
import { DDL } from './ddl';
import fs from 'node:fs';
import path from 'node:path';

type G = { __keremClient?: Client; __keremDb?: LibSQLDatabase<typeof schema>; __keremReady?: Promise<void> };
const g = globalThis as unknown as G;

function makeClient() {
  // `next build` imports route modules while collecting page data. On Render the persistent
  // disk (/data) is only mounted at runtime, not during the build, so never touch the real
  // database file then: use a throwaway in-memory DB for the build phase.
  if (process.env.NEXT_PHASE === 'phase-production-build') return createClient({ url: ':memory:' });
  const url = process.env.DATABASE_URL || 'file:./data/kerem.db';
  if (url.startsWith('file:')) {
    const p = url.slice(5);
    const dir = path.dirname(path.resolve(p));
    fs.mkdirSync(dir, { recursive: true });
  }
  return createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });
}

export const client: Client = g.__keremClient ?? (g.__keremClient = makeClient());
export const db = g.__keremDb ?? (g.__keremDb = drizzle(client, { schema }));

export function ensureDb() {
  if (!g.__keremReady) {
    g.__keremReady = (async () => {
      await client.execute('PRAGMA journal_mode=WAL').catch(() => {});
      await client.execute('PRAGMA busy_timeout=5000').catch(() => {});
      const stmts = DDL.split(';').map((s) => s.trim()).filter(Boolean);
      for (const s of stmts) await client.execute(s);
    })();
  }
  return g.__keremReady;
}

export { schema };
