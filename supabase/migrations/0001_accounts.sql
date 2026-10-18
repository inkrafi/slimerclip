-- SlimerClip: akun, kuota, dan pustaka video per pengguna.
-- Jalankan sekali di Supabase Dashboard → SQL Editor.
--
-- Semua tabel memakai RLS tanpa policy: browser (anon/publishable key) tidak bisa membaca
-- atau menulis apa pun. Hanya backend (secret key) yang mengakses tabel ini.

create table if not exists public.profiles (
  id                  uuid primary key references auth.users (id) on delete cascade,
  email               text,
  free_analyses_used  integer not null default 0 check (free_analyses_used >= 0),
  gemini_key_enc      text,         -- API key Gemini milik pengguna, terenkripsi (Fernet) oleh backend
  gemini_key_hint     text,         -- 4 karakter terakhir, untuk ditampilkan
  created_at          timestamptz not null default now()
);

create table if not exists public.user_videos (
  user_id     uuid not null references auth.users (id) on delete cascade,
  video_id    text not null check (video_id ~ '^[A-Za-z0-9_-]{1,64}$'),
  created_at  timestamptz not null default now(),
  primary key (user_id, video_id)
);

create table if not exists public.usage_events (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('analysis', 'render')),
  server_key  boolean not null default false,  -- analisis memakai API key milik server
  created_at  timestamptz not null default now()
);

create index if not exists usage_events_user_kind_time on public.usage_events (user_id, kind, created_at);
create index if not exists usage_events_kind_time on public.usage_events (kind, created_at);

alter table public.profiles     enable row level security;
alter table public.user_videos  enable row level security;
alter table public.usage_events enable row level security;

-- Ambil satu jatah analisis gratis secara atomik (aman dari dua request bersamaan).
create or replace function public.reserve_free_analysis(p_user uuid, p_limit integer)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with updated as (
    update public.profiles
       set free_analyses_used = free_analyses_used + 1
     where id = p_user and free_analyses_used < p_limit
    returning 1
  )
  select exists (select 1 from updated);
$$;

-- Kembalikan jatah jika analisis gagal.
create or replace function public.refund_free_analysis(p_user uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles
     set free_analyses_used = greatest(free_analyses_used - 1, 0)
   where id = p_user;
$$;

-- Fungsi hanya boleh dipanggil backend.
revoke execute on function public.reserve_free_analysis(uuid, integer) from public, anon, authenticated;
revoke execute on function public.refund_free_analysis(uuid) from public, anon, authenticated;
grant execute on function public.reserve_free_analysis(uuid, integer) to service_role;
grant execute on function public.refund_free_analysis(uuid) to service_role;
