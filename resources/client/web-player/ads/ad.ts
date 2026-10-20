export type AdType = 'video' | 'imageWithVoice';

export const AD_TYPES: AdType[] = ['video', 'imageWithVoice'];

/**
 * Signed beacon URLs for a network-filled ad. Every URL already carries its
 * own HMAC, so the client just has to GET them at the right moment.
 */
export interface AdTracking {
  impression?: string;
  complete?: string;
  skip?: string;
  error?: string;
  firstQuartile?: string;
  midpoint?: string;
  thirdQuartile?: string;
}

export interface Ad {
  id: number;
  type: AdType;
  name: string;
  advertiser_name: string;
  video_path: string | null;
  image_path: string | null;
  voiceover_path: string | null;
  click_through_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
  weight: number;
  skip_after_seconds: number | null;
  is_active: boolean;
  impressions: number;
  completions: number;
  skips: number;
  // Network (KIKI) fill. `remote` means the impression is accounted for by
  // the network rather than the local ads table; `tracking` carries the
  // beacon URLs to fire on start and finish.
  remote?: boolean;
  remote_impression_id?: string | null;
  tracking?: AdTracking | null;
  created_at?: string;
  updated_at?: string;
  model_type: 'ad';
}
