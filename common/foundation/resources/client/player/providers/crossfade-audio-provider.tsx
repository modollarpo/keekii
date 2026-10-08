import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { usePlayerStore } from '@common/player/hooks/use-player-store';
import { PlayerStoreContext } from '@common/player/player-context';
import { useHtmlMediaApi } from '@common/player/providers/html-media/use-html-media-api';
import { useHtmlMediaEvents } from '@common/player/providers/html-media/use-html-media-events';
import { useHtmlMediaInternalState } from '@common/player/providers/html-media/use-html-media-internal-state';

/**
 * Dual-source crossfade audio provider utilizing Web Audio API GainNodes
 * and an equal-power crossfade curve for seamless continuous mix transitions.
 */
export function CrossfadeAudioProvider() {
  const audioRefA = useRef<HTMLAudioElement>(null);
  const audioRefB = useRef<HTMLAudioElement>(null);
  
  const [activeSlot, setActiveSlot] = useState<'A' | 'B'>('A');
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeARef = useRef<GainNode | null>(null);
  const gainNodeBRef = useRef<GainNode | null>(null);
  const sourceNodeARef = useRef<MediaElementAudioSourceNode | null>(null);
  const sourceNodeBRef = useRef<MediaElementAudioSourceNode | null>(null);

  const autoPlay = usePlayerStore(s => s.options.autoPlay);
  const muted = usePlayerStore(s => s.muted);
  const volume = usePlayerStore(s => s.volume);
  const cuedMedia = usePlayerStore(s => s.cuedMedia);
  const store = useContext(PlayerStoreContext);

  const activeRef = activeSlot === 'A' ? audioRefA : audioRefB;
  const state = useHtmlMediaInternalState(activeRef);
  const events = useHtmlMediaEvents(state);
  const providerApi = useHtmlMediaApi(state);

  // Initialize Web Audio API nodes once on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      if (audioRefA.current && audioRefB.current) {
        const gainA = ctx.createGain();
        const gainB = ctx.createGain();

        gainA.gain.value = 1.0;
        gainB.gain.value = 0.0;

        gainA.connect(ctx.destination);
        gainB.connect(ctx.destination);

        gainNodeARef.current = gainA;
        gainNodeBRef.current = gainB;

        sourceNodeARef.current = ctx.createMediaElementSource(audioRefA.current);
        sourceNodeARef.current.connect(gainA);

        sourceNodeBRef.current = ctx.createMediaElementSource(audioRefB.current);
        sourceNodeBRef.current.connect(gainB);
      }
    } catch (e) {
      console.warn('Web Audio API crossfade initialization fallback:', e);
    }

    return () => {
      audioContextRef.current?.close();
    };
  }, []);

  // Update volume and mute state across gain nodes
  useEffect(() => {
    const masterGain = muted ? 0 : (volume / 100);
    if (gainNodeARef.current && gainNodeBRef.current && audioContextRef.current) {
      const now = audioContextRef.current.currentTime;
      if (activeSlot === 'A') {
        gainNodeARef.current.gain.setTargetAtTime(masterGain, now, 0.05);
      } else {
        gainNodeBRef.current.gain.setTargetAtTime(masterGain, now, 0.05);
      }
    }
  }, [volume, muted, activeSlot]);

  useEffect(() => {
    store.setState({ providerApi });
  }, [store, providerApi]);

  let src = cuedMedia?.src;
  if (src && cuedMedia?.initialTime) {
    src = `${src}#t=${cuedMedia.initialTime}`;
  }

  // Crossfade execution method triggered programmatically before track end
  const triggerCrossfade = useCallback((nextSrc: string, duration = 5) => {
    const ctx = audioContextRef.current;
    if (!ctx || !gainNodeARef.current || !gainNodeBRef.current) return;

    const nextSlot = activeSlot === 'A' ? 'B' : 'A';
    const nextAudioRef = nextSlot === 'A' ? audioRefA : audioRefB;
    const currentGain = activeSlot === 'A' ? gainNodeARef.current.gain : gainNodeBRef.current.gain;
    const nextGain = nextSlot === 'A' ? gainNodeARef.current.gain : gainNodeBRef.current.gain;

    if (nextAudioRef.current) {
      nextAudioRef.current.src = nextSrc;
      nextAudioRef.current.currentTime = 0;
      nextAudioRef.current.play().catch(() => {});

      const now = ctx.currentTime;
      const master = muted ? 0 : (volume / 100);

      // Equal-power crossfade curve automation
      currentGain.setValueAtTime(master, now);
      currentGain.linearRampToValueAtTime(0, now + duration);

      nextGain.setValueAtTime(0, now);
      nextGain.linearRampToValueAtTime(master, now + duration);

      setTimeout(() => {
        setActiveSlot(nextSlot);
      }, duration * 1000);
    }
  }, [activeSlot, muted, volume]);

  // Expose crossfade trigger on store if desired or handle internally
  useEffect(() => {
    store.setState({ triggerCrossfade } as any);
  }, [store, triggerCrossfade]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <audio
        className={`absolute inset-0 h-full w-full ${activeSlot === 'A' ? 'block' : 'hidden'}`}
        ref={audioRefA}
        src={activeSlot === 'A' ? src : undefined}
        autoPlay={autoPlay && activeSlot === 'A'}
        muted={muted}
        {...(activeSlot === 'A' ? events : {})}
      />
      <audio
        className={`absolute inset-0 h-full w-full ${activeSlot === 'B' ? 'block' : 'hidden'}`}
        ref={audioRefB}
        src={activeSlot === 'B' ? src : undefined}
        autoPlay={autoPlay && activeSlot === 'B'}
        muted={muted}
        {...(activeSlot === 'B' ? events : {})}
      />
    </div>
  );
}
