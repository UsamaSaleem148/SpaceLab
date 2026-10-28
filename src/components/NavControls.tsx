import type { ReactNode } from 'react'
import type { GlobeController } from '../globe/createGlobe'
import { GlobeIcon, MinusIcon, PlusIcon } from './icons'

/** Zoom and reset buttons — a keyboard/touch alternative to mouse gestures. */
export function NavControls({ globe }: { globe: GlobeController | null }) {
  return (
    <nav
      aria-label="Globe camera"
      // Mobile: top-right, clear of the satellite panel at the bottom. Desktop: bottom-right.
      className="absolute top-[calc(4rem+env(safe-area-inset-top))] right-4 z-20 flex flex-col gap-2 sm:top-auto sm:right-6 sm:bottom-12"
    >
      <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface backdrop-blur-md">
        <ControlButton label="Zoom in" onClick={() => globe?.zoomIn()} disabled={!globe}>
          <PlusIcon />
        </ControlButton>
        <div className="h-px bg-border" />
        <ControlButton label="Zoom out" onClick={() => globe?.zoomOut()} disabled={!globe}>
          <MinusIcon />
        </ControlButton>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-surface backdrop-blur-md">
        <ControlButton label="Reset view" onClick={() => globe?.resetView()} disabled={!globe}>
          <GlobeIcon />
        </ControlButton>
      </div>
    </nav>
  )
}

interface ControlButtonProps {
  label: string
  onClick: () => void
  disabled: boolean
  children: ReactNode
}

function ControlButton({ label, onClick, disabled, children }: ControlButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="grid size-11 cursor-pointer place-items-center text-text-muted transition-colors duration-200 hover:bg-white/5 hover:text-text focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent disabled:cursor-default disabled:opacity-40"
    >
      {children}
    </button>
  )
}
