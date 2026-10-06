import {useCuedAd} from '@app/web-player/ads/use-cued-ad';
import {
  playerOverlayState,
  usePlayerOverlayStore,
} from '@app/web-player/state/player-overlay-store';
import {useSettings} from '@ui/settings/use-settings';
import {useEffect, useRef} from 'react';

/**
 * A video ad is a visual medium: parked in the mini-player it is a 64px card
 * in the corner of the screen. While one is cued this lifts the overlay to its
 * maximized state, and when the ad hands control back it puts the overlay
 * exactly where the listener had it.
 *
 * The `expandedForAd` latch is what keeps this polite: it opens the overlay
 * at most once per ad, so a listener who dismisses it mid-ad is not fought
 * back into it on the next render, and it only ever closes an overlay that
 * this hook itself opened.
 */
export function AdOverlayExpander() {
  const ad = useCuedAd();
  const isMaximized = usePlayerOverlayStore(s => s.isMaximized);
  const {player} = useSettings();
  const expandedForAd = useRef(false);

  // On mobile the player's own auto_open_overlay option re-opens the overlay
  // on the next play(), so closing here would only produce a flicker.
  const willAutoOpen =
    !!player?.mobile?.auto_open_overlay &&
    typeof window !== 'undefined' &&
    window.matchMedia('(max-width: 768px)').matches;

  useEffect(() => {
    if (ad) {
      if (ad.type === 'video' && !isMaximized && !expandedForAd.current) {
        expandedForAd.current = true;
        playerOverlayState.open();
      }
      return;
    }

    if (!expandedForAd.current) return;
    expandedForAd.current = false;
    if (willAutoOpen) return;
    if (usePlayerOverlayStore.getState().isMaximized) {
      playerOverlayState.toggle();
    }
  }, [ad, isMaximized, willAutoOpen]);

  return null;
}
