/**
 * How usable a set of orbital elements is, given its age. LEO elements degrade
 * quickly — the ISS also reboosts — so position error grows by roughly a few
 * kilometres per day after the epoch.
 */
export type ElementFreshness = 'current' | 'stale' | 'expired'

const DAY_MS = 86_400_000
export const STALE_AFTER_DAYS = 3
export const EXPIRED_AFTER_DAYS = 14

export function elementAgeDays(epoch: Date, now: Date): number {
  return (now.getTime() - epoch.getTime()) / DAY_MS
}

export function classifyFreshness(epoch: Date, now: Date): ElementFreshness {
  const age = Math.abs(elementAgeDays(epoch, now))
  if (age > EXPIRED_AFTER_DAYS) return 'expired'
  if (age > STALE_AFTER_DAYS) return 'stale'
  return 'current'
}
