# Client design system

`styles.css` owns the theme. Light and dark palettes follow `prefers-color-scheme`,
so pages, portaled dialogs, native controls, and human verification share the
system preference without local theme overrides.

## Tokens

- Use semantic colors: `background`, `card`, `foreground`, `muted`,
  `muted-foreground`, `primary`, `accent`, `border`, and `destructive`.
  `live` is reserved for live-event status, not validation errors.
- Use Tailwind's spacing, typography, breakpoint, and container scales. Add
  genuinely shared layout constraints to `@theme` with a descriptive name
  (`sidebar`, `event-card`, `schedule`, `dialog`, `app`). Avoid arbitrary pixel,
  color, shadow, and tracking values in components.
- Controls share `control-xs`, `control-sm`, `control`, and `control-lg` heights.
  Matching `Button` and `Input` sizes align automatically.
- Radii derive from one base radius. Use `rounded-md` for controls,
  `rounded-lg` for inset surfaces, `rounded-xl` for panels, and `rounded-full`
  for pills and badges.

## Reusable building blocks

- `Button`: actions, with primary, outline, secondary, ghost, destructive, and
  link variants. Use size variants instead of overriding height or font size.
- `SelectionButton`: pill filters, sidebar navigation, and selectable cards.
  Pass `aria-pressed` for toggles; the selected style is shared across variants.
- `Badge`: neutral metadata, accent/upcoming, and live status.
- `Input`, `Label`, and `Field`: consistent forms and validation messages.
- `DropdownMenu`: shadcn/ui's Base UI menu composition, adapted to shared
  surface and control tokens. Radio items show exclusive selections with a
  checkmark; popup width follows its trigger and height follows available space.
- `Dialog`: shared popup surface, overlay, and viewport constraints;
  `size="wide"` supports the league picker.
- `Brand` and `AuthLayout`: shared identity and authentication page structure.
  Human verification uses the provider's compact size to fit narrow forms.

Shared CSS recipes cover repeated visual roles: `panel`, `page-padding`,
`page-title`, `section-title`, `eyebrow`, `icon-surface`, `empty-state`,
`event-grid`, `alert-error`, and `text-link`. Keep one-off layout composition in
standard Tailwind utilities, rather than duplicating a visual recipe.

Keyboard focus uses the global ring token. Motion respects
`prefers-reduced-motion`. Keep selected, error, and event states identifiable
with text or semantics as well as color.

## Responsive behavior

- The dashboard is a named `dashboard` container. Filters use a two-column grid
  on phones and wrap into a row when that container has enough room. The sidebar
  starts at `lg`; phones and tablets use a full-width league menu with badges,
  radio selection, keyboard navigation, and a scrollable popup.
- The sidebar is a size container: compact league rows use 24px icon surfaces,
  12px labels, and no inter-row gap. Height queries reduce padding on short screens;
  league and team lists expand to their full height within one shared scrollable area.
  Touch controls retain the shared coarse-pointer target size. On mobile, My Teams
  is available in an expandable section beneath the league menu.
- The team picker uses the same two-step dialog pattern as leagues. Selections are
  retained when changing leagues and saved together on Done. Favourites/All is an
  independent schedule filter, defaults to Favourites, and falls back to all teams
  when no favourites exist. Clicking a team in My Teams selects that team's events
  within the current league and period filters; clicking it again restores the
  previous Favourites/All filter. Choosing Favourites or All clears the individual
  team selection. Team rows use the shared navigation selection style, with a
  separate remove button.
- The header's league/team search opens a command picker with `Mod+K` (⌘K on
  macOS, Ctrl+K on Windows/Linux). It searches followed leagues and favourite
  teams, preserving the sidebar's independent league/team filtering behavior.
  Arrow keys navigate results, Enter applies a filter, and Escape closes the
  dialog. Active filters are labeled; choosing an active team clears it.
- The schedule panel is a `schedule` container. Event grids use the standard
  `2xl` and `5xl` container sizes for two and three columns, independent of the
  viewport or sidebar. Loading cards share the same grid and size recipes.
- Controls default to a 44px (`control`) target. `touch-target` also enlarges
  smaller variants on coarse pointers; inputs retain 16px text to avoid mobile
  focus zoom. Keep long event, team, and picker labels wrapping.
- Dialogs are `dialog` containers; grids, padding, and footers respond to their
  actual width. `mobileFullscreen` fills the dynamic viewport on narrow or short
  screens. The header and footer stay visible while the middle content scrolls.
- `safe-area` and the dialog padding recipes account for notches and home
  indicators. The viewport meta tag enables edge-to-edge layout and asks supporting
  browsers to resize the layout for the onscreen keyboard without restricting zoom.
- Auth pages use auto margins for safe centering: tall forms remain scrollable
  from the top on short screens. Prefer container queries for component layouts
  and viewport queries for application navigation and full-screen dialogs.
