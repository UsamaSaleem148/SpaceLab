import { useEffect, useMemo, useRef, useState } from 'react'
import type { GlobeController, GlobeMode, ImagerySource } from './globe/createGlobe'
import { ISS_NORAD_ID } from './data/orbitalElements'
import { CATEGORY_COLORS, SATELLITE_CATALOG, catalogEntry, categoryOf } from './data/satelliteCatalog'
import { useSatellitesTracking } from './hooks/useSatellitesTracking'
import { isMarkerObscured } from './lib/overlap'
import {
  addSatellite,
  removeSatellite,
  restoreTracked,
  selectSatellite,
  type TrackedList,
} from './tracking/trackedSatellites'
import { GlobeView } from './components/GlobeView'
import { Header } from './components/Header'
import { NavControls } from './components/NavControls'
import { SatellitePanel } from './components/SatellitePanel'
import { SatelliteSelector, type SatelliteOption } from './components/SatelliteSelector'
import { GlobeError, ImageryNotice, LoadingOverlay } from './components/StatusOverlays'
import { ViewModeToggle } from './components/ViewModeToggle'

const MODE_STORAGE_KEY = 'spacelab:globe-mode'
const TRACKED_STORAGE_KEY = 'spacelab:tracked'

const entityId = (noradId: number) => `satellite-${noradId}`
const noradIdOf = (id: string) => Number(id.replace('satellite-', ''))

// Per-viewer conveniences; storage may be unavailable.
function readStoredMode(): GlobeMode {
  try {
    return localStorage.getItem(MODE_STORAGE_KEY) === 'borders' ? 'borders' : 'terrain'
  } catch {
    return 'terrain'
  }
}

function readStoredTracked(): TrackedList {
  try {
    return restoreTracked(JSON.parse(localStorage.getItem(TRACKED_STORAGE_KEY) ?? 'null'))
  } catch {
    return restoreTracked(null)
  }
}

function store(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Not persisted; still works for this session.
  }
}

export default function App() {
  const [globe, setGlobe] = useState<GlobeController | null>(null)
  const [imagery, setImagery] = useState<ImagerySource | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [noticeDismissed, setNoticeDismissed] = useState(false)
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const [mode, setMode] = useState<GlobeMode>(readStoredMode)
  const [tracked, setTracked] = useState<TrackedList>(readStoredTracked)
  const { tracking, retry } = useSatellitesTracking(tracked.ids)
  const panelRef = useRef<HTMLElement>(null)
  // Set when the user picks or adds a satellite from the panel; cleared once revealed.
  const revealPending = useRef<number | null>(null)
  const rendered = useRef(new Set<number>())

  const activeId = tracked.activeId
  const active = tracking.get(activeId) ?? { status: 'loading' as const }

  // Clicking a marker makes it active; clicking empty globe only clears the highlight.
  useEffect(
    () =>
      globe?.onSelectionChange((id) => {
        setHighlightedId(id)
        if (id) setTracked((list) => selectSatellite(list, noradIdOf(id)))
      }),
    [globe],
  )

  useEffect(() => {
    globe?.setMode(mode)
    store(MODE_STORAGE_KEY, mode)
  }, [globe, mode])

  useEffect(() => store(TRACKED_STORAGE_KEY, JSON.stringify(tracked)), [tracked])

  // Push each satellite's new position to the globe; hide markers without valid data.
  useEffect(() => {
    if (!globe) return
    for (const id of rendered.current) {
      if (!tracked.ids.includes(id)) {
        globe.removeSatellite(entityId(id))
        rendered.current.delete(id)
      }
    }
    for (const id of tracked.ids) {
      const state = tracking.get(id)
      if (state?.status === 'ready') {
        globe.updateSatellite({
          id: entityId(id),
          name: state.info.name,
          color: CATEGORY_COLORS[categoryOf(id)],
          positionEcfKm: state.state.positionEcfKm,
          trailEcfKm: state.trailEcfKm,
          predictionEcfKm: state.predictionEcfKm,
        })
        rendered.current.add(id)
      } else if (rendered.current.has(id)) {
        globe.removeSatellite(entityId(id))
        rendered.current.delete(id)
      }
    }
  }, [globe, tracked.ids, tracking])

  useEffect(
    () => () => {
      for (const id of rendered.current) globe?.removeSatellite(entityId(id))
      rendered.current.clear()
    },
    [globe],
  )

  // After choosing a satellite in the panel, bring it into view if it is behind the
  // Earth, off-screen, or under the panel itself; otherwise leave the camera alone.
  useEffect(() => {
    const pending = revealPending.current
    if (!globe || pending === null || pending !== activeId) return
    if (tracking.get(pending)?.status !== 'ready') return
    revealPending.current = null
    const point = globe.screenPosition(entityId(pending))
    const panel = panelRef.current?.getBoundingClientRect()
    if (!point || (panel && isMarkerObscured(point, [panel]))) globe.focusSatellite(entityId(pending))
    else globe.selectSatellite(entityId(pending))
  }, [globe, activeId, tracking])

  const choose = (noradId: number) => {
    revealPending.current = noradId
    setTracked((list) => selectSatellite(list, noradId))
  }

  const add = (noradId: number) => {
    revealPending.current = noradId
    setTracked((list) => addSatellite(list, noradId))
  }

  const remove = (noradId: number) => {
    setTracked((list) => removeSatellite(list, noradId))
    globe?.selectSatellite(null)
  }

  const options = useMemo<SatelliteOption[]>(
    () =>
      tracked.ids.map((id) => {
        const state = tracking.get(id)
        return {
          noradId: id,
          label: state?.status === 'ready' ? state.info.name : displayName(id),
          color: CATEGORY_COLORS[categoryOf(id)],
          status: state?.status ?? 'loading',
        }
      }),
    [tracked.ids, tracking],
  )
  const suggestions = SATELLITE_CATALOG.filter((entry) => !tracked.ids.includes(entry.noradId))

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-bg">
      {/* State setters are stable, so the globe is created once per mount. */}
      <GlobeView onReady={setGlobe} onImageryReady={setImagery} onError={setError} />
      <Header />
      <ViewModeToggle mode={mode} onChange={setMode} />
      {imagery === 'offline' && !noticeDismissed && mode === 'terrain' && (
        <ImageryNotice onDismiss={() => setNoticeDismissed(true)} />
      )}
      <SatellitePanel
        ref={panelRef}
        tracking={active}
        noradId={activeId}
        fallbackName={displayName(activeId)}
        selected={highlightedId === entityId(activeId)}
        canFocus={globe !== null}
        onFocus={() => globe?.focusSatellite(entityId(activeId))}
        onRetry={() => retry(activeId)}
        selector={
          <SatelliteSelector
            options={options}
            activeId={activeId}
            suggestions={suggestions}
            removable={activeId !== ISS_NORAD_ID}
            onSelect={choose}
            onAdd={add}
            onRemove={remove}
          />
        }
      />
      <NavControls globe={globe} />
      <LoadingOverlay visible={imagery === null && error === null} />
      {error && <GlobeError message={error} />}
    </main>
  )
}

function displayName(noradId: number): string {
  return catalogEntry(noradId)?.name ?? `NORAD ${noradId}`
}
