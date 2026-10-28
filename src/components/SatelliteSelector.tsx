import { useId, useState, type FormEvent } from 'react'
import { CATEGORY_COLORS, type CatalogEntry } from '../data/satelliteCatalog'
import { MAX_TRACKED, parseNoradId } from '../tracking/trackedSatellites'
import { ChevronDownIcon, CloseIcon, PlusIcon, TrashIcon } from './icons'

export interface SatelliteOption {
  noradId: number
  label: string
  color: string
  status: 'loading' | 'error' | 'ready'
}

interface SatelliteSelectorProps {
  options: SatelliteOption[]
  activeId: number
  /** Satellites the user can add with one click (catalog entries not yet tracked). */
  suggestions: CatalogEntry[]
  removable: boolean
  onSelect: (noradId: number) => void
  onAdd: (noradId: number) => void
  onRemove: (noradId: number) => void
}

const iconButton =
  'grid size-11 shrink-0 cursor-pointer place-items-center rounded-lg border border-border text-text-muted transition-colors duration-200 hover:bg-white/5 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

/** Tracked-satellite picker with add and remove actions. */
export function SatelliteSelector({
  options,
  activeId,
  suggestions,
  removable,
  onSelect,
  onAdd,
  onRemove,
}: SatelliteSelectorProps) {
  const [adding, setAdding] = useState(false)
  const selectId = useId()
  const active = options.find((o) => o.noradId === activeId)
  const full = options.length >= MAX_TRACKED

  return (
    <div className="border-b border-border pb-3">
      <label htmlFor={selectId} className="sr-only">
        Tracked satellite
      </label>
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-2 -translate-y-1/2 rounded-full"
            style={{ backgroundColor: active?.color }}
          />
          <select
            id={selectId}
            value={activeId}
            onChange={(event) => onSelect(Number(event.target.value))}
            className="h-11 w-full cursor-pointer appearance-none truncate rounded-lg border border-border bg-white/5 pr-9 pl-7 text-sm font-medium text-text transition-colors duration-200 hover:bg-white/8 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {options.map((option) => (
              <option key={option.noradId} value={option.noradId} className="bg-surface-solid text-text">
                {option.label}
                {option.status === 'loading' ? ' — loading' : option.status === 'error' ? ' — unavailable' : ''}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-text-muted">
            <ChevronDownIcon />
          </span>
        </div>
        <button
          type="button"
          className={iconButton}
          aria-label={adding ? 'Close add satellite' : 'Add satellite'}
          aria-expanded={adding}
          title={adding ? 'Close' : 'Add satellite'}
          onClick={() => setAdding((open) => !open)}
        >
          {adding ? <CloseIcon /> : <PlusIcon />}
        </button>
        {removable && (
          <button
            type="button"
            className={iconButton}
            aria-label={`Stop tracking ${active?.label ?? 'satellite'}`}
            title="Stop tracking"
            onClick={() => onRemove(activeId)}
          >
            <TrashIcon />
          </button>
        )}
      </div>

      {adding && (
        <AddSatellite
          suggestions={suggestions}
          full={full}
          onAdd={(id) => {
            onAdd(id)
            setAdding(false)
          }}
        />
      )}
    </div>
  )
}

function AddSatellite({
  suggestions,
  full,
  onAdd,
}: {
  suggestions: CatalogEntry[]
  full: boolean
  onAdd: (noradId: number) => void
}) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const inputId = useId()
  const errorId = useId()

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const id = parseNoradId(value)
    if (id === null) {
      setError('Enter a NORAD catalog number, e.g. 20580.')
      return
    }
    onAdd(id)
  }

  if (full) {
    return (
      <p className="mt-3 text-xs leading-relaxed text-text-muted">
        Tracking the maximum of {MAX_TRACKED} satellites. Remove one to add another.
      </p>
    )
  }

  return (
    <div className="mt-3 space-y-3">
      {suggestions.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Suggested satellites">
          {suggestions.map((entry) => (
            <li key={entry.noradId}>
              <button
                type="button"
                onClick={() => onAdd(entry.noradId)}
                className="flex h-9 cursor-pointer items-center gap-2 rounded-full border border-border px-3 text-xs font-medium text-text transition-colors duration-200 hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <span
                  aria-hidden="true"
                  className="size-1.5 rounded-full"
                  style={{ backgroundColor: CATEGORY_COLORS[entry.category] }}
                />
                {entry.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={submit} className="flex gap-2" noValidate>
        <label htmlFor={inputId} className="sr-only">
          NORAD catalog number
        </label>
        <input
          id={inputId}
          inputMode="numeric"
          autoComplete="off"
          placeholder="NORAD ID"
          value={value}
          onChange={(event) => {
            setValue(event.target.value)
            setError(null)
          }}
          aria-invalid={error !== null}
          aria-describedby={error ? errorId : undefined}
          className="h-11 min-w-0 flex-1 rounded-lg border border-border bg-white/5 px-3 font-mono text-sm text-text placeholder:text-text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
        <button
          type="submit"
          className="h-11 shrink-0 cursor-pointer rounded-lg border border-border px-4 text-sm font-medium text-text transition-colors duration-200 hover:border-accent/60 hover:bg-accent/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Add
        </button>
      </form>
      {error && (
        <p id={errorId} role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
