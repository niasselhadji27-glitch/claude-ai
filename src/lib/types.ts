export type SubscriptionTier = "free" | "starter" | "pro" | "agency";
export type JobType = "scrape" | "transcribe" | "generate_script" | "render";
export type JobStatus = "queued" | "processing" | "completed" | "failed";
export type AdMediaType = "video" | "image" | "carousel";
export type RenderStatus = "draft" | "queued" | "rendering" | "completed" | "failed";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  stripe_customer_id: string | null;
  subscription_tier: SubscriptionTier;
  subscription_status: string | null;
  credits_balance: number;
  created_at: string;
  updated_at: string;
}

export interface Board {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface SavedAd {
  id: string;
  user_id: string;
  board_id: string | null;
  meta_ad_id: string | null;
  meta_page_name: string | null;
  meta_ad_library_url: string | null;
  media_type: AdMediaType;
  media_storage_path: string | null;
  thumbnail_storage_path: string | null;
  original_media_url: string | null;
  ad_copy: string | null;
  cta_text: string | null;
  landing_page_url: string | null;
  transcript: string | null;
  metadata: Record<string, unknown>;
  scraped_at: string;
  created_at: string;
}

export interface GeneratedScript {
  id: string;
  user_id: string;
  saved_ad_id: string;
  title: string | null;
  content: string;
  variation_number: number;
  model: string;
  prompt_params: Record<string, unknown>;
  is_edited: boolean;
  created_at: string;
  updated_at: string;
}

export interface VoiceProfile {
  id: string;
  user_id: string | null;
  name: string;
  elevenlabs_voice_id: string;
  preview_url: string | null;
  settings: Record<string, unknown>;
  created_at: string;
}

export interface RenderedVideo {
  id: string;
  user_id: string;
  generated_script_id: string;
  voice_profile_id: string | null;
  status: RenderStatus;
  provider: string;
  provider_render_id: string | null;
  template_id: string | null;
  background_asset_paths: string[];
  voiceover_storage_path: string | null;
  output_url: string | null;
  output_storage_path: string | null;
  duration_seconds: number | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface Job {
  id: string;
  user_id: string;
  type: JobType;
  status: JobStatus;
  input: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error_message: string | null;
  related_id: string | null;
  attempts: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export const TIER_CREDITS: Record<SubscriptionTier, number> = {
  free: 10,
  starter: 100,
  pro: 500,
  agency: 2000,
};

export const CREDIT_COSTS = {
  scrape: 1,
  generate_script: 1,
  render: 5,
} as const;
