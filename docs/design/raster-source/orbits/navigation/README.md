# Approved Orbits raster navigation assets

Phase A.3 records five independent transparent PNG masters as the canonical
raster source for the approved Orbits navigation direction. The preview and
density exports are documentation candidates, not evidence that the mobile
application already uses these assets.

## Canonical masters

| Master | Meaning | Approved visual cue |
| --- | --- | --- |
| `masters/orbits-today-master.png` | Сегодня | Purple orbit, prominent yellow spark and orbit dot |
| `masters/orbits-plan-master.png` | План | Purple calendar/grid with turquoise orbit |
| `masters/orbits-add-master.png` | Добавить | Purple plus inside a broken orbit with turquoise dot |
| `masters/orbits-progress-master.png` | Успех | Rising purple arc, yellow spark and turquoise dot |
| `masters/orbits-profile-master.png` | Профиль | Neutral purple person silhouette with orbit and turquoise dot |

Masters are `1254×1254` RGBA source files. Preserve their bytes, transparency,
aspect ratio, colors and full artwork bounds. Do not use a master directly at
full resolution in the app, stretch it non-uniformly, bake in a label or UI
state, or treat it as a complete navigation component.

## Deterministic density exports

| Meaning | Logical size | 1× | 2× | 3× |
| --- | ---: | --- | --- | --- |
| Сегодня | 44 | `exports/orbits-today.png` (44×44) | `exports/orbits-today@2x.png` (88×88) | `exports/orbits-today@3x.png` (132×132) |
| План | 44 | `exports/orbits-plan.png` (44×44) | `exports/orbits-plan@2x.png` (88×88) | `exports/orbits-plan@3x.png` (132×132) |
| Добавить | 64 | `exports/orbits-add.png` (64×64) | `exports/orbits-add@2x.png` (128×128) | `exports/orbits-add@3x.png` (192×192) |
| Успех | 44 | `exports/orbits-progress.png` (44×44) | `exports/orbits-progress@2x.png` (88×88) | `exports/orbits-progress@3x.png` (132×132) |
| Профиль | 44 | `exports/orbits-profile.png` (44×44) | `exports/orbits-profile@2x.png` (88×88) | `exports/orbits-profile@3x.png` (132×132) |

Density selection changes pixel density, never the logical layout size. Normal
navigation artwork is displayed at logical size `44`; the raised Add artwork is
displayed at logical size `64`.

## UI and accessibility ownership

Labels remain real UI text and never belong inside icon images. The UI container
owns active backgrounds, pressed treatment, disabled opacity, shadows, selected
semantics and touch targets. Visual artwork may be smaller than its interactive
container, but the touch-target intent remains at least approximately `44×44`.
Navigation meaning must be conveyed by visible words and non-color state cues;
visual packs must never alter navigation meaning or core functionality.

The permanent visible navigation is `Сегодня | План | Добавить | Успех |
Профиль`. The internal technical identifier remains `progress`, and the
existing `orbits-progress*.png` filenames remain unchanged for future Phase B
integration. This documentation decision does not claim that the mobile app
already displays `Успех`.

The full navigation surface follows `theme.background`; it must not introduce
a hardcoded white card behind all five items. Warm uses `#FCF9F6`, while gray
`#8B8E96` and dark `#211D2E` remain preview candidates. Dark navigation labels
are white. A compact active background, border, shape and stronger label weight
provide a non-color selected cue; pressed/disabled styling and the raised Add
surface remain owned by UI containers.

Orbits is the Free/default visual pack. Focus Sparks and Focusiki remain future
paid alternatives; pack selection, payment and entitlement behavior are not
implemented here. The warm-light documentation direction uses `#FCF9F6`.
Neutral gray `#8B8E96` and dark `#211D2E` are preview candidates only; their
exact runtime tokens still require physical-device contrast and accessibility
validation.

## Integrity manifest

`SHA256SUMS.txt` is the committed canonical integrity manifest for the five
approved masters and 15 deterministic density exports. Verify these hashes
before production integration or regeneration; master and export files must
not be silently replaced.

## Evidence boundary

- **Approved:** the five master images and their semantic visual direction.
- **Documentation preview:** static responsive examples on three backgrounds.
- **Density export candidates:** deterministic 1×/2×/3× PNGs derived from the
  unchanged masters with high-quality downsampling.
- **Not implemented:** production application assets, React Native navigation,
  visual-pack switching, paid entitlements or runtime theme selection.
- **Not verified:** Android/iOS rendering, physical-device contrast, system text
  scaling, screen-reader behavior and final gray/dark runtime tokens.
