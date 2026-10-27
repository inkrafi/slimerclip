-- Niche channel per pengguna: {"topics": ["bisnis", ...], "comedy": true}.
-- Kosong/null = semua topik ditampilkan. Jalankan sekali di Supabase Dashboard → SQL Editor.
alter table public.profiles add column if not exists niche jsonb;
