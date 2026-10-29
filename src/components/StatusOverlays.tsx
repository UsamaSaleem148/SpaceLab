import { CloseIcon, InfoIcon } from './icons'

/**
 * Veil over the globe until it has imagery, then faded out. It sits below the
 * static header/footer and the panels (z-10 < z-20), so page content stays visible.
 */
export function LoadingOverlay({ visible }: { visible: boolean }) {
  return (
    <div
      aria-hidden={!visible}
      className={`pointer-events-none absolute inset-0 z-10 grid place-items-center bg-bg transition-opacity duration-700 motion-reduce:transition-none ${visible ? 'opacity-100' : 'opacity-0'}`}
    >
      <div role="status" className="flex flex-col items-center gap-3">
        <span className="size-2 animate-pulse rounded-full bg-accent motion-reduce:animate-none" />
        <span className="text-xs font-medium tracking-[0.06em] text-text-muted uppercase">
          Loading Earth
        </span>
      </div>
    </div>
  )
}

/** Explains why imagery is low-resolution when no Cesium ion token is configured. */
export function ImageryNotice({ onDismiss }: { onDismiss: () => void }) {
  return (
    // Sits below the view toggle.
    <div className="absolute top-[calc(7.25rem+env(safe-area-inset-top))] left-4 z-20 max-w-[calc(100%-2rem)] sm:left-6 sm:max-w-sm">
      <div className="flex items-start gap-2 rounded-lg border border-border bg-surface py-2 pr-1 pl-3 text-xs leading-relaxed text-text-muted backdrop-blur-md">
        <span className="mt-0.5 shrink-0 text-accent-text">
          <InfoIcon />
        </span>
        <p className="py-0.5">
          Showing bundled low-resolution imagery. Add <code className="font-mono text-text">VITE_CESIUM_ION_TOKEN</code>{' '}
          to <code className="font-mono text-text">.env.local</code> for high-resolution Earth.
        </p>
        <button
          type="button"
          aria-label="Dismiss notice"
          onClick={onDismiss}
          className="-my-1 grid size-8 shrink-0 cursor-pointer place-items-center rounded-md text-text-muted transition-colors duration-200 hover:bg-white/5 hover:text-text focus-visible:outline-2 focus-visible:outline-accent"
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  )
}

export function GlobeError({ message }: { message: string }) {
  return (
    <div role="alert" className="absolute inset-0 z-40 grid place-items-center bg-bg p-6">
      <div className="max-w-sm rounded-xl border border-border bg-surface-solid p-5 text-center">
        <p className="font-medium text-text">Globe unavailable</p>
        <p className="mt-2 text-sm leading-relaxed text-text-muted">{message}</p>
      </div>
    </div>
  )
}
