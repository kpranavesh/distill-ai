/**
 * In-memory store for one-time stream tokens. TTL 2 minutes.
 * For multi-instance deployments, replace with Redis or similar.
 */
const streamStore = new Map<string, { text: string; createdAt: number }>();
const TTL_MS = 2 * 60 * 1000;

export function setStreamToken(token: string, text: string): void {
  streamStore.set(token, { text, createdAt: Date.now() });
}

export function getAndDeleteStreamToken(token: string): string | null {
  const entry = streamStore.get(token);
  streamStore.delete(token);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > TTL_MS) return null;
  return entry.text;
}
