import { UtcClock } from './UtcClock'

/**
 * Live UTC clock, top-right. The site header with the H1 is static HTML in
 * index.html; this sits in the same row so the two read as one bar.
 */
export function ClockBar() {
  return (
    <div className="pointer-events-none fixed top-0 right-0 z-20 pt-[env(safe-area-inset-top)] [text-shadow:0_1px_8px_rgb(11_11_16/0.8)]">
      <div className="flex min-h-14 items-center px-4 sm:min-h-16 sm:px-6">
        <div className="pointer-events-auto">
          <UtcClock />
        </div>
      </div>
    </div>
  )
}
