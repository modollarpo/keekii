# Player ads - ad-network (VAST / Google IMA) integration path

Status: design note only. Nothing in here is implemented. Workstreams A-E
built a self-hosted ("house ad") system; this describes how a real ad
network slots into it later without a rebuild.

Phase 0 confirmed house ads first, with the network path documented rather
than built. This note exists so the later work is an extension, not a
second system.

## What already exists that a network ad can ride

The house system was deliberately split so that only the *decision* is
ad-specific:

- **Selection is one endpoint.** `GET ads/next` returns a single
  serializable decision object (`Ad | null`) or nothing. A network branch
  is a new source behind the same endpoint, not a new flow.
- **Presentation is one function.** `adToMediaItem()`
  (`resources/client/web-player/ads/ad-media-item.ts`) is the only place
  where an `Ad` becomes player input. It stamps the `ad:` id prefix and
  leaves `groupId` undefined, which is what keeps an ad out of every queue
  operation and what `isAdMedia()` keys off.
- **Scheduling is format-agnostic.** `session-preroll.ts` is a state
  machine (`idle -> fetching -> ready -> serving -> done`) with a cue
  budget (`CUE_BUDGET_MS`), a playback cap, and a stored resume target. It
  has no idea what a creative is made of - it only knows whether a
  `MediaItem` cued successfully and whether playback ended. VAST fits
  unchanged.
- **Ad state is read from `cuedMedia`, not from a parallel flag.** The
  whole Phase 3 control surface (`AdNextButton`, `MainSeekbar` disabled,
  `AdNowPlaying`, `LyricsButton` hiding, `AdOverlayExpander`) branches on
  `isAdMedia(cuedMedia)` / `useCuedAd()`. A network ad that arrives as a
  `MediaItem` gets every one of those behaviours for free.
- **Reporting is already the shape VAST reporting needs.** `ad_plays`
  opens an impression row, then closes it with `completed` or `skipped`
  once. That maps directly onto VAST `Impression` plus the quartile
  events, and gives house and network numbers one table to reconcile
  against.
- **Skip is data-driven.** `skip_after_seconds` already drives
  `useAdSkipSecondsLeft()` and the skip button's enabled state. VAST
  `skipoffset` can be normalised onto the same field.

`click_through_url` is stored on `Ad` today but is not yet surfaced as a
click target in the player UI. It becomes the network click-through hook
exactly as-is; wiring it up is a house-ad UI decision independent of any
network work.

## The one real constraint: `provider` is a closed union

```ts
// common/foundation/resources/client/player/media-item.ts
provider: 'youtube' | 'htmlAudio' | 'htmlVideo' | 'hls' | 'dash';
```

`PlayerOutlet` switches on `state.providerName`, which `cue()` sets
directly from `media.provider` (`player-store.tsx:345`). Providers render
their own element and hand the store a `PlayerProviderApi`
(`play`, `pause`, `stop`, `seek`, `setVolume`, `setMuted`,
`setPlaybackRate`, `getCurrentTime`, `getSrc`, optional track hooks) -
`use-html-media-api.ts` is the reference implementation.

So an ad-network creative is either a *new provider* or a *side channel
outside the player*. Those are the only two shapes available.

## Option 1 - IMA as a provider (recommended)

Add `provider: 'vast'` (an additive union member, invisible to every
existing caller) and a lazily loaded `ImaProvider` component alongside the
existing `HlsProvider` / `DashProvider` lazy branches.

The provider renders a container, boots the IMA SDK against the VAST tag
URL carried in `src`, and implements `PlayerProviderApi` so the store
still believes it is playing media. IMA events map onto `PlayerEvents`:

| IMA | `PlayerEvents` |
| --- | --- |
| `loaded` / `start` | `providerReady` + `cued` (resolves `cue()`'s promise) |
| `timeUpdate` | `progress` |
| `complete` / `ENDED` | `playbackEnd` (which is exactly where `markAdCompleted()` already fires) |
| `AD_ERROR` | `error` (existing listener already routes that to `resumeAfterAd`) |
| click-through | anchor navigation, outside the store |

Why this shape: every surface built in Phases 2-4 keeps working with no
special cases - progress bar, seek lock, media session, ambient colour,
auto-expand, impression reporting, and the skip button all read the same
`cuedMedia`/`playbackEnd` state they read today. The ad becomes just
another media item, which is what section 0 of the original brief argued
for.

Cost: four or five files inside
`common/foundation/resources/client/player/`. They are additive (one new
union member, one new provider folder, one new `case` in `PlayerOutlet`,
no edits to existing providers), so they stay backward compatible with
every other product using this package - but they must be listed in the
final report under constraint 1.

## Option 2 - IMA outside the player (no `common/` change)

Mount the IMA container in `PlayerOverlay` / `AdNowPlaying` while
`isPrerollServing()` is true, and pause the store's current provider
around it.

Cheapest and it touches no shared code, but the player goes blind for the
ad's duration: no duration, no progress, no media-session metadata, no
fullscreen/PiP, and `PlayerOverlay` would need a second resident video
element competing with `PlayerOutlet`'s one. Every Phase 3 surface would
have to learn a second source of truth about "is an ad playing".

Viable as an interim step; wrong as the destination.

**Pick Option 1.** Phase 2 made the store the single point of control and
Phase 3 made the controls read ad state from `cuedMedia`. Adding a
provider preserves that; a side channel undoes it.

## Concrete sequence when the time comes

1. Add `VastMediaItem` to the `MediaItem` union - purely additive, no
   existing variant changes, existing media items unaffected.
2. Add `ImaProvider` under `providers/ima/`, lazy-loaded in
   `PlayerOutlet` exactly like `hls-provider` / `dash-provider`, with
   `PlayerProviderApi` implemented to the shape in
   `state/player-provider-api.tsx`.
3. Set `providerReady` and emit `cued` the way `useHtmlMediaEvents` does,
   so `cue()`'s existing 8-second promise resolves rather than timing out.
4. Let `ads/next` gain a `network` branch that returns the same decision
   shape plus `provider` and `src` (the VAST tag). `adToMediaItem()`
   picks `vast` for that case. **`session-preroll.ts` does not change.**
5. Normalise VAST `skipoffset` / the linear `skippable` flag onto
   `skip_after_seconds` so `AdNextButton` and `useAdSkipSecondsLeft()`
   behave identically for house and network creative. Keep the Phase 0
   rule: video skippable, image-with-voice not.
6. Fire VAST `Impression` and quartile pixels alongside the existing
   two-phase `ad_plays` write, so the two reporting systems reconcile.
7. **Failure still falls through.** A VAST load or render failure must
   resolve inside `CUE_BUDGET_MS` and hit the existing `error` listener,
   which already calls `resumeAfterAd()`. The playback cap stays as the
   backstop. Content never waits on an ad decision - unchanged from
   workstreams B and E.

## What must not change

- One ad per session start, never inserted into the queue
  (`groupId` stays undefined, `ad:` prefix stays).
- Every failure path lands on the real track, never an error state.
- `common/` changes stay additive: a new union member, a new provider,
  a new lazy `case`. No behaviour edits to existing providers.
- Cadence, skippability, and house-vs-network remain owner decisions
  (Phase 0), not engineering assumptions.

## Costs and commercial terms

Not asserted here. The IMA SDK is distributed by Google - confirm the
current distribution channel and licence terms at implementation time,
alongside whatever Google Ad Manager / AdSense relationship is required
to serve. This pass built the mechanism only and says nothing about
advertiser relationships, pricing, or fill rates.
