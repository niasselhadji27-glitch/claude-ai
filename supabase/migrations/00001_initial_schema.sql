-- ============================================================
-- Meta Ads Spy & AI Video SaaS — initial schema
-- Run in the Supabase SQL editor or via `supabase db push`.
-- ============================================================

-- Enums -------------------------------------------------------

create type subscription_tier as enum ('free', 'starter', 'pro', 'agency');

create type job_type as enum ('scrape', 'transcribe', 'generate_script', 'render');

create type job_status as enum ('queued', 'processing', 'completed', 'failed');

create type ad_media_type as enum ('video', 'image', 'carousel');

create type render_status as enum ('draft', 'queued', 'rendering', 'completed', 'failed');

-- Profiles (1:1 with auth.users) ------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  stripe_customer_id text unique,
  subscription_tier subscription_tier not null default 'free',
  subscription_status text,          -- mirrors Stripe: active, past_due, canceled…
  credits_balance integer not null default 10 check (credits_balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create a profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Boards (swipe-file folders) ---------------------------------

create table public.boards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

-- Saved ads ---------------------------------------------------

create table public.saved_ads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  board_id uuid references public.boards (id) on delete set null,
  meta_ad_id text,                   -- Meta Ad Library ID when known
  meta_page_name text,               -- advertiser / competitor name
  meta_ad_library_url text,
  media_type ad_media_type not null default 'video',
  media_storage_path text,           -- re-hosted creative in Supabase Storage
  thumbnail_storage_path text,
  original_media_url text,           -- Meta CDN URL (expires — do not rely on it)
  ad_copy text,                      -- primary text / headline / description
  cta_text text,
  landing_page_url text,
  transcript text,                   -- Whisper output for video ads
  metadata jsonb not null default '{}'::jsonb,  -- start date, platforms, reach, etc.
  scraped_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index saved_ads_user_id_idx on public.saved_ads (user_id, created_at desc);
create index saved_ads_board_id_idx on public.saved_ads (board_id);
create index saved_ads_metadata_idx on public.saved_ads using gin (metadata);

-- Generated scripts -------------------------------------------

create table public.generated_scripts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  saved_ad_id uuid not null references public.saved_ads (id) on delete cascade,
  title text,
  content text not null,             -- the script text (markdown)
  variation_number smallint not null default 1,
  model text not null default 'gpt-4o',
  prompt_params jsonb not null default '{}'::jsonb,  -- angle, tone, duration…
  is_edited boolean not null default false,          -- user modified AI output
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index generated_scripts_ad_idx on public.generated_scripts (saved_ad_id);
create index generated_scripts_user_idx on public.generated_scripts (user_id, created_at desc);

-- Voice profiles (ElevenLabs) ---------------------------------

create table public.voice_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade,  -- null = platform default voice
  name text not null,
  elevenlabs_voice_id text not null,
  preview_url text,
  settings jsonb not null default '{}'::jsonb,  -- stability, similarity_boost…
  created_at timestamptz not null default now()
);

create index voice_profiles_user_idx on public.voice_profiles (user_id);

-- Rendered videos ---------------------------------------------

create table public.rendered_videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  generated_script_id uuid not null references public.generated_scripts (id) on delete cascade,
  voice_profile_id uuid references public.voice_profiles (id) on delete set null,
  status render_status not null default 'draft',
  provider text not null default 'creatomate',
  provider_render_id text,           -- Creatomate render ID for webhook matching
  template_id text,                  -- Creatomate template used
  background_asset_paths text[] not null default '{}',  -- Supabase Storage paths
  voiceover_storage_path text,       -- generated ElevenLabs audio
  output_url text,
  output_storage_path text,
  duration_seconds numeric,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index rendered_videos_user_idx on public.rendered_videos (user_id, created_at desc);
create index rendered_videos_provider_idx on public.rendered_videos (provider_render_id);

-- Generic async job tracker -----------------------------------

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type job_type not null,
  status job_status not null default 'queued',
  input jsonb not null default '{}'::jsonb,
  result jsonb,
  error_message text,
  related_id uuid,                   -- saved_ad / script / render id, per type
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create index jobs_user_status_idx on public.jobs (user_id, status, created_at desc);
create index jobs_pending_idx on public.jobs (status, created_at) where status = 'queued';

-- Credit ledger (append-only) ---------------------------------

create table public.credit_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  delta integer not null,            -- negative = spend, positive = grant
  reason text not null,              -- 'scrape', 'render', 'monthly_grant', 'purchase'…
  job_id uuid references public.jobs (id) on delete set null,
  created_at timestamptz not null default now()
);

create index credit_ledger_user_idx on public.credit_ledger (user_id, created_at desc);

-- updated_at maintenance --------------------------------------

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger set_boards_updated_at before update on public.boards
  for each row execute function public.set_updated_at();
create trigger set_scripts_updated_at before update on public.generated_scripts
  for each row execute function public.set_updated_at();
create trigger set_renders_updated_at before update on public.rendered_videos
  for each row execute function public.set_updated_at();

-- Row Level Security ------------------------------------------

alter table public.profiles enable row level security;
alter table public.boards enable row level security;
alter table public.saved_ads enable row level security;
alter table public.generated_scripts enable row level security;
alter table public.voice_profiles enable row level security;
alter table public.rendered_videos enable row level security;
alter table public.jobs enable row level security;
alter table public.credit_ledger enable row level security;

-- Profiles: users can read/update their own row (inserts come from the trigger,
-- tier/credits changes come from service-role webhooks only)
create policy "own profile select" on public.profiles
  for select using (auth.uid() = id);
create policy "own profile update" on public.profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id);

-- Standard owner policies
create policy "own boards" on public.boards
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own saved_ads" on public.saved_ads
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own scripts" on public.generated_scripts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Voice profiles: own rows plus platform defaults (user_id is null)
create policy "voice profiles select" on public.voice_profiles
  for select using (user_id is null or auth.uid() = user_id);
create policy "voice profiles write" on public.voice_profiles
  for insert with check (auth.uid() = user_id);
create policy "voice profiles update" on public.voice_profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "voice profiles delete" on public.voice_profiles
  for delete using (auth.uid() = user_id);

create policy "own renders" on public.rendered_videos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Jobs & ledger: read-only for users; writes go through service role
create policy "own jobs select" on public.jobs
  for select using (auth.uid() = user_id);
create policy "own ledger select" on public.credit_ledger
  for select using (auth.uid() = user_id);

-- Storage buckets ---------------------------------------------

insert into storage.buckets (id, name, public)
values
  ('ad-media', 'ad-media', false),        -- re-hosted scraped creatives
  ('user-assets', 'user-assets', false),  -- uploaded background footage/images
  ('renders', 'renders', false)           -- final rendered videos + voiceovers
on conflict (id) do nothing;

create policy "own ad-media" on storage.objects
  for all using (
    bucket_id in ('ad-media', 'user-assets', 'renders')
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id in ('ad-media', 'user-assets', 'renders')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
