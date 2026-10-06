export type AdType = 'video' | 'imageWithVoice';

export const AD_TYPES: AdType[] = ['video', 'imageWithVoice'];

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
  created_at?: string;
  updated_at?: string;
  model_type: 'ad';
}
