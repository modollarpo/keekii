import {Ad} from '@app/web-player/ads/ad';
import {MediaItem} from '@common/player/media-item';

// Queue/state identity for ad media. The prefix keeps an ad id from ever
// colliding with a real track id, and lets any listener cheaply ask "am I
// looking at an ad?" without reaching into the meta payload.
export const AD_MEDIA_ID_PREFIX = 'ad:';

// Same shape the player already expects from a Track, so the shared metadata
// (document title, media session, poster) code paths can read an ad without
// throwing on missing fields.
export interface AdMediaMeta extends Ad {
  artists: {name: string}[];
  image: string | null;
}

export function isAdMedia(media?: MediaItem | null): boolean {
  return !!media && `${media.id}`.startsWith(AD_MEDIA_ID_PREFIX);
}

/**
 * Build the MediaItem the existing provider stack plays for an ad.
 *
 * Deliberately leaves `groupId` undefined: any populated groupId makes
 * `loadMoreMediaItems` walk the "load more of this queue" path, which would
 * hand an ad id to the track loader. The preroll never joins the queue, so
 * there is no group to belong to.
 */
export function adToMediaItem(ad: Ad): MediaItem<AdMediaMeta> {
  const meta: AdMediaMeta = {
    ...ad,
    artists: [{name: ad.advertiser_name || ad.name}],
    image: ad.image_path ?? null,
  };

  const id = `${AD_MEDIA_ID_PREFIX}${ad.id}`;

  if (ad.type === 'video' && ad.video_path) {
    return {
      id,
      provider: 'htmlVideo',
      src: ad.video_path,
      meta,
      poster: ad.image_path ?? null,
    };
  }

  // image-with-voice: the audio provider carries the voiceover while the
  // image itself is rendered by the playback UI (workstream C).
  return {
    id,
    provider: 'htmlAudio',
    src: ad.voiceover_path ?? '',
    meta,
    poster: ad.image_path ?? null,
  };
}
