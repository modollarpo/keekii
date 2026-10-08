import {usePlayerStore} from '@common/player/hooks/use-player-store';
import {PlayerStoreContext} from '@common/player/player-context';
import {setContinuousMixEnabled} from '@common/player/utils/continuous-mix';
import {Button} from '@shadcn/button/button';
import {Trans} from '@ui/i18n/trans';
import {useCallback, useContext} from 'react';

// Reads the current opt-in continuous-mix state from the player store and
// returns a toggle that flips it without a page reload. The provider swap
// keeps the current playback position and auto-resumes if it was playing.
export function useContinuousMix() {
  const store = useContext(PlayerStoreContext);
  const enabled = usePlayerStore(s => !!s.options.continuousMix);

  const toggle = useCallback(() => {
    const state = store.getState();
    const next = !state.options.continuousMix;
    setContinuousMixEnabled(next);

    const wasPlaying = state.isPlaying;
    const currentTime = state.getCurrentTime();
    const cuedMedia = state.cuedMedia;

    // Swap html audio <-> crossfade provider in place. providerReady is
    // reset so it only goes true again once the freshly mounted element has
    // loaded its metadata, and the position is preserved via initialTime
    // (both providers resume through the same `src#t=` fragment).
    store.setState({
      options: {...state.options, continuousMix: next},
      isPlaying: false,
      providerReady: false,
      cuedMedia: cuedMedia
        ? {...cuedMedia, initialTime: currentTime || cuedMedia.initialTime}
        : cuedMedia,
    });

    if (!wasPlaying) return;

    // resume on the new provider once it's ready (bypasses onBeforePlay so
    // a provider swap never triggers ads or permission gating again)
    let done = false;
    let unsubscribe: () => void = () => {};
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const finish = (shouldResume: boolean) => {
      if (done) return;
      done = true;
      unsubscribe();
      if (timeoutId) clearTimeout(timeoutId);
      if (shouldResume) store.getState().providerApi?.play();
    };
    unsubscribe = store.subscribe(
      s => s.providerReady,
      ready => {
        if (ready) finish(true);
      },
    );
    timeoutId = setTimeout(() => finish(false), 5000);
  }, [store]);

  return {enabled, toggle};
}

export function ContinuousMixToggleButton() {
  const {enabled, toggle} = useContinuousMix();

  return (
    <Button
      variant={enabled ? 'default' : 'outline'}
      color={enabled ? 'primary' : 'default'}
      size="xs"
      onClick={toggle}
      title="Toggle Continuous DJ Mix Crossfade Mode"
    >
      <Trans message={enabled ? 'DJ Mix: On' : 'DJ Mix: Off'} />
    </Button>
  );
}
