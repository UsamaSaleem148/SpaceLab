/**
 * Backoff for temporary orbital-data failures: 30 s, 2 min, 10 min, then give
 * up and leave it to the hourly refresh (or a manual retry).
 */
export const RETRY_DELAYS_MS = [30_000, 120_000, 600_000] as const

/** Delay before retry number `attempt` (0-based), or null when retries are exhausted. */
export function retryDelay(attempt: number): number | null {
  return RETRY_DELAYS_MS[attempt] ?? null
}
