import type { SatRec } from 'satellite.js'
import type { ElementsProvider, ElementsRecord } from '../data/orbitalElements'
import { classifyFreshness, type ElementFreshness } from '../orbit/freshness'
import { computePrediction, computeState, computeTrail, type SatelliteState, type Vec3 } from '../orbit/propagate'

export interface SatelliteInfo {
  name: string
  noradId: number
  epoch: Date
  fetchedAt: Date
  provider: ElementsProvider
}

export type TrackingState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready'
      info: SatelliteInfo
      state: SatelliteState
      /** Earth-fixed positions over the last TRAIL_DURATION_MS, oldest first. */
      trailEcfKm: Vec3[]
      /** SGP4-predicted Earth-fixed positions over the next PREDICTION_DURATION_MS. */
      predictionEcfKm: Vec3[]
      freshness: ElementFreshness
      /** A refresh failed; the data shown is from the last successful fetch. */
      refreshError?: string
    }

export interface LoadedElements {
  record: ElementsRecord
  satrec: SatRec
  epoch: Date
}

// About half a LEO orbit behind, and just under one orbit (~90 min) ahead.
export const TRAIL_DURATION_MS = 45 * 60_000
export const PREDICTION_DURATION_MS = 90 * 60_000
export const PATH_STEP_MS = 30_000

/** Derives one satellite's display state at `now` from its loaded elements (or load error). */
export function computeTracking(
  noradId: number,
  loaded: LoadedElements | undefined,
  loadError: string | undefined,
  now: Date,
): TrackingState {
  if (!loaded) return loadError ? { status: 'error', message: loadError } : { status: 'loading' }

  const freshness = classifyFreshness(loaded.epoch, now)
  if (freshness === 'expired') {
    return {
      status: 'error',
      message: 'The latest orbital elements are too old to position this satellite reliably.',
    }
  }

  try {
    return {
      status: 'ready',
      info: {
        name: loaded.record.name,
        noradId,
        epoch: loaded.epoch,
        fetchedAt: loaded.record.fetchedAt,
        provider: loaded.record.provider,
      },
      state: computeState(loaded.satrec, now),
      trailEcfKm: computeTrail(loaded.satrec, now, TRAIL_DURATION_MS, PATH_STEP_MS),
      predictionEcfKm: computePrediction(loaded.satrec, now, PREDICTION_DURATION_MS, PATH_STEP_MS),
      freshness,
      refreshError: loaded.record.refreshError ?? loadError,
    }
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? error.message : 'Propagation failed.' }
  }
}
