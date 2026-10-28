import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { OrbitalDataError, REFRESH_INTERVAL_MS, loadElements } from '../data/orbitalElements'
import { elementEpoch, satrecFromElements } from '../orbit/propagate'
import { computeTracking, type LoadedElements, type TrackingState } from '../tracking/satelliteState'
import { retryDelay } from '../tracking/retry'

const TICK_MS = 1000

/**
 * Tracks several satellites. Each loads its elements independently (cached,
 * refreshed hourly), so one failing satellite never affects the others. Temporary
 * failures retry with backoff; permanent ones (unknown ID) wait for a manual retry.
 * All satellites are propagated once per second against the current UTC time.
 */
export function useSatellitesTracking(noradIds: number[]): {
  tracking: Map<number, TrackingState>
  retry: (noradId: number) => void
} {
  const [loaded, setLoaded] = useState<Map<number, LoadedElements>>(() => new Map())
  const [errors, setErrors] = useState<Map<number, string>>(() => new Map())
  const [now, setNow] = useState(() => new Date())
  const idsRef = useRef(noradIds)
  idsRef.current = noradIds
  const mounted = useRef(true)
  const requested = useRef(new Set<number>())
  const attempts = useRef(new Map<number, number>())
  const retryTimers = useRef(new Map<number, number>())

  const clearRetry = useCallback((noradId: number) => {
    window.clearTimeout(retryTimers.current.get(noradId))
    retryTimers.current.delete(noradId)
  }, [])

  const load = useCallback(
    async (noradId: number, force: boolean) => {
      clearRetry(noradId)
      try {
        const record = await loadElements(noradId, { force })
        const satrec = satrecFromElements(record.elements)
        if (!mounted.current || !idsRef.current.includes(noradId)) return
        attempts.current.delete(noradId)
        setLoaded((prev) => new Map(prev).set(noradId, { record, satrec, epoch: elementEpoch(satrec) }))
        setErrors((prev) => withoutKey(prev, noradId))
      } catch (error) {
        if (!mounted.current || !idsRef.current.includes(noradId)) return
        const message = error instanceof Error ? error.message : 'Orbital data could not be loaded.'
        setErrors((prev) => new Map(prev).set(noradId, message))

        const attempt = attempts.current.get(noradId) ?? 0
        const delay = error instanceof OrbitalDataError && error.retryable ? retryDelay(attempt) : null
        if (delay !== null) {
          attempts.current.set(noradId, attempt + 1)
          retryTimers.current.set(
            noradId,
            window.setTimeout(() => void load(noradId, false), delay),
          )
        }
      }
    },
    [clearRetry],
  )

  useEffect(() => {
    mounted.current = true
    const timers = retryTimers.current
    return () => {
      mounted.current = false
      for (const timer of timers.values()) window.clearTimeout(timer)
      timers.clear()
    }
  }, [])

  // Load only newly tracked satellites; forget everything about removed ones.
  const idsKey = noradIds.join(',')
  useEffect(() => {
    const ids = idsRef.current
    for (const id of ids) {
      if (requested.current.has(id)) continue
      requested.current.add(id)
      void load(id, false)
    }
    for (const id of [...requested.current]) {
      if (ids.includes(id)) continue
      requested.current.delete(id)
      attempts.current.delete(id)
      clearRetry(id)
    }
    setLoaded((prev) => filterKeys(prev, ids))
    setErrors((prev) => filterKeys(prev, ids))
  }, [idsKey, load, clearRetry])

  // Periodic refresh; the cache means only stale entries reach the network.
  useEffect(() => {
    const refresh = window.setInterval(() => {
      for (const id of idsRef.current) void load(id, false)
    }, REFRESH_INTERVAL_MS)
    return () => window.clearInterval(refresh)
  }, [load])

  useEffect(() => {
    const tick = window.setInterval(() => setNow(new Date()), TICK_MS)
    return () => window.clearInterval(tick)
  }, [])

  const tracking = useMemo(() => {
    const result = new Map<number, TrackingState>()
    for (const id of noradIds) result.set(id, computeTracking(id, loaded.get(id), errors.get(id), now))
    return result
    // idsKey stands in for noradIds so a new array with the same IDs does not recompute.
  }, [idsKey, loaded, errors, now])

  const retry = useCallback(
    (noradId: number) => {
      attempts.current.delete(noradId)
      setErrors((prev) => withoutKey(prev, noradId))
      void load(noradId, true)
    },
    [load],
  )

  return { tracking, retry }
}

function withoutKey<V>(map: Map<number, V>, key: number): Map<number, V> {
  if (!map.has(key)) return map
  const next = new Map(map)
  next.delete(key)
  return next
}

/** Returns the same map when nothing is removed, so React can skip the update. */
function filterKeys<V>(map: Map<number, V>, keep: number[]): Map<number, V> {
  if ([...map.keys()].every((id) => keep.includes(id))) return map
  return new Map([...map].filter(([id]) => keep.includes(id)))
}
