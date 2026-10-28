import type { OMMJsonObject } from 'satellite.js'

/** Representative ISS elements (test fixture, not live data). */
export const ISS_OMM_FIXTURE: OMMJsonObject = {
  OBJECT_NAME: 'ISS (ZARYA)',
  OBJECT_ID: '1998-067A',
  EPOCH: '2026-10-27T12:00:00.000000',
  MEAN_MOTION: 15.5,
  ECCENTRICITY: 0.0006,
  INCLINATION: 51.64,
  RA_OF_ASC_NODE: 120,
  ARG_OF_PERICENTER: 80,
  MEAN_ANOMALY: 280,
  EPHEMERIS_TYPE: 0,
  CLASSIFICATION_TYPE: 'U',
  NORAD_CAT_ID: 25544,
  ELEMENT_SET_NO: 999,
  REV_AT_EPOCH: 50000,
  BSTAR: 0.0002,
  MEAN_MOTION_DOT: 0.0001,
  MEAN_MOTION_DDOT: 0,
}

/**
 * Vallado et al., "Revisiting Spacetrack Report #3" (AIAA 2006-6753), verification
 * case 00005 and its published TEME state at tsince = 0.
 */
export const VALLADO_00005 = {
  line1: '1 00005U 58002B   00179.78495062  .00000023  00000-0  28098-4 0  4753',
  line2: '2 00005  34.2682 348.7242 1859667 331.7664  19.3264 10.82419157413667',
  positionKm: { x: 7022.46529266, y: -1400.08296755, z: 0.03995155 },
  velocityKmS: { x: 1.893841015, y: 6.405893759, z: 4.53480725 },
}
