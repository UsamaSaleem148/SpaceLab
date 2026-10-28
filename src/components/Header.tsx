import { UtcClock } from './UtcClock'

export function Header() {
  return (
    // The gradient lets the header read clearly without boxing in the globe,
    // including over bright imagery when zoomed in.
    <header className="pointer-events-none absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-bg/90 via-bg/60 to-transparent pt-[env(safe-area-inset-top)] pb-6 [text-shadow:0_1px_8px_rgb(11_11_16/0.8)]">
      <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
        <a
          href="/"
          className="pointer-events-auto flex items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          aria-label="SpaceLab home"
        >
          <LogoMark />
          <span className="text-[17px] font-semibold tracking-tight text-text">
            Space<span className="font-normal text-text-muted">Lab</span>
          </span>
        </a>
        <div className="pointer-events-auto">
          <UtcClock />
        </div>
      </div>
    </header>
  )
}

function LogoMark() {
  return (
    <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="6" fill="var(--color-accent)" />
      <ellipse
        cx="16"
        cy="16"
        rx="13"
        ry="5.5"
        fill="none"
        stroke="var(--color-text)"
        strokeOpacity="0.85"
        strokeWidth="1.5"
        transform="rotate(-25 16 16)"
      />
      <circle cx="27.3" cy="11.2" r="1.9" fill="var(--color-highlight)" />
    </svg>
  )
}
