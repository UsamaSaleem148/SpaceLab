import { forwardRef, type ReactNode } from 'react'
import { formatAge, formatLatitude, formatLongitude, formatUtc } from '../lib/format'
import { STALE_AFTER_DAYS } from '../orbit/freshness'
import type { TrackingState } from '../tracking/satelliteState'
import { AlertIcon, CrosshairIcon, RetryIcon } from './icons'

interface SatellitePanelProps {
  tracking: TrackingState
  noradId: number
  /** Name to show before the data source supplies one. */
  fallbackName: string
  selected: boolean
  canFocus: boolean
  onFocus: () => void
  onRetry: () => void
  /** Satellite picker rendered at the top of the panel. */
  selector: ReactNode
}

/**
 * Compact details for the active satellite. Desktop: top-right card.
 * Mobile: full-width card above the bottom edge.
 */
export const SatellitePanel = forwardRef<HTMLElement, SatellitePanelProps>(function SatellitePanel(
  { tracking, noradId, fallbackName, selected, canFocus, onFocus, onRetry, selector },
  ref,
) {
  const name = tracking.status === 'ready' ? tracking.info.name : fallbackName

  return (
    <section
      ref={ref}
      aria-labelledby="satellite-panel-title"
      className={`absolute inset-x-4 bottom-[calc(2.75rem+env(safe-area-inset-bottom))] z-20 max-h-[calc(100dvh-9rem)] overflow-y-auto rounded-xl border bg-surface p-4 backdrop-blur-md transition-colors duration-200 sm:inset-x-auto sm:top-18 sm:right-6 sm:bottom-auto sm:w-80 ${
        selected ? 'border-highlight/60' : 'border-border'
      }`}
    >
      {selector}
      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <StatusLine tracking={tracking} />
          <h2 id="satellite-panel-title" className="mt-1 truncate text-base font-semibold text-text">
            {name}
          </h2>
          <p className="font-mono text-xs text-text-muted">NORAD {noradId}</p>
        </div>
        {tracking.status === 'ready' && (
          <button
            type="button"
            onClick={onFocus}
            disabled={!canFocus}
            className="flex h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-text transition-colors duration-200 hover:border-accent/60 hover:bg-accent/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default disabled:opacity-40"
          >
            <CrosshairIcon />
            Focus
          </button>
        )}
      </div>

      {tracking.status === 'ready' && <Readouts tracking={tracking} />}
      {tracking.status === 'loading' && <LoadingBody />}
      {tracking.status === 'error' && <ErrorBody message={tracking.message} onRetry={onRetry} />}
    </section>
  )
})

function StatusLine({ tracking }: { tracking: TrackingState }) {
  const [dot, text] =
    tracking.status === 'ready'
      ? tracking.freshness === 'current'
        ? ['bg-accent', 'Live position']
        : ['bg-highlight', 'Approximate position']
      : tracking.status === 'loading'
        ? ['bg-text-muted animate-pulse motion-reduce:animate-none', 'Loading']
        : ['bg-danger', 'Unavailable']
  return (
    <p className="flex items-center gap-2 text-[11px] font-medium tracking-[0.06em] text-text-muted uppercase">
      <span className={`size-1.5 rounded-full ${dot}`} aria-hidden="true" />
      {text}
    </p>
  )
}

function Readouts({ tracking }: { tracking: Extract<TrackingState, { status: 'ready' }> }) {
  const { state, info, freshness, refreshError } = tracking
  const ageMs = state.time.getTime() - info.epoch.getTime()

  return (
    <>
      <dl className="mt-4 grid grid-cols-4 gap-x-3 gap-y-3 sm:grid-cols-2">
        <Readout label="Latitude">{formatLatitude(state.latitudeDeg)}</Readout>
        <Readout label="Longitude">{formatLongitude(state.longitudeDeg)}</Readout>
        <Readout label="Altitude" unit="km">
          {state.altitudeKm.toFixed(1)}
        </Readout>
        <Readout label="Speed" unit="km/s">
          {state.speedKmS.toFixed(2)}
        </Readout>
      </dl>

      <dl className="mt-4 space-y-1 border-t border-border pt-3 text-xs">
        <div className="flex justify-between gap-3">
          <dt className="text-text-muted" title="Epoch of the orbital elements">
            Epoch
          </dt>
          <dd className="text-right font-mono whitespace-nowrap text-text tabular-nums">
            {formatUtc(info.epoch)} <span className="text-text-muted">· {formatAge(ageMs)}</span>
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-text-muted">Fetched</dt>
          <dd className="text-right font-mono whitespace-nowrap text-text tabular-nums">
            {formatUtc(info.fetchedAt)}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-text-muted">Source</dt>
          <dd className="text-right text-text">{info.provider}</dd>
        </div>
      </dl>

      {freshness === 'stale' && (
        <Warning>
          Orbital elements are more than {STALE_AFTER_DAYS} days old, so the position may be off by tens of
          kilometres.
        </Warning>
      )}
      {refreshError && <Warning>Couldn’t refresh orbital data ({refreshError}). Showing the last fetched data.</Warning>}
    </>
  )
}

function Readout({ label, unit, children }: { label: string; unit?: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium tracking-[0.06em] text-text-muted uppercase">{label}</dt>
      <dd className="mt-0.5 font-mono text-[13px] whitespace-nowrap text-text tabular-nums sm:text-sm">
        {children}
        {unit && <span className="ml-1 text-text-muted">{unit}</span>}
      </dd>
    </div>
  )
}

function Warning({ children }: { children: ReactNode }) {
  return (
    <p className="mt-3 flex gap-2 text-xs leading-relaxed text-highlight">
      <span className="mt-0.5 shrink-0">
        <AlertIcon />
      </span>
      <span>{children}</span>
    </p>
  )
}

function LoadingBody() {
  return (
    <div className="mt-4" role="status">
      <span className="sr-only">Fetching orbital data</span>
      <div className="grid grid-cols-4 gap-3 sm:grid-cols-2" aria-hidden="true">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="space-y-1.5">
            <div className="h-2.5 w-12 rounded bg-white/8" />
            <div className="h-4 w-16 animate-pulse rounded bg-white/8 motion-reduce:animate-none" />
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-text-muted">Fetching orbital data…</p>
    </div>
  )
}

function ErrorBody({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="mt-3">
      <p className="text-sm leading-relaxed text-text-muted">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 flex h-11 cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-text transition-colors duration-200 hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <RetryIcon />
        Retry
      </button>
    </div>
  )
}
