import {Ad} from '@app/web-player/ads/ad';
import {adToMediaItem, isAdMedia} from '@app/web-player/ads/ad-media-item';
import {auth} from '@common/auth/use-auth';
import {apiClient} from '@common/http/query-client';
import type {MediaItem} from '@common/player/media-item';
import type {PlayerState} from '@common/player/state/player-state';
import {getBootstrapData} from '@ui/bootstrap-data/bootstrap-data-store';

// idle -> fetching -> ready -> serving -> done
// A session serves at most one pre-roll, so `done` is terminal.
type PrerollStatus = 'idle' | 'fetching' | 'ready' | 'serving' | 'done';

// How an ad finished. Only these two close an impression; anything else
// (load stall, playback cap, an error, the listener picking another track)
// leaves the row's outcome null, which is how "shown but never finished"
// stays countable.
type AdOutcome = 'completed' | 'skipped';

// The ad decision is requested well before it is needed (see initPlayerAds).
// This is only the ceiling on how long an in-flight decision may still be
// awaited at the moment the first track of the session becomes playable.
// After it expires the slot is dropped rather than hold playback.
const READY_WAIT_MS = 1200;

// How long the ad creative itself gets to become playable before the slot is
// given up and the real track continues (workstream E).
const CUE_BUDGET_MS = 4000;

// Absolute cap on a single ad playback. Catches a creative that loads but
// then stalls without ever emitting an error, which would otherwise park the
// player on the ad forever.
const PLAYBACK_CAP_MS = 90000;

let status: PrerollStatus = 'idle';
let ad: Ad | null = null;
let target: MediaItem | null = null;
let readyPromise: Promise<void> | null = null;
let capTimer: ReturnType<typeof setTimeout> | null = null;
// The impression the server opened for the ad currently serving, resolved to
// its id. Held as a promise rather than an id because the outcome can be
// decided (skip, natural end) before the impression response comes back, and
// the two have to be sent in order. Null when nothing is outstanding.
let impressionRequest: Promise<number | null> | null = null;
// Decided by playback, written only when the impression is finally closed.
let pendingOutcome: AdOutcome | null = null;
// True from the moment the creative is on screen until its log has been
// flushed. Marks are accepted for as long as this is open, which includes the
// window after `finish()` - see finishAdPlayLog for why that window matters.
let loggingOpen = false;

/**
 * Kick off the ad decision as early as the player layout mounts, so that by
 * the time a listener actually presses play the answer is already in hand.
 * Idempotent, and never throws.
 */
export function initPlayerAds(): void {
  if (status !== 'idle') return;
  if (!canServeAds()) {
    status = 'done';
    return;
  }
  status = 'fetching';
  readyPromise = fetchNextAd();
}

/**
 * Runs from `onBeforePlay`, i.e. after the real track has been cued but
 * before the provider is told to play. Everything in here is best-effort:
 * any failure leaves the real track cued and lets playback continue.
 */
export async function maybeStartPreroll(
  state: PlayerState | null,
  cuePending: boolean,
): Promise<void> {
  try {
    // A cue that never resolved means we cannot trust our snapshot of what is
    // about to play, so leave this round alone rather than resume the wrong
    // thing afterwards.
    if (!state || cuePending) return;
    if (status !== 'fetching' && status !== 'ready') return;

    if (status === 'fetching' && readyPromise) {
      await Promise.race([readyPromise, delay(READY_WAIT_MS)]);
    }
    // Still nothing by now: missed the session-start window.
    if (status !== 'ready' || !ad) {
      if (status === 'fetching') status = 'done';
      return;
    }
    if (!canServeAds()) {
      status = 'done';
      return;
    }

    const current = state.cuedMedia;
    if (!current || isAdMedia(current)) return;

    const media = adToMediaItem(ad);
    const servedAd = ad;
    target = current;
    status = 'serving';

    // Cut the real track before the creative loads. Without this a fast
    // provider (YouTube auto-plays on providerReady) can put a fraction of a
    // second of content in front of the pre-roll.
    state.pause();

    const loaded = await cueWithinBudget(state, media);
    if (!loaded) {
      await abandon(state);
      return;
    }
    // The creative is on screen: open the impression now, so a stall after
    // this point is recorded as an impression that never finished rather
    // than as no impression at all.
    startAdPlay(servedAd);
    startPlaybackCap(state);
  } catch {
    // Never let ad bookkeeping surface as a playback failure.
    if (status === 'serving' && state) {
      await abandon(state).catch(() => {});
    }
  }
}

/**
 * Called when playback of the ad ends for any reason (natural completion,
 * the user moving to a different track, an error, the playback cap). Hands
 * the player back to the real track it interrupted.
 *
 * Returns true when it took over, so `onBeforePlayNext` can swallow the
 * queue's own idea of what comes next - the ad never joined the queue, so
 * the default advance would skip to an unrelated item.
 */
