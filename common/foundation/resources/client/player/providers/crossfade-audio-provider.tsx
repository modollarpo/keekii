import {usePlayerStore} from '@common/player/hooks/use-player-store';
import {PlayerStoreContext} from '@common/player/player-context';
import {MediaItem} from '@common/player/media-item';
import {playerQueue} from '@common/player/player-queue';
import {useHtmlMediaApi} from '@common/player/providers/html-media/use-html-media-api';
import {useHtmlMediaEvents} from '@common/player/providers/html-media/use-html-media-events';
import {useHtmlMediaInternalState} from '@common/player/providers/html-media/use-html-media-internal-state';
import {
  HTMLAttributes,
  SyntheticEvent,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

type Slot = 'A' | 'B';
type FadePhase = 'idle' | 'prepped' | 'fading';

// how long before the end the inactive element starts buffering the next track
const PREP_LEAD_SECONDS = 8;
// never begin a mix shorter than this; below it the track just ends normally
const MIN_FADE_SECONDS = 0.75;
// remaining-time watcher cadence
const WATCH_INTERVAL_MS = 250;

function buildSrc(media: MediaItem): string {
  return media.initialTime ? `${media.src}#t=${media.initialTime}` : media.src;
}

/**
 * Two-slot continuous-mix provider. The active element plays the cued track;
 * the inactive one pre-buffers the next queue item and, in the final
 * crossfade seconds, plays it at level 0 while an equal-power ramp driven by
 * element.volume moves gain across. When the outgoing track ends, a
 * synchronous handoff advances the queue and swaps slots without ever
 * pausing or reloading the incoming audio.
 *
 * Deliberately no Web Audio: routed MediaElementSource nodes silence
 * cross-origin audio, and element.volume is enough for a bit-accurate mix.
 */
export function CrossfadeAudioProvider() {
  const store = useContext(PlayerStoreContext);

  const audioRefA = useRef<HTMLAudioElement>(null);
  const audioRefB = useRef<HTMLAudioElement>(null);
  // stable, live view of the active element: the handoff repoints it
  // synchronously (before React commits the slot swap) so the store-initiated
  // play/pause/seek right after the handoff targets the incoming track
  const activeElRef = useRef<HTMLMediaElement | null>(null);
  const activeSlotRef = useRef<Slot>('A');

  const [activeSlot, setActiveSlot] = useState<Slot>('A');
  const [prepSrc, setPrepSrc] = useState<string | undefined>(undefined);

  const muted = usePlayerStore(s => s.muted);
  const cuedMedia = usePlayerStore(s => s.cuedMedia);
  const continuousMix = usePlayerStore(s => !!s.options.continuousMix);
  const crossfadeDuration = usePlayerStore(
    s => s.options.crossfadeDuration ?? 5,
  );

  const state = useHtmlMediaInternalState(activeElRef);
  const events = useHtmlMediaEvents(state);
  const providerApi = useHtmlMediaApi(state);

  const phaseRef = useRef<FadePhase>('idle');
  const prepRef = useRef<{media: MediaItem} | null>(null);
  const fadeRef = useRef<{
    outEl: HTMLMediaElement;
    inEl: HTMLMediaElement;
    startedAt: number;
    duration: number;
  } | null>(null);
  const fadeRafRef = useRef<number | undefined>(undefined);

  const queue = useMemo(() => playerQueue(() => store.getState()), [store]);

  // align the live pointer after React commits a slot swap (the handoff also
  // sets it manually so nothing has to wait for this commit)
  useLayoutEffect(() => {
    activeSlotRef.current = activeSlot;
    activeElRef.current =
      activeSlot === 'A' ? audioRefA.current : audioRefB.current;
  }, [activeSlot]);

  useEffect(() => {
    store.setState({providerApi});
  }, [store, providerApi]);

  const masterVolume = useCallback(() => {
    const st = store.getState();
    return st.muted ? 0 : st.volume / 100;
  }, [store]);

  const stopFadeLoop = useCallback(() => {
    if (fadeRafRef.current !== undefined) {
      cancelAnimationFrame(fadeRafRef.current);
      fadeRafRef.current = undefined;
    }
  }, []);

  const abortFade = useCallback(() => {
    stopFadeLoop();
    const fade = fadeRef.current;
    fadeRef.current = null;
    if (fade) {
      fade.inEl.pause();
      fade.inEl.volume = 0;
      try {
        fade.inEl.currentTime = 0;
      } catch {
        // element may be mid-load; position will reset with the next cue
      }
    }
    prepRef.current = null;
    setPrepSrc(undefined);
    phaseRef.current = 'idle';
  }, [stopFadeLoop]);

  const startFade = useCallback(
    (inEl: HTMLMediaElement, outEl: HTMLMediaElement, duration: number) => {
      phaseRef.current = 'fading';
      fadeRef.current = {
        outEl,
        inEl,
        startedAt: performance.now(),
        duration,
      };
      inEl.currentTime = 0;
      inEl.volume = 0;
      void inEl.play().catch(() => {});

      const tick = () => {
        const fade = fadeRef.current;
        if (!fade) return;
        const p = Math.min(
          1,
          (performance.now() - fade.startedAt) / fade.duration,
        );
        // equal-power ramp read from live store state, so volume/mute
        // changes during the mix apply on the next frame
        const m = masterVolume();
        fade.outEl.volume = m * Math.cos((p * Math.PI) / 2);
        fade.inEl.volume = m * Math.sin((p * Math.PI) / 2);
        fadeRafRef.current = requestAnimationFrame(tick);
      };
      fadeRafRef.current = requestAnimationFrame(tick);
    },
    [masterVolume],
  );

  /**
   * Synchronous queue advance on the outgoing element's ended event while
   * fading. All of it runs inside that event dispatch, in one batch: the
   * store flags stop() off, playbackEnd advances and cues the next item,
   * the slots swap with identical src strings so React never re-sets them,
   * and the events the incoming element fired before it had handlers are
   * reported manually.
   */
  const runHandoff = useCallback((): boolean => {
    const st = store.getState();
    const prepped = prepRef.current;
    const next = queue.peekNext();
    const outEl = activeElRef.current;
    const inEl =
      activeSlotRef.current === 'A' ? audioRefB.current : audioRefA.current;

    if (
      !prepped ||
      !next ||
      next.id !== prepped.media.id ||
      !outEl ||
      !inEl ||
      inEl.readyState < 3 ||
      !Number.isFinite(inEl.duration) ||
      !st.isPlaying ||
      st.isSeeking
    ) {
      return false;
    }

    stopFadeLoop();
    fadeRef.current = null;

    // 1. tell stop() — playNext's first statement — that the outgoing track
    //    already ended: pausing or seeking to 0 would cut the mix
    store.setState({crossfadeHandoff: true});

    // 2. advance the queue: playbackEnd runs its internal listener, which
    //    calls playNext() synchronously mid-queue: stop() consumes the flag,
    //    cue() writes cuedMedia = next and awaits the 'cued' emitted below
    st.emit('playbackEnd');

    // playNext bailed before reaching stop(); don't leave the flag armed
    if (store.getState().crossfadeHandoff) {
      store.setState({crossfadeHandoff: false});
      return false;
    }

    // 3. flip the slots; clearing the prep in the same batch keeps the
    //    incoming element's src string identical across the swap, which is
    //    what prevents React (and the load() effect) from restarting it
    prepRef.current = null;
    setPrepSrc(undefined);
    activeSlotRef.current = activeSlotRef.current === 'A' ? 'B' : 'A';
    activeElRef.current = inEl;
    phaseRef.current = 'idle';
    setActiveSlot(activeSlotRef.current);

    // 4. the incoming element loaded and started before it had event
    //    handlers, so report the metadata the normal event flow would have
    st.emit('cued');
    st.emit('durationChange', {duration: inEl.duration});
    const buffered = inEl.buffered;
    st.emit('buffered', {
      seconds: buffered.length ? buffered.end(buffered.length - 1) : 0,
    });
    st.emit('play');

    // 5. the ramp reached full level (or the outgoing track ended early);
    //    pin the incoming track exactly at master volume from here on
    inEl.volume = masterVolume();

    return true;
  }, [store, queue, stopFadeLoop, masterVolume]);

  const wrappedEvents = useMemo<HTMLAttributes<HTMLMediaElement>>(() => {
    const isActiveEvent = (e: SyntheticEvent<HTMLMediaElement>) =>
      e.currentTarget === activeElRef.current;

    // handlers only make sense for the element the store currently points
    // at: the pre-buffered one fires events too, but it is not yet the
    // playback the UI describes
    const guard = (handler?: (e: SyntheticEvent<HTMLMediaElement>) => void) =>
      (e: SyntheticEvent<HTMLMediaElement>) => {
        if (!isActiveEvent(e)) return;
        handler?.(e);
      };

    return {
      ...events,
      onEnded: e => {
        if (!isActiveEvent(e)) return;
        if (phaseRef.current === 'fading') {
          if (runHandoff()) return;
          // mix couldn't complete — clear it and take the normal path
          abortFade();
        } else if (phaseRef.current !== 'idle') {
          // prepped but never started: the normal cue handles the load
          abortFade();
        }
        events.onEnded?.(e);
      },
      // a pause or seek mid-mix means the user interrupted it: stop the
      // incoming track and let the outgoing one carry on alone
      onPause: guard(e => {
        if (phaseRef.current === 'fading') abortFade();
        events.onPause?.(e);
      }),
      onSeeking: guard(e => {
        if (phaseRef.current === 'fading') abortFade();
        events.onSeeking?.(e);
      }),
      onPlaying: guard(events.onPlaying),
      onTimeUpdate: guard(events.onTimeUpdate),
      onDurationChange: guard(events.onDurationChange),
      onLoadedMetadata: guard(events.onLoadedMetadata),
      onWaiting: guard(events.onWaiting),
      onStalled: guard(events.onStalled),
      onSuspend: guard(events.onSuspend),
      onSeeked: guard(events.onSeeked),
      onRateChange: guard(events.onRateChange),
      onError: guard(events.onError),
    };
  }, [events, runHandoff, abortFade]);

  // remaining-time watcher: prepares the next track early, then starts the
  // mix once the fade window opens
  useEffect(() => {
    if (!continuousMix || crossfadeDuration <= 0) return;

    const id = window.setInterval(() => {
      if (phaseRef.current !== 'idle') return;
      const st = store.getState();
      if (!st.isPlaying || st.isSeeking) return;

      const duration = st.mediaDuration;
      const outEl = activeElRef.current;
      if (!outEl || !duration || !Number.isFinite(duration)) return;

      const remaining = duration - (outEl.currentTime || 0);
      if (remaining <= MIN_FADE_SECONDS) return;
      if (remaining > crossfadeDuration + PREP_LEAD_SECONDS) return;

      const next = queue.peekNext();
      if (!next) return;

      const inEl =
        activeSlotRef.current === 'A' ? audioRefB.current : audioRefA.current;
      if (!inEl) return;

      if (!prepRef.current) {
        prepRef.current = {media: next};
        phaseRef.current = 'prepped';
        setPrepSrc(buildSrc(next));
        return;
      }

      if (prepRef.current.media.id !== next.id) {
        // the queue changed under the prep; start over
        abortFade();
        return;
      }

      // prep exists and still matches → phase is 'prepped' by construction
      // (abort clears both together; 'fading' returned at the top)
      if (remaining <= crossfadeDuration && inEl.readyState >= 3) {
        startFade(inEl, outEl, remaining);
      }
    }, WATCH_INTERVAL_MS);

    return () => window.clearInterval(id);
  }, [
    continuousMix,
    crossfadeDuration,
    store,
    queue,
    abortFade,
    startFade,
  ]);

  // an external cue (user click, ad takeover, error recovery) supersedes any
  // prep or mix in progress; the handoff's own cue happens after phaseRef
  // is back at 'idle', so it never trips this
  const lastCuedIdRef = useRef(cuedMedia?.id);
  useEffect(() => {
    const previous = lastCuedIdRef.current;
    lastCuedIdRef.current = cuedMedia?.id;
    if (cuedMedia?.id === previous) return;
    if (phaseRef.current !== 'idle') {
      abortFade();
    }
  }, [cuedMedia?.id, abortFade]);

  useEffect(() => {
    return () => {
      stopFadeLoop();
      fadeRef.current = null;
      prepRef.current = null;
      phaseRef.current = 'idle';
    };
  }, [stopFadeLoop]);

  const cuedSrc = cuedMedia ? buildSrc(cuedMedia) : undefined;

  return (
    <div className="relative h-full w-full overflow-hidden">
      <audio
        ref={audioRefA}
        src={activeSlot === 'A' ? cuedSrc : prepSrc}
        muted={muted}
        {...wrappedEvents}
        preload={
          activeSlot === 'A' ? 'metadata' : prepSrc ? 'auto' : 'metadata'
        }
      />
      <audio
        ref={audioRefB}
        src={activeSlot === 'B' ? cuedSrc : prepSrc}
        muted={muted}
        {...wrappedEvents}
        preload={
          activeSlot === 'B' ? 'metadata' : prepSrc ? 'auto' : 'metadata'
        }
      />
    </div>
  );
}
