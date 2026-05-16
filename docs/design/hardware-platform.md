# Hardware platform

## Summary

Mynah is built around a **compact mini smartphone** used primarily as a **soft, full-screen ambient glow** (dawn / dusk / sleep) rather than as a general-purpose daily driver. The device’s small footprint and bright-colored chassis make it plausible as a **bedside or shelf object** that happens to run Mynah.

**Form factor (marketing & industrial design):** The physical object should always read as **mini-phone scale** — a **portrait rectangular slab** with phone-like aspect (~small smartphone proportions), thin depth, rounded corners, one dominant glowing screen face. **Do not** depict or imply **square cubes**, **spheres/orbs**, **pucks**, or **non-rectangular “ambient blobs”** as the product; accessories may differ, but **the device itself stays phone-shaped**. A **round pocketwatch-class accessory** (Mynah Pocketwatch) is an allowed **secondary** form factor; see [Mynah Pocketwatch](./pocketwatch.md).

Reference listing snapshot (for industrial-design and scale context): `docs/assets/reference-platform-amazon-listing.png`.

## Reference device (target class)

Commercial listings vary; treat these as the **current reference SKU class**, not an eternal pin:

| Attribute | Reference |
|-----------|-----------|
| Role | Ultra-compact 4G smartphone (often marketed as backup / kids / secondary phone) |
| Display | ~**3.7"** HD touchscreen |
| Memory / storage | **3 GB RAM**, **32 GB** storage (typical for this class) |
| Connectivity | **4G**, **dual SIM**, **GPS** |
| Biometrics | **Face unlock** (vendor implementation) |
| Power | Small battery (~**2000 mAh** class); **USB charging** — design for **nightstand dock / always-plugged** use where possible |
| Colors | Multiple finishes (e.g. orange, blue, black); chassis color is part of the **object identity** when the screen is dim or off |

Exact SoC, Android version, and sensor mix are **implementation details** to capture in a firmware/README once a specific unit is fixed.

## Product implications for Mynah

1. **The screen is the nightlight** — Ambient phases should use a **full-viewport, low-luminance color wash** (with optional minimal UI or none). Avoid sharp UI chrome during Sleep and Dusk.
2. **Burn-in and panel health** — If the panel is OLED-class, prefer **subtle spatial variation** or occasional micro-shifts where acceptable; if LCD, bias toward **uniform backlight** behavior. Confirm panel type on the pinned SKU.
3. **Distraction budget** — The same device *can* run apps; Mynah should define a **dominant “ambient mode”** (kiosk / launcher / full-screen experience) so the product reads as a calm light, not a second phone feed.
4. **Power model** — Assume overnight use may be **plugged in**; still respect thermal and charging UI policies. Unplugged “sleep glow” should degrade gracefully (dimmer cap, optional earlier fade).
5. **Physical placement** — Small rectangle: **stands**, **low docks**, or **face-up** on a nightstand. Illustrations and packaging should show **the glow facing the room**, not the thin edge.

## Open questions (hardware)

- Pin **one** SKU (model + Android API level) as the **Tier-1 reference** for QA.
- Confirm **display technology** (LCD vs OLED) and **minimum brightness** floor (some panels won’t go dim enough without software filtering).
- Accessories: **first-party stand** or **diffuser** optional—out of scope for v1 unless industrial design commits.

## Revision history

| Date | Change |
|------|--------|
| 2026-05-03 | Initial doc: mini smartphone as Mynah platform; screen-as-glow implications |
