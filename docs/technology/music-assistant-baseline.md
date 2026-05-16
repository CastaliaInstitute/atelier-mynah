# Music Assistant — technology baseline (Atlas / Mynah)

## Product scope (Atlas / Mynah)

| Name | Role |
|------|------|
| **Atlas** | Castalia’s **tablet line** (and related form factors): https://atlas.castalia.institute |
| **Mynah** | Ambient **mini-smartphone glow** product; design specs under [`docs/design/`](../design/README.md) |

## Purpose

This document **baselines** [Music Assistant](https://music-assistant.io/) as a candidate **whole-home audio aggregation layer** across **Atlas** (tablets as likely control / dashboard surfaces) and **Mynah** (ambient device—audio hooks optional). It records **what the platform does today**, **constraints**, and **open integration questions**—not a commitment to ship Music Assistant on any particular SKU.

**Baseline date:** 2026-05-03 (reevaluate periodically; streaming providers and APIs change).

## What Music Assistant is

Music Assistant (MA) is an open-source **music library and playback coordinator**: it unifies catalogs (files, streaming accounts), builds queues and playlists, and drives **multiple playback endpoints** (players) from one UI and automation surface. It is commonly deployed beside **Home Assistant** but can run standalone.

## Capability matrix (baseline)

| Area | Supported (baseline understanding) | Notes |
|------|-----------------------------------|--------|
| **Spotify** | Yes | Typically requires **Spotify Premium** for full catalog/streaming via third-party integrations; account linking via provider setup in MA. |
| **Local / LAN libraries** | Yes | SMB/NAS and similar—depends on deployment and provider configuration. |
| **Grouped / synced playback** | Yes | **Player groups** coordinate multiple MA players for synchronized playback; quality varies by device and protocol (native grouping vs MA-led sync). |
| **Multi-zone / multi-room** | Yes | Core model is many players + queues; grouping is the user-facing “speakers together” pattern. |
| **Automation / API** | Partial / contextual | Deep ties exist in the Home Assistant ecosystem when MA is integrated there; treat HTTP/API exposure as **deployment-specific** and verify for your MA major version. |

## Implications for Atlas

Atlas hardware is a natural place for **household music UX**: browser or app access to Music Assistant (or Home Assistant + MA), wall-mounted **now playing**, room/group picker, and automation shortcuts. Baseline evaluation should ask whether tablets are **thin clients** to a home-hosted MA instance or whether any **native** Castalia client is required.

## Implications for Mynah

Mynah’s primary experience is **ambient light**, not a music UI—but product notes already allow **optional audio hooks** (e.g. light-before-sound) and **multi-unit consistency** across rooms (see [`docs/design/ambient-time-of-day.md`](../design/ambient-time-of-day.md)). Music Assistant is relevant as:

1. **Household audio plane** — Central place for Spotify (and other sources) if Castalia wants **one** stack instead of many vendor apps.
2. **Grouped output** — If “whole home” or paired rooms matter, MA’s **player groups** are the baseline mechanism to evaluate against Sonos-only, Cast-only, or Apple-only approaches.
3. **Separation of concerns** — Mynah can remain a **glow + ritual** surface while MA (or another coordinator) owns **playback**, provided integration boundaries are clear.

## Risks and constraints

- **Streaming terms** — Third-party Spotify use depends on Spotify’s **product tier** and API/connect behavior; **free-tier** expectations should be treated as **unsupported** for serious integration planning.
- **Operational footprint** — MA is another **always-on service** (container/add-on/VM); capacity, backups, and upgrades must be owned like any infrastructure component.
- **Latency / sync** — Mixed hardware groups may exhibit **audible skew**; vendor-native ecosystems sometimes win on tight sync.
- **Version drift** — Baseline behaviors above should be **revalidated** when pinning a specific MA major release for production.

## Open questions (for Atlas / Mynah)

- **Deployment shape** — Standalone MA vs Home Assistant add-on vs other orchestration; which matches Castalia’s ops model?
- **Atlas client model** — Web UI only vs embedded experience; SSO or shared-household accounts on tablets?
- **Player inventory** — Which **physical targets** (Chromecast, AirPlay, DLNA, dedicated speakers) must be first-class for grouped playback?
- **Mynah ↔ MA boundary** — Does Mynah ever **control** playback, **display** now-playing, or only receive **time/sync signals** from household automation?
- **Privacy / accounts** — Where do Spotify and other credentials live; who administers household linking?

## References

- Atlas (tablets): https://atlas.castalia.institute
- Music Assistant documentation: https://music-assistant.io/
- Mynah ambient design (audio and multi-unit hooks): [`docs/design/ambient-time-of-day.md`](../design/ambient-time-of-day.md)

## Revision history

| Date | Change |
|------|--------|
| 2026-05-03 | Initial baseline (Spotify, groups, Mynah); Atlas scoped as tablet line at atlas.castalia.institute + Atlas implications / open questions |
