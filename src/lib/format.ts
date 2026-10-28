export function formatLatitude(deg: number): string {
  return `${Math.abs(deg).toFixed(2)}° ${deg >= 0 ? 'N' : 'S'}`
}

export function formatLongitude(deg: number): string {
  return `${Math.abs(deg).toFixed(2)}° ${deg >= 0 ? 'E' : 'W'}`
}

/** "2026-10-28 09:12 UTC" */
export function formatUtc(date: Date): string {
  const iso = date.toISOString()
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`
}

/** Compact age such as "45 min", "6.2 h" or "3.1 d". */
export function formatAge(ms: number): string {
  const minutes = Math.max(0, ms) / 60_000
  if (minutes < 60) return `${Math.round(minutes)} min`
  const hours = minutes / 60
  if (hours < 48) return `${hours.toFixed(1)} h`
  return `${(hours / 24).toFixed(1)} d`
}
