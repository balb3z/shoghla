-- ============================================================
-- Migration: User profiles, CV storage, and saved jobs
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. user_profiles — stores CV metadata and extracted data
create table if not exists public.user_profiles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  cv_url      text,
  cv_filename text,
  cv_data     jsonb,
  updated_at  timestamptz not null default now(),
  constraint user_profiles_user_id_unique unique (user_id)
);

alter table public.user_profiles enable row level security;

-- Users can only read/write their own profile
create policy "Users can view own profile"
  on public.user_profiles for select
  using (auth.uid() = user_id);

create policy "Users can upsert own profile"
  on public.user_profiles for insert
  with check (auth.uid() = user_id);

create policy "Users can update own profile"
  on public.user_profiles for update
  using (auth.uid() = user_id);

-- 2. saved_jobs — jobs bookmarked by users
create table if not exists public.saved_jobs (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  job_title         text not null default '',
  company           text not null default '',
  location          text not null default '',
  url               text not null,
  source            text not null default '',
  date              text not null default '',
  match_percentage  int,
  saved_at          timestamptz not null default now(),
  constraint saved_jobs_user_url_unique unique (user_id, url)
);

alter table public.saved_jobs enable row level security;

create policy "Users can view own saved jobs"
  on public.saved_jobs for select
  using (auth.uid() = user_id);

create policy "Users can insert own saved jobs"
  on public.saved_jobs for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own saved jobs"
  on public.saved_jobs for delete
  using (auth.uid() = user_id);

-- Allow upsert (update on conflict)
create policy "Users can update own saved jobs"
  on public.saved_jobs for update
  using (auth.uid() = user_id);

-- 3. Storage bucket for CV uploads
-- Run this separately if the SQL editor doesn't support storage commands:
-- OR use the Supabase Dashboard → Storage → New Bucket

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cv-uploads',
  'cv-uploads',
  true,
  10485760, -- 10 MB
  array['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do nothing;

-- Storage RLS: users can only upload to their own folder (cvs/{user_id}/*)
create policy "Users can upload their own CV"
  on storage.objects for insert
  with check (
    bucket_id = 'cv-uploads'
    and auth.uid()::text = (string_to_array(name, '/'))[2]
  );

create policy "Anyone can read CV files"
  on storage.objects for select
  using (bucket_id = 'cv-uploads');

create policy "Users can update their own CV"
  on storage.objects for update
  using (
    bucket_id = 'cv-uploads'
    and auth.uid()::text = (string_to_array(name, '/'))[2]
  );

create policy "Users can delete their own CV"
  on storage.objects for delete
  using (
    bucket_id = 'cv-uploads'
    and auth.uid()::text = (string_to_array(name, '/'))[2]
  );
