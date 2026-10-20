import {getBootstrapData} from '@ui/bootstrap-data/bootstrap-data-store';
import {apiClient} from '@common/http/query-client';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {Ad} from './ad';

vi.mock('@ui/bootstrap-data/bootstrap-data-store', () => ({
  getBootstrapData: vi.fn(),
}));
vi.mock('@common/http/query-client', () => ({
  apiClient: {get: vi.fn(), post: vi.fn()},
}));

const mockedBootstrapData = vi.mocked(getBootstrapData);
const mockedClient = vi.mocked(apiClient);

function baseAd(overrides: Partial<Ad>): Ad {
  return {
    id: 1,
    type: 'video',
    name: 'Ad',
    advertiser_name: 'Advertiser',
    video_path: null,
    image_path: null,
    voiceover_path: null,
    click_through_url: null,
    starts_at: null,
    ends_at: null,
    weight: 1,
    skip_after_seconds: null,
    is_active: true,
    impressions: 0,
    completions: 0,
    skips: 0,
    model_type: 'ad',
    ...overrides,
  };
}

function bootstrapForAds() {
  mockedBootstrapData.mockReturnValue({
    settings: {ads: {disable: false}},
    user: {id: 1, permissions: [{name: 'music.play'}]},
  } as never);
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('isServableAd', () => {
  it('rejects null', async () => {
    const {isServableAd} = await import('./session-preroll');
    expect(isServableAd(null)).toBe(false);
  });

  it('accepts a local video ad with a video path', async () => {
    const {isServableAd} = await import('./session-preroll');
    expect(
      isServableAd(baseAd({type: 'video', video_path: '/v.mp4'})),
    ).toBe(true);
  });

  it('rejects a local video ad with no video path', async () => {
    const {isServableAd} = await import('./session-preroll');
    expect(isServableAd(baseAd({type: 'video'}))).toBe(false);
  });

  it('requires both image and voiceover for a local image-with-voice ad', async () => {
    const {isServableAd} = await import('./session-preroll');
    expect(
      isServableAd(
        baseAd({
          type: 'imageWithVoice',
          image_path: '/i.jpg',
          voiceover_path: '/a.mp3',
        }),
      ),
    ).toBe(true);
    expect(
      isServableAd(
        baseAd({
          type: 'imageWithVoice',
          image_path: '/i.jpg',
          voiceover_path: null,
        }),
      ),
    ).toBe(false);
  });

  it('accepts a remote audio fill with only a voiceover', async () => {
    const {isServableAd} = await import('./session-preroll');
    const remote = baseAd({
      type: 'imageWithVoice',
      remote: true,
      voiceover_path: 'https://cdn.keekii.net/ads/a.mp3',
      image_path: null,
    });
    expect(isServableAd(remote)).toBe(true);
  });

  it('rejects a remote fill with no voiceover', async () => {
    const {isServableAd} = await import('./session-preroll');
    const remote = baseAd({type: 'imageWithVoice', remote: true});
    expect(isServableAd(remote)).toBe(false);
  });
});

describe('adToMediaItem', () => {
  it('prefixes ad ids so they cannot collide with track ids', async () => {
    const {adToMediaItem} = await import('./ad-media-item');
    const media = adToMediaItem(
      baseAd({type: 'imageWithVoice', voiceover_path: '/a.mp3'}),
    );
    expect(media.id).toBe('ad:1');
    expect(media.provider).toBe('htmlAudio');
    expect(media.src).toBe('/a.mp3');
  });
});

describe('initPlayerAds (remote fill)', () => {
  it('requests the next ad once and caches a remote fill', async () => {
    bootstrapForAds();
    const remote = baseAd({
      type: 'imageWithVoice',
      remote: true,
      remote_impression_id: 'imp_123',
      voiceover_path: 'https://cdn.keekii.net/ads/a.mp3',
      tracking: {impression: 'https://keekii.net/api/ads/beacon?e=imp'},
    });
    mockedClient.get.mockResolvedValue({data: {data: remote}} as never);

    const {initPlayerAds} = await import('./session-preroll');
    initPlayerAds();
    await Promise.resolve();
    await Promise.resolve();

    expect(mockedClient.get).toHaveBeenCalledWith('ads/next');
    expect(mockedClient.get).toHaveBeenCalledTimes(1);
  });

  it('treats a null network response as no ad', async () => {
    bootstrapForAds();
    mockedClient.get.mockResolvedValue({data: {data: null}} as never);

    const {initPlayerAds} = await import('./session-preroll');
    initPlayerAds();
    await Promise.resolve();
    await Promise.resolve();

    expect(mockedClient.get).toHaveBeenCalledWith('ads/next');
    expect(mockedClient.post).not.toHaveBeenCalled();
  });
});
