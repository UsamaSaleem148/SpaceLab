import { useEffect, useState } from 'react'

/** Current UTC time — the same clock that drives the globe's sunlight. */
export function UtcClock() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const iso = now.toISOString()
  return (
    <time dateTime={iso} className="flex items-baseline gap-2 font-mono tabular-nums">
      <span className="hidden text-text-muted sm:inline">{iso.slice(0, 10)}</span>
      <span className="text-sm text-text">{iso.slice(11, 19)}</span>
      <span className="text-[11px] font-medium tracking-[0.06em] text-text-muted">UTC</span>
    </time>
  )
}
