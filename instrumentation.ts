export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { ensureDb } = await import('./lib/db');
    await ensureDb();
    const { ensureScheduler } = await import('./lib/scheduler');
    ensureScheduler();
  }
}