export function resumeAfterAd(state: PlayerState | null): boolean {
  if (status !== 'serving') return false;
  const restore = target;
  finish();
  if (!restore || !state) return false;
  void Promise.resolve(state.play(restore)).catch(() => {});
  return true;
}

/** A real track was cued while the ad was on screen: the ad was superseded. */
export function adInterrupted(): void {
  if (status !== 'serving') return;
  finish();
}

export function isPrerollServing(): boolean {
  return status === 'serving';
}

/**
 * The ad ran all the way through.
 *
 * The signal is the `playbackEnd` listener, not the queue's advance: a
 * keyboard shortcut that skips ahead must not be recorded as a completed
 * view. Note that the store notifies its own `playbackEnd` handler (the one
 * that calls `playNext`, and so hands control back here) *before* this
 * listener - both run in the same synchronous pass, ours registered second.
 * That is why `finish()` flushes on a microtask: by the time the flush runs,
 * this has already been called.
 */
export function markAdCompleted(): void {
  if (!loggingOpen || pendingOutcome) return;
  pendingOutcome = 'completed';
}

/** The listener used the skip affordance. */
export function markAdSkipped(): void {
  if (!loggingOpen || pendingOutcome) return;
  pendingOutcome = 'skipped';
}

function startAdPlay(servedAd: Ad): void {
  pendingOutcome = null;
  loggingOpen = true;
  impressionRequest = apiClient
    .post<{data?: {id?: number}}>(`ads/${servedAd.id}/plays`)
    .then(r => r.data?.data?.id ?? null)
    .catch(() => null);
}

/**
 * Closes the outstanding impression, if there is one to close. Always drops
 * the reference so nothing leaks between sessions, but only sends the
 * outcome when playback actually decided one.
 */
function finishAdPlayLog(): void {
  const request = impressionRequest;
  const outcome = pendingOutcome;
  impressionRequest = null;
  pendingOutcome = null;
  loggingOpen = false;

  if (!request || !outcome) return;

  void request
    .then(id => {
      if (id == null) return;
      return apiClient.post(`ads/plays/${id}/finish`, {outcome});
    })
    .catch(() => {});
}

async function fetchNextAd(): Promise<void> {
  try {
    const body = (await apiClient.get<{data?: Ad | null}>('ads/next')).data;
    ad = isServableAd(body?.data) ? body.data : null;
  } catch {
    ad = null;
  }
  if (status === 'fetching') {
    status = ad ? 'ready' : 'done';
  }
}

/**
 * An ad with a missing or wrong-typed creative must not consume the session
 * slot - dropping it means the listener simply gets music.
 */
function isServableAd(candidate: Ad | null | undefined): candidate is Ad {
  if (!candidate) return false;
  if (candidate.type === 'video') return !!candidate.video_path;
  if (candidate.type === 'imageWithVoice') {
    return !!candidate.voiceover_path && !!candidate.image_path;
  }
  return false;
}

/**
 * Mirrors the same gates the display ad host applies, plus the playback
 * permission the player itself enforces, so an ad can never appear for
 * someone who could not have played content anyway.
 */
function canServeAds(): boolean {
  try {
    const {settings, user} = getBootstrapData();
    if (settings?.ads?.disable) return false;
    if (!user || auth.isSubscribed) return false;
    return !!user.permissions?.some(
      p => p.name === 'music.play' || p.name === 'admin',
    );
  } catch {
    return false;
  }
}

async function cueWithinBudget(
  state: PlayerState,
  media: MediaItem,
): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const loaded = Promise.resolve(state.cue(media)).then(
      () => true,
      () => false,
    );
    const expired = new Promise<boolean>(resolve => {
      timer = setTimeout(() => resolve(false), CUE_BUDGET_MS);
    });
    return await Promise.race([loaded, expired]);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function abandon(state: PlayerState): Promise<void> {
  const restore = target;
  finish();
  if (restore) {
    await cueWithinBudget(state, restore);
  }
}

function finish(): void {
  status = 'done';
  target = null;
  ad = null;
  if (capTimer) {
    clearTimeout(capTimer);
    capTimer = null;
  }
  // Flush on a microtask rather than here. On a natural end the sequence is
  // one synchronous emit of `playbackEnd`: the store's own handler runs
  // first (it calls playNext, which is what leads to this call), then ours
  // records `completed` - so reading the outcome synchronously would always
  // see null for exactly the case that matters most.
  queueMicrotask(finishAdPlayLog);
}

function startPlaybackCap(state: PlayerState): void {
  if (capTimer) clearTimeout(capTimer);
  capTimer = setTimeout(() => {
    resumeAfterAd(state);
  }, PLAYBACK_CAP_MS);
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
