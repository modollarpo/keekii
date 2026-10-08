# Audio quality tiers, scoped against this codebase

Question this answers: can Keekii deliver lossless or high-bitrate audio?

Short answer: not uniformly, and the reason is rights rather than engineering.
Every audio path in this repository proxies or redirects to a third-party source,
and there is no transcoding layer. What you can do well is improve first-party
content and describe it honestly.

## Current state, verified

No transcoding exists. There is no ffmpeg invocation, no encoding queue, no
HLS/DASH packaging and no bitrate ladder anywhere in `app/` or
`common/foundation/src/`. Delivered audio is bit-identical to whatever the
upstream provider hands over, so the ceiling is the provider's ceiling.

### Where audio comes from

| Source | File | What you actually get |
| --- | --- | --- |
| YouTube via Piped | `app/Http/Controllers/YoutubeStreamController.php:88` | Sorts available audio streams by bitrate, takes the highest. YouTube audio is lossy AAC/Opus, typically 128–160kbps. |
| Jamendo | `app/Http/Controllers/JamendoStreamController.php` | Proxies the provider directly. Lossy. |
| Audius | `app/Http/Controllers/AudiusStreamController.php` | Proxies the provider. Lossy, except where an artist uploaded FLAC. |
| Deezer previews | `app/Http/Controllers/PreviewStreamController.php:23` | 302 redirect to a Deezer preview URL. Short lossy clips by definition. |
| Deezer / Spotify | `app/Services/Providers/Deezer/*`, `Spotify/*` | **Metadata only.** `DeezerNormalizer`, `SpotifyNormalizer` and friends never deliver audio. Spotify has no unauthenticated audio delivery at all. |

The only two FLAC references in the client are format *detection*, not delivery:
`player/utils/guess-player-provider.ts:7` matches the extension so the player picks
a decoder, and `resources/client/offline/playback-data-storage.ts:239` maps the
MIME type for offline caching. Neither produces lossless audio.

### No lossless claim is currently made in the UI

A grep across `resources/client` and `common/foundation/resources/client` finds
no live "lossless", hi-res, 24-bit or 320kbps claim. This was already caught once:
`resources/defaults/default-settings.php:447` carries a comment recording that
"Lossless Audio Quality" was stripped from the landing page because "YouTube/Jamendo
do not deliver lossless". Keep that comment updated if the feature lands.

## What already helps

The delivery infrastructure is better than expected and does not need rebuilding:

- `common/foundation/src/Files/RangeFileResponse.php` — byte-range requests, so
  seeking a long file works today.
- `XAccelRedirectFileResponse.php`, `XSendFileResponse.php` — efficient delivery
  via nginx sendfile / X-Accel-Redirect instead of streaming through PHP.
- `StreamedFileResponse.php`, `RemoteFileResponse.php` — proxy variants.
- `TusServer.php`, `TusServerController.php` — resumable chunked uploads.

Uploads are permissive: `config/filesystems.php:13` sets `'accept' => []` for the
`media` type, meaning no MIME restriction, so FLAC and WAV would pass validation
today. The blocker is `max_file_size` on line 14, currently 10MB. A single FLAC
track is routinely 30–80MB, so that cap has to move and it interacts with TUS
chunking.

## Costs, honestly

The software is free. The bandwidth is not.

- **Encoder**: ffmpeg is LGPL, installs from any package manager, no licence fee.
  Opus is royalty-free by design under a BSD-style patent license. AAC patents
  expired in 2017, so encoding and distributing AAC-320 has no per-stream royalty.
- **ffmpeg is not in this project.** No Dockerfile at repo root, no ffmpeg
  reference in `ops/` or `.github/`. Adding it is a real dependency to install and
  keep patched, though still zero-licence-cost.
- **Storage**: 320kbps AAC is roughly 2–2.5x a 128kbps tier. FLAC is about half
  the size of equivalent lossless. First-party only, so modest.
- **Egress**: the line item that scales. 320kbps is ~2.5x the per-stream cost of
  128kbps, multiplied across listener hours.
- **CPU**: one-time per track on ingest, negligible against bandwidth at
  catalogue scale.

## The trap

**Do not transcode third-party content up to 320.** YouTube audio at 128kbps
re-encoded to 320 does not recover information that was never there. You get a
bigger file with identical audible quality — worse in every way except that it
looks better in a UI.

A 320 tier is only meaningful for first-party masters and content you host
directly. Anything proxied stays at its source quality and should be labelled as
such per-track.

## Recommended shape

First-party only, as a paid-plan feature, described per-track rather than as a
blanket quality claim.

1. Accept FLAC/WAV and raise the `media` `max_file_size` in
   `config/filesystems.php`.
2. Encode to FLAC on ingest and pass through FLAC uploads untouched. Re-encoding
   a lossless master loses data; pass-through is cheaper and strictly better.
3. Also emit a 320kbps AAC rendition for bandwidth-sensitive clients.
4. Gate delivery on subscription tier in the file response path.
5. Add a per-track quality indicator rather than a site-wide claim.
6. Leave proxied content alone and label it at its real bitrate.

Roughly a few weeks of work depending on the ingest pipeline.

## If the goal is "better default audio for everyone"

Consider a 320kbps AAC/Opus tier over first-party content instead. Smaller
change, more uniform, and it is what most services mean when they say "high
quality". Worth deciding which problem you are solving — genuine fidelity for
direct releases, or a better default for the whole catalogue — because they lead
to different builds.

Either way: advertising "Keekii is lossless" as a site-wide claim would not
survive contact with a listener on a YouTube-sourced track.

## Still blocked on rights

Lossless across the full catalogue would need a commercial conversation, not
engineering. Deezer carries a FLAC tier and this repo already integrates Deezer,
but as metadata. YouTube cannot be lossless without direct artist or label
agreements covering lossless masters.

## Open question

The player has no quality selector today — nothing surfaces bitrate choice to the
listener. That UI seam has not been investigated; see `docs/dj-roadmap.md` for how
`PlayerProviderApi` is structured if it needs extending.