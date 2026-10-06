import {Ad} from '@app/web-player/ads/ad';
import {markAdSkipped, resumeAfterAd} from '@app/web-player/ads/session-preroll';
import {usePlayerActions} from '@common/player/hooks/use-player-actions';
import {useCurrentTime} from '@common/player/hooks/use-current-time';

/**
 * Whether the creative may be skipped at all. Only video ads are ever
 * skippable (Phase 0), and only once the campaign configured a moment for
 * it - a null `skip_after_seconds` means the whole creative plays through.
 */
export function isAdSkippable(ad: Ad | null | undefined): ad is Ad {
  return !!ad && ad.type === 'video' && ad.skip_after_seconds != null;
}

/**
 * Whole seconds left before the skip affordance unlocks, or null while the
 * ad is not skippable at all.
 *
 * Derived from the ad's own playback clock rather than a timer, so there is
 * no interval to leak on unmount and the count can never outlive the
 * creative: the moment the real track is cued again, `useCuedAd` goes null
 * and this returns null with it.
 */
export function useAdSkipSecondsLeft(ad: Ad | null): number | null {
  // Subscribing only while an ad is cued keeps the regular seekbar's
  // second-tick out of a state nothing is rendering.
  const currentTime = useCurrentTime({precision: 'seconds', disabled: !ad});
  if (!isAdSkippable(ad) || ad.skip_after_seconds == null) return null;
  return Math.max(0, Math.ceil(ad.skip_after_seconds - currentTime));
}

/**
 * Hands the player straight back to the track the ad interrupted, recording
 * the impression as skipped first. Safe to call when no pre-roll is serving -
 * both steps report false and do nothing.
 */
export function useSkipAd(): () => void {
  const player = usePlayerActions();
  return () => {
    markAdSkipped();
    resumeAfterAd(player.getState());
  };
}
