// In-process pub/sub used by the SSE endpoint. Works for a single Node server process.
// For multiple instances in production, swap for Redis pub/sub or Postgres LISTEN/NOTIFY.
import { EventEmitter } from 'node:events';

type G = { __keremBus?: EventEmitter; __keremPresence?: Map<string, Map<string, number>> };
const g = globalThis as unknown as G;
export const bus: EventEmitter = g.__keremBus ?? (g.__keremBus = new EventEmitter());
bus.setMaxListeners(0);

export type BusEvent = { type: string; data?: unknown };
export function publish(channel: string, type: string, data?: unknown) {
  bus.emit('msg', { channel, type, data });
}

// presence: channel -> userId -> connection count
const presence = g.__keremPresence ?? (g.__keremPresence = new Map());
export function presenceAdd(channel: string, userId: string) {
  const m = presence.get(channel) ?? new Map<string, number>();
  m.set(userId, (m.get(userId) ?? 0) + 1);
  presence.set(channel, m);
}
export function presenceRemove(channel: string, userId: string) {
  const m = presence.get(channel);
  if (!m) return;
  const n = (m.get(userId) ?? 1) - 1;
  if (n <= 0) m.delete(userId); else m.set(userId, n);
}
export function presenceCount(channel: string) {
  return presence.get(channel)?.size ?? 0;
}
export function presenceUsers(channel: string) {
  return [...(presence.get(channel)?.keys() ?? [])];
}
