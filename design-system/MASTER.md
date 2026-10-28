# SpaceLab Design System — Master

Global source of truth for SpaceLab's look and feel. Page-specific deviations go in
`design-system/pages/<page>.md` and override this file for that page only.

Derived from the ui-ux-pro-max skill (Dark Mode (OLED) style, Space Tech / Aerospace
palette, Developer Mono font pairing), adapted to the rules in `CLAUDE.md`. The skill is
a reference, not a constraint — change anything here when the product needs it.

## Direction

- The globe is the product. UI floats over it and stays out of the way.
- Dark, quiet, precise. Think mission control at night, not a neon sci-fi HUD.
- Realistic Earth imagery; color is reserved for data (orbits, selections, alerts).
- Not an admin dashboard: no sidebar-plus-card-grid layout, no stat tiles for decoration.

## Color tokens

Define as CSS custom properties on `:root`.

| Token | Value | Use |
|---|---|---|
| `--bg` | `#0B0B10` | App background behind/around the globe |
| `--surface` | `rgba(11, 11, 16, 0.72)` | Floating panels (with backdrop blur) |
| `--surface-solid` | `#14141C` | Panels where blur is unavailable or on mobile sheets |
| `--border` | `rgba(148, 163, 184, 0.16)` | Panel edges, dividers |
| `--text` | `#F8FAFC` | Primary text |
| `--text-muted` | `#94A3B8` | Labels, secondary text (≈7.9:1 on `--bg`) |
| `--accent` | `#3B82F6` | Primary interactive elements, focus rings |
| `--accent-text` | `#60A5FA` | Accent-colored text at small sizes |
| `--highlight` | `#F59E0B` | Selected object, its orbit path and footprint |
| `--danger` | `#F87171` | Errors, close-approach warnings (asteroid monitor) |

### Data colors (orbit / object categories)

Distinguishable on dark imagery; never rely on color alone — pair with labels or legend.

| Category | Color |
|---|---|
| Space stations | `#F8FAFC` |
| Navigation (GPS, Galileo…) | `#34D399` |
| Communications | `#22D3EE` |
| Weather / Earth observation | `#A78BFA` |
| Science | `#FB7185` |
| Other / debris | `#64748B` |
| Selected (any category) | `--highlight` |

## Typography

- **UI:** IBM Plex Sans (400, 500, 600)
- **Data:** JetBrains Mono (400, 500) — coordinates, altitude, velocity, times, TLE fields,
  NORAD IDs. Use `font-variant-numeric: tabular-nums` so live values don't jitter.
- Body 14–16px desktop, minimum 16px for body text on mobile. Line height 1.5.
- Labels: 12px, uppercase, `letter-spacing: 0.06em`, `--text-muted`.
- Load from Google Fonts with `display=swap`.

## Layout

- Full-viewport globe; no page scroll.
- Desktop: compact floating panels inset 16px from edges — search/filter top-left,
  selected-object details right, time controls bottom-center.
- Mobile (≤768px): details become a bottom sheet (collapsed / half / full); search
  collapses to an icon button; keep the globe usable above the sheet.
- Z-index scale: globe 0, overlays 10, panels 20, sheets/popovers 30, modals 50.
- Hide or restyle Cesium's default widgets (timeline, animation, base layer picker,
  credits placement) to match this system — keep required attribution visible.

## Components

- **Panels:** `--surface`, `backdrop-filter: blur(12px)`, 1px `--border`, 12px radius,
  16px padding. No heavy drop shadows.
- **Buttons:** icon buttons 40px visual / 44px hit area; `--accent` for primary only.
- **Readouts:** label above value; value in mono; units in `--text-muted`.
- **Icons:** one SVG set (Lucide), 20px, `stroke-width: 1.75`. No emoji.
- **Glow:** only on the selected object's marker/orbit, subtle. Not on text or panels.

## Motion

- UI transitions 150–250ms, ease-out; animate `transform` and `opacity` only.
- Camera fly-to ~1.5s for selection. No auto-rotating globe while the user interacts.
- Respect `prefers-reduced-motion`: instant camera jumps, no decorative animation.

## Accessibility

- Text contrast ≥ 4.5:1 (target 7:1 for body text).
- Visible focus ring: 2px `--accent`, 2px offset.
- Every icon-only button has an `aria-label`; full keyboard path to search and select.
- Selected-object details are readable as text, not only shown on the globe.

## Verify before delivery

- [ ] Checked in a real browser at 375, 768, 1024 and 1440px widths
- [ ] No console errors or failed network requests (imagery, TLE data, fonts)
- [ ] Live numbers don't shift layout
- [ ] Focus states visible; reduced motion respected
- [ ] No horizontal scroll on mobile
