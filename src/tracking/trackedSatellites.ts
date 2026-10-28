import { ISS_NORAD_ID } from '../data/orbitalElements'

/** Which satellites are tracked, and which one the information panel shows. */
export interface TrackedList {
  ids: number[]
  activeId: number
}

/** Keeps the globe readable and API usage modest (one request per satellite per hour). */
export const MAX_TRACKED = 8

export const INITIAL_TRACKED: TrackedList = { ids: [ISS_NORAD_ID], activeId: ISS_NORAD_ID }

/** Adds a satellite and makes it active. Duplicates just become active; the limit is enforced. */
export function addSatellite(list: TrackedList, noradId: number): TrackedList {
  if (list.ids.includes(noradId)) return { ...list, activeId: noradId }
  if (list.ids.length >= MAX_TRACKED) return list
  return { ids: [...list.ids, noradId], activeId: noradId }
}

/** Removes a satellite. The ISS is permanent; removing the active one falls back to the ISS. */
export function removeSatellite(list: TrackedList, noradId: number): TrackedList {
  if (noradId === ISS_NORAD_ID || !list.ids.includes(noradId)) return list
  return {
    ids: list.ids.filter((id) => id !== noradId),
    activeId: list.activeId === noradId ? ISS_NORAD_ID : list.activeId,
  }
}

/** Makes a tracked satellite active; ignores untracked IDs. */
export function selectSatellite(list: TrackedList, noradId: number): TrackedList {
  return list.ids.includes(noradId) && list.activeId !== noradId ? { ...list, activeId: noradId } : list
}

/** NORAD catalog numbers are positive integers (currently up to 9 digits). */
export function parseNoradId(input: string): number | null {
  const trimmed = input.trim()
  if (!/^\d{1,9}$/.test(trimmed)) return null
  const id = Number(trimmed)
  return id > 0 ? id : null
}

/** Restores a persisted list, dropping anything invalid and always keeping the ISS first. */
export function restoreTracked(raw: unknown): TrackedList {
  if (typeof raw !== 'object' || raw === null) return INITIAL_TRACKED
  const { ids, activeId } = raw as Partial<Record<keyof TrackedList, unknown>>
  if (!Array.isArray(ids)) return INITIAL_TRACKED

  const valid = ids.filter((id): id is number => Number.isInteger(id) && (id as number) > 0)
  const unique = [ISS_NORAD_ID, ...new Set(valid.filter((id) => id !== ISS_NORAD_ID))].slice(0, MAX_TRACKED)
  return {
    ids: unique,
    activeId: typeof activeId === 'number' && unique.includes(activeId) ? activeId : ISS_NORAD_ID,
  }
}
