import { ISS_NORAD_ID } from './orbitalElements'

/** Categories from design-system/MASTER.md "Data colors". */
export type SatelliteCategory = 'station' | 'navigation' | 'communications' | 'earth-observation' | 'science' | 'other'

export interface CatalogEntry {
  noradId: number
  /** Display name until the data source supplies its own. */
  name: string
  category: SatelliteCategory
}

/**
 * Suggested satellites: identifiers and labels only. Orbital elements are always
 * fetched live; nothing here is used to position a satellite.
 */
export const SATELLITE_CATALOG: CatalogEntry[] = [
  { noradId: ISS_NORAD_ID, name: 'ISS (ZARYA)', category: 'station' },
  { noradId: 48274, name: 'CSS (Tianhe)', category: 'station' },
  { noradId: 20580, name: 'Hubble Space Telescope', category: 'science' },
  { noradId: 49260, name: 'Landsat 9', category: 'earth-observation' },
  { noradId: 39084, name: 'Landsat 8', category: 'earth-observation' },
  { noradId: 43013, name: 'NOAA 20 (JPSS-1)', category: 'earth-observation' },
]

export const CATEGORY_COLORS: Record<SatelliteCategory, string> = {
  station: '#F8FAFC',
  navigation: '#34D399',
  communications: '#22D3EE',
  'earth-observation': '#A78BFA',
  science: '#FB7185',
  other: '#94A3B8',
}

export function catalogEntry(noradId: number): CatalogEntry | undefined {
  return SATELLITE_CATALOG.find((entry) => entry.noradId === noradId)
}

export function categoryOf(noradId: number): SatelliteCategory {
  return catalogEntry(noradId)?.category ?? 'other'
}
