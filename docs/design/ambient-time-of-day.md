# Ambient time-of-day glow

## Purpose

Mynah should **gently glow as a function of time**, like a calm nightlight and soft day marker—not a bright lamp or notification light. The primary experience is **ambient color and luminance that follow the day**, with smooth transitions and conservative brightness limits.

This document captures product intent and behavioral defaults. **Hardware context:** Mynah targets a compact mini smartphone whose **display is the glow surface**—see [Hardware platform](./hardware-platform.md). Implementation details (Android behavior, power, QA device pin) belong in engineering specs once those layers exist.

## Design principles

1. **Slow transitions** — Changes in hue and brightness happen over minutes, not seconds. Avoid stepped or abrupt shifts except explicit user actions (e.g. power off).
2. **Low maximum luminance at night** — Sleep-phase output is intentionally capped; “brighter” at night means “slightly less dim,” not room-filling light.
3. **Warmth over spectacle** — Dawn and dusk lean on warm/cool shifts people associate with sky light; sleep phase minimizes short-wavelength (“blue”) energy relative to day reference, without claiming clinical circadian efficacy.
4. **Quiet default** — When “neutral day” is desired, the device may read as inert decor (off or barely perceptible glow), depending on product positioning.

## Named phases

These are **experience labels**, not rigid clock times. Actual boundaries derive from local solar time, user schedule offsets, or manual overrides.

| Phase | Intent | Directional character |
|-------|--------|------------------------|
| **Dawn** | Gentle wake-oriented lift before or around rising | Cool rose through soft peach; luminance ramps slowly upward |
| **Day / neutral** | Presence without demanding attention | Off or minimal neutral glow; optional “always subtle” variant |
| **Dusk** | Wind-down; reduce alerting contrast | Amber shift; brightness falls somewhat faster than hue moves |
| **Sleep** | Orientation-only nightlight | Deep amber–rust or cool moonlit gray at nightlight levels; stable until dawn ramp |

Optional copy for users: single sentence per phase (e.g. “Sleep keeps a little light in the room so nothing surprises you.”).

## Brightness and transition behavior

- **Cross-fades** between phases target **tens of minutes** (e.g. 30–60 minutes into dawn; dusk fall aligned with user preference where configurable).
- **Derivative matters** — Small continuous changes feel calmer than rare large jumps.
- **Hard ceiling at night** — Implement a **maximum brightness** for Sleep (and optionally Dusk late segment) that cannot be exceeded without explicit “temporary bright” intent (e.g. gesture or control).
- **Temporary bright** — If supported (tap, proximity, app): short ramp up, then decay back to Sleep baseline on a timer.

## Schedule model

Support at least these conceptual modes (exact UX TBD):

1. **Solar-aligned** — Phase boundaries derived from approximate sunrise/sunset for location (with privacy-preserving location rules documented in security/privacy specs).
2. **Shifted chronotype** — User offsets (“early bird” / “night owl”) slide dawn/dusk windows without changing curve shapes.
3. **Fixed clock** — Simple times for phase boundaries for rooms without location or for strict routines.

**Travel:** Optional “follow phone timezone” vs “keep home schedule” to avoid jarring changes when traveling.

## Settings (user-facing, minimal surface)

Expose a small number of controls; hide expert tuning behind an “advanced” fold if needed.

- **Overall warmth** — Single slider affecting hue anchor across phases (not per-second color picking).
- **Night brightness cap** — Bounded slider with safe defaults; copy should discourage eye-searing levels.
- **Phase offsets** — Slide dawn earlier/later; dusk earlier/later; optional separate sleep onset.
- **Presets** — Named palettes (e.g. glacier dawn, desert dusk, ink sleep) as **starting points**, not exclusive themes.
- **Seasonal tilt (optional)** — Slightly extend dusk in shorter winter days without implying medical claims.

## Wake and ritual hooks (optional product extensions)

- **Light-before-sound** — If Mynah integrates with alarms: dawn-colored ramp **precedes** audio by a configurable interval (e.g. 10–20 minutes).
- **Wind-down gesture** — One explicit action (“done with screens”) could snap or accelerate into dusk palette as a household ritual signal.
- **Multi-unit sync** — Two or more devices in one home share phase state so rooms feel consistent.

## Constraints and claims

- Avoid marketing language that implies **medical treatment** of sleep disorders unless supported by evidence and regulatory posture.
- If **motion or presence** influence brightness, document **privacy** (what is sensed, stored, and transmitted) in a separate privacy design note.

## Open questions

- **Panel limits** — Minimum hardware brightness, LCD vs OLED, and whether a physical diffuser accessory is needed for “gentle” glow (see [Hardware platform](./hardware-platform.md)).
- Whether Day phase is **off** vs **minimal accent** by default.
- Kid-room mode: stricter caps, slower transitions, parental lock—scope for v1 vs later.
- Power-loss behavior: restore last schedule vs safe dim default.

## Revision history

| Date | Change |
|------|--------|
| 2026-05-03 | Initial design doc: circadian-inspired ambient glow (dawn, dusk, sleep nightlight), transitions, schedule models, settings |
| 2026-05-03 | Linked hardware platform; reframed open questions for screen-as-glow (panel limits vs LED) |
