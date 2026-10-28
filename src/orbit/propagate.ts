import {
  SatRecError,
  degreesLat,
  degreesLong,
  eciToEcf,
  eciToGeodetic,
  gstime,
  json2satrec,
  propagate,
  twoline2satrec,
  type OMMJsonObject,
  type SatRec,
} from 'satellite.js'

/** Mean orbital elements in either supported format. */
export type OrbitalElements =
  | { format: 'omm'; omm: OMMJsonObject }
  | { format: 'tle'; name: string; line1: string; line2: string }

export interface Vec3 {
  x: number
  y: number
  z: number
}

/** A satellite's state at one instant, derived from SGP4. */
export interface SatelliteState {
  time: Date
  latitudeDeg: number
  longitudeDeg: number
  altitudeKm: number
  /** Inertial (TEME) speed — the conventional "orbital speed". */
  speedKmS: number
  /** Earth-centred, Earth-fixed position in kilometres, for rendering. */
  positionEcfKm: Vec3
}

export class PropagationError extends Error {
  constructor(readonly code: SatRecError) {
    super(propagationErrorMessage(code))
    this.name = 'PropagationError'
  }
}

export function satrecFromOmm(omm: OMMJsonObject): SatRec {
  return json2satrec(omm)
}

export function satrecFromElements(elements: OrbitalElements): SatRec {
  return elements.format === 'omm' ? json2satrec(elements.omm) : twoline2satrec(elements.line1, elements.line2)
}

/** Julian date to JS Date (Unix epoch is JD 2440587.5). */
export function julianToDate(jd: number): Date {
  return new Date((jd - 2440587.5) * 86_400_000)
}

/** Epoch of the orbital elements, taken from the parsed record. */
export function elementEpoch(satrec: SatRec): Date {
  return julianToDate(satrec.jdsatepoch)
}

/**
 * Propagates with SGP4 to `time`, then rotates the TEME (inertial) result into
 * the Earth-fixed frame using Greenwich sidereal time for that same instant.
 */
export function computeState(satrec: SatRec, time: Date): SatelliteState {
  const result = propagate(satrec, time)
  if (!result) throw new PropagationError(satrec.error)

  const gmst = gstime(time)
  const { position, velocity } = result
  const geodetic = eciToGeodetic(position, gmst)

  return {
    time,
    latitudeDeg: degreesLat(geodetic.latitude),
    longitudeDeg: degreesLong(geodetic.longitude),
    altitudeKm: geodetic.height,
    speedKmS: Math.hypot(velocity.x, velocity.y, velocity.z),
    positionEcfKm: eciToEcf(position, gmst),
  }
}

/**
 * Earth-fixed positions over the `durationMs` before `end`, oldest first, ending
 * at the position at `end`. Each point uses GMST at its own time, so the trail
 * follows the path the satellite actually took over the rotating Earth.
 */
export function computeTrail(satrec: SatRec, end: Date, durationMs: number, stepMs: number): Vec3[] {
  return samplePath(satrec, end.getTime() - durationMs, end.getTime(), stepMs)
}

/**
 * Predicted Earth-fixed positions from `start` to `start + durationMs`, starting
 * at the position at `start`. SGP4 forward propagation of the same elements;
 * each point uses GMST at its own (future) time.
 */
export function computePrediction(satrec: SatRec, start: Date, durationMs: number, stepMs: number): Vec3[] {
  return samplePath(satrec, start.getTime(), start.getTime() + durationMs, stepMs)
}

/** Positions every `stepMs` from `fromMs`, always including both end instants. */
function samplePath(satrec: SatRec, fromMs: number, toMs: number, stepMs: number): Vec3[] {
  const points: Vec3[] = []
  for (let t = fromMs; t < toMs; t += stepMs) {
    try {
      points.push(computeState(satrec, new Date(t)).positionEcfKm)
    } catch {
      // Skip instants SGP4 cannot propagate (e.g. elements that decay mid-path).
    }
  }
  try {
    points.push(computeState(satrec, new Date(toMs)).positionEcfKm)
  } catch {
    // As above.
  }
  return points
}

function propagationErrorMessage(code: SatRecError): string {
  switch (code) {
    case SatRecError.Decayed:
      return 'The orbit has decayed according to these elements.'
    case SatRecError.MeanEccentricityOutOfRange:
    case SatRecError.PerturbedEccentricityOutOfRange:
      return 'Orbital eccentricity is out of range.'
    case SatRecError.MeanMotionBelowZero:
      return 'Mean motion fell below zero.'
    default:
      return `SGP4 propagation failed (code ${code}).`
  }
}
