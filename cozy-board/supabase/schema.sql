-- Supabase schema for a public real-time shared board (no authentication)

create extension if not exists "pgcrypto";

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  room_id text not null,
  image_url text not null,
  x double precision not null default 0,
  y double precision not null default 0,
  w double precision not null default 214,
  h double precision not null default 302,
  rotation double precision not null default 0,
  text text not null default '',
  z_index integer not null default 0,
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists items_room_z_idx on public.items (room_id, z_index);
create index if not exists items_room_updated_idx on public.items (room_id, updated_at desc);

alter table public.items enable row level security;

drop policy if exists "Public can read items" on public.items;
drop policy if exists "Public can insert items" on public.items;
drop policy if exists "Public can update items" on public.items;
drop policy if exists "Public can delete items" on public.items;

create policy "Public can read items"
  on public.items
  for select
  to public
  using (true);

create policy "Public can insert items"
  on public.items
  for insert
  to public
  with check (true);

create policy "Public can update items"
  on public.items
  for update
  to public
  using (true)
  with check (true);

create policy "Public can delete items"
  on public.items
  for delete
  to public
  using (true);

-- Storage bucket for image uploads
insert into storage.buckets (id, name, public)
values ('polaroids', 'polaroids', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Public can read polaroids" on storage.objects;
drop policy if exists "Public can upload polaroids" on storage.objects;
drop policy if exists "Public can update polaroids" on storage.objects;
drop policy if exists "Public can delete polaroids" on storage.objects;

create policy "Public can read polaroids"
  on storage.objects
  for select
  to public
  using (bucket_id = 'polaroids');

create policy "Public can upload polaroids"
  on storage.objects
  for insert
  to public
  with check (bucket_id = 'polaroids');

create policy "Public can update polaroids"
  on storage.objects
  for update
  to public
  using (bucket_id = 'polaroids')
  with check (bucket_id = 'polaroids');

create policy "Public can delete polaroids"
  on storage.objects
  for delete
  to public
  using (bucket_id = 'polaroids');
