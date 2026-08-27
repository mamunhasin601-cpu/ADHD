# Orbits navigation SVG prototypes (superseded)

Phase A.2 documentation-only prototypes for the rejected Orbits navigation
iteration. These five independent SVG design sources are preserved as design
history only: they are superseded by the approved raster masters under
`docs/design/raster-source/orbits/navigation/`, are not production-ready assets,
and are not a claim that the React Native navigation is implemented.

The vector direction was rejected after visual review for weak scale/presence
and an external-`<img>` `currentColor` fallback problem. Do not copy these SVGs
into `apps/mobile` or treat them as production assets. They remain in place so
the Phase A.2 decision and rejected geometry are auditable.

## References and inventory

- [Approved navigation direction 02](../../../visual-references/orbits/orbits-navigation-approved-direction-02.png)
- [Approved Today direction](../../../visual-references/orbits/today/today-orbits-approved-direction-01.png)
- [Orbits visual specification](../../../orbits-visual-spec.md)

| File | Meaning | Geometry |
| --- | --- | --- |
| `today.svg` | Сегодня | Four-point spark, one restrained rising orbit arc and one dot |
| `plan.svg` | План | Compact rounded calendar/grid, two bindings, four schedule dots, orbit arc and dot |
| `add.svg` | Добавить | Plain plus inside a restrained gapped orbit circle with dot |
| `progress.svg` | Прогресс | Calm rising arc, endpoint dot and small spark |
| `profile.svg` | Профиль | Neutral head, shoulder curve, orbit arc and dot |

Every SVG uses `viewBox="0 0 32 32"`, `width="32"`, `height="32"`, rounded
caps/joins and a 2.25 primary stroke. They contain no text, raster, external
resource, script, animation, filter, blur or provider mark. `currentColor`
represents primary geometry so the same file can render active and inactive;
candidate accents are `#0FA9A8` turquoise and `#F4B72A` yellow reward spark.
The existing `#6B5BFC` remains the compatibility anchor when a host supplies
the primary color. These details are historical and do not supersede the
approved raster source.

## Behavior contract

The preview keeps the exact labels `Сегодня | План | Добавить | Прогресс |
Профиль` as real HTML text. Today, Plan, Progress and Profile are destinations;
Add is a central quick action, remains raised above the bar, and is never a
selected destination. All labels stay visible in inactive and disabled examples.

Active state should normally be implemented with a compact container background,
a token-driven primary color, an accessibility selected state and label weight
or treatment. Do not create duplicated active SVG files. A future words-only
calm mode is illustrated in the preview but is not implemented.

## Accessibility and evidence boundary

Host UI must provide meaningful Russian labels, selected/current state, focus
order and non-color state cues. Icons should remain legible at 24, 28 and 32 px;
touch targets must not be reduced by decorative orbit details. Validate contrast,
system text scaling, Russian-label wrapping, small screens, safe-area Add
reachability, reduced motion and disabled haptics on supported devices. These
checks are pending; no WCAG conformance or physical-device result is claimed.

## Raster masters are the approved source

The five independent transparent PNG masters are the approved navigation
direction for Phase A.3. They are canonical raster source files, with
deterministic 1×/2×/3× density exports documented separately. The raster
preview is documentation-only; production application integration has not
started. Masters must not be copied directly into `apps/mobile/assets` or
stretched non-uniformly.

## Raster-to-production boundary

The PNG references and these SVGs are design sources only. Do not crop or copy
raster fragments into application assets. Before any React Native conversion,
review final geometry, viewBoxes, licensing, token props and platform rendering
as a separate approval. Nothing from this directory should be copied into
`apps/mobile/assets` during Phase A.2.
