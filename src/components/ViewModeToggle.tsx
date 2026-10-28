import { useRef, type KeyboardEvent } from 'react'
import type { GlobeMode } from '../globe/createGlobe'

const OPTIONS: { value: GlobeMode; label: string }[] = [
  { value: 'terrain', label: 'Terrain' },
  { value: 'borders', label: 'Borders' },
]

interface ViewModeToggleProps {
  mode: GlobeMode
  onChange: (mode: GlobeMode) => void
}

/** Segmented control for the globe rendering mode (radio group semantics). */
export function ViewModeToggle({ mode, onChange }: ViewModeToggleProps) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([])

  // Arrow keys move between options, as in a native radio group.
  const onKeyDown = (event: KeyboardEvent, index: number) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const next = (index + (event.key === 'ArrowRight' ? 1 : OPTIONS.length - 1)) % OPTIONS.length
    const option = OPTIONS[next]
    if (!option) return
    onChange(option.value)
    buttons.current[next]?.focus()
  }

  return (
    <div
      role="radiogroup"
      aria-label="Globe view"
      className="absolute top-[calc(4rem+env(safe-area-inset-top))] left-4 z-20 flex rounded-xl border border-border bg-surface p-0.5 backdrop-blur-md sm:left-6"
    >
      {OPTIONS.map((option, index) => {
        const checked = option.value === mode
        return (
          <button
            key={option.value}
            ref={(el) => {
              buttons.current[index] = el
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={`h-11 min-w-11 cursor-pointer rounded-[10px] px-4 text-sm font-medium transition-colors duration-200 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent ${
              checked ? 'bg-white/10 text-text' : 'text-text-muted hover:text-text'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
