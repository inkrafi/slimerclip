-- Klip pratinjau (render pertama tanpa caption) dicatat terpisah dari render final,
-- agar jatah harian keduanya bisa dibatasi sendiri-sendiri.
alter table public.usage_events drop constraint if exists usage_events_kind_check;
alter table public.usage_events
  add constraint usage_events_kind_check check (kind in ('analysis', 'render', 'preview'));
