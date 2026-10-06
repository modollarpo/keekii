import {Ad} from '@app/web-player/ads/ad';
import {AdMediaMeta, isAdMedia} from '@app/web-player/ads/ad-media-item';
import {usePlayerStore} from '@common/player/hooks/use-player-store';

/**
 * The ad the session pre-roll currently has cued, or null whenever a real
 * track owns the surface. Every playback control that needs to tell the two
 * apart reads it from here, so "is this an ad?" is decided in exactly one
 * place and cannot drift between the desktop bar, the mobile bar and the
 * expanded overlay.
 */
export function useCuedAd(): Ad | null {
  const media = usePlayerStore(s => s.cuedMedia);
  if (!media || !isAdMedia(media)) return null;
  return (media.meta as unknown as AdMediaMeta | undefined) ?? null;
}
