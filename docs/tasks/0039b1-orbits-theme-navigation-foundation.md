# Task 0039 Phase B.1 — Orbits theme and navigation foundation

## Root cause and goal

The approved Orbits raster direction existed only in design documentation, while
mobile production had neither density-root assets, semantic theme tokens nor an
accessible presentation component. Phase B.1 adds that reusable foundation
without pretending that the approved five-item information architecture maps to
the application's current four routes.

## Production assets

The following byte-identical exports were copied from
`docs/design/raster-source/orbits/navigation/exports/` to
`apps/mobile/assets/orbits/navigation/`: `orbits-today.png`,
`orbits-today@2x.png`, `orbits-today@3x.png`, `orbits-plan.png`,
`orbits-plan@2x.png`, `orbits-plan@3x.png`, `orbits-add.png`,
`orbits-add@2x.png`, `orbits-add@3x.png`, `orbits-progress.png`,
`orbits-progress@2x.png`, `orbits-progress@3x.png`, `orbits-profile.png`,
`orbits-profile@2x.png` and `orbits-profile@3x.png`.

The typed registry statically requires only each base 1× file. Metro remains
responsible for selecting its adjacent `@2x` or `@3x` sibling. Masters and the
rejected SVG prototypes are not production dependencies.

## Language and information architecture

| Visible item | Internal contract |
|---|---|
| Сегодня | `today` destination |
| План | `plan` destination |
| Добавить | action (`onAdd`), never a destination |
| Успех | `progress` destination and asset filename |
| Профиль | `profile` destination |

The application still exposes `today` (Сегодня), `inbox` (Мысли), `focus` and
`settings`. Those routes do not truthfully map one-to-one to the approved
contract. Therefore the Orbits bar is not installed in Expo Router, no route is
renamed or invented, and the existing global capture remains unchanged. Router
integration requires a separate product/route decision.

## Theme foundation

`OrbitsThemeName` is `warm | gray | dark`; warm is the default. Backgrounds are
warm `#FCF9F6`, gray candidate `#8B8E96`, and dark candidate `#211D2E`.
Semantic roles cover primary/secondary text, navigation labels, active surface
and border, brand/default and pressed purple, subtle border and restrained
shadow. Gray uses dark `#17151D` navigation text rather than white; dark uses
white for every label. A pure WCAG contrast helper supports focused source-level
checks. Gray and dark remain candidates pending physical-device review.

`OrbitsThemeProvider` accepts an explicit name or resolved token override and
`useOrbitsTheme` resolves it. There is deliberately no selector, persistence,
system-appearance binding, authentication/navigation coupling or API boundary.

## Component API and accessibility

`OrbitsNavigation` accepts `activeDestination`, `onSelect`, `onAdd`, an optional
theme name/resolved tokens, and optional Add disabled/busy flags. It uses a
flex-based five-item layout, 44-unit destination art, 64-unit raised Add art and
targets of at least 44×44. All five words remain scalable React Native text.

PNG art is decorative and hidden from assistive technology. Destination tabs
have Russian labels and selected state; exactly one destination is selected.
The active destination also receives a compact bordered rounded surface and
stronger label weight, so color is not the only cue. Add is an accessible button
with disabled/busy state and never selected semantics. There is no router,
network, animation, haptic or sound behavior in the component.

## Evidence and remaining gaps

Focused tests cover registry keys/static density roots, exact backgrounds,
default/override behavior, contrast, permanent language/order and internal
mapping, artwork, selection/non-color cues, Add behavior, accessibility,
theme surfaces, logical sizes and stable meaning after rerender. The full mobile
Jest suite, TypeScript, SHA-256 comparison and diff checks are run for the task.

This is source-level and Jest evidence only. The app still uses its current
four-route navigation and the Orbits bar is not active at runtime. Android/iOS
physical-device rendering, text scaling, screen-reader operation and final
gray/dark approval remain unverified. There is no theme-selection UI or
persistence. Today redesign remains Phase B.2. Calm words-only mode, paid packs,
entitlement and billing remain deferred. Phase B and Task 0039 are not complete.
