begin;

-- Bound to the authenticated caller; SECURITY DEFINER avoids participant-policy recursion.
create function public.can_use_room_playlist(room_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null
    and exists (select 1 from public.chats where id = room_id and type = 'direct')
    and exists (select 1 from public.chat_participants where chat_id = room_id and profile_id = auth.uid())
    and (select count(*) from public.chat_participants where chat_id = room_id) = 2;
$$;
revoke all on function public.can_use_room_playlist(uuid) from public, anon;
grant execute on function public.can_use_room_playlist(uuid) to authenticated;

create table public.room_playlists (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  created_by uuid not null default auth.uid() references public.profiles(id),
  name text not null check (length(trim(name)) between 1 and 80),
  created_at timestamptz not null default now()
);
create index room_playlists_chat_idx on public.room_playlists(chat_id, created_at desc);

create table public.playlist_tracks (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references public.room_playlists(id) on delete cascade,
  added_by uuid not null default auth.uid() references public.profiles(id),
  spotify_track_id text not null check (spotify_track_id ~ '^[A-Za-z0-9]{22}$'),
  title text not null check (length(trim(title)) between 1 and 160),
  artist text not null check (length(trim(artist)) between 1 and 160),
  memory_notes text not null check (length(trim(memory_notes)) between 1 and 2000),
  created_at timestamptz not null default now(),
  unique (playlist_id, spotify_track_id)
);
create index playlist_tracks_order_idx on public.playlist_tracks(playlist_id, created_at desc, id desc);
alter table public.room_playlists enable row level security;
alter table public.playlist_tracks enable row level security;
revoke all on public.room_playlists, public.playlist_tracks from anon, authenticated;
grant select, insert on public.room_playlists to authenticated;
grant select, insert, delete on public.playlist_tracks to authenticated;
grant update (title, artist, memory_notes) on public.playlist_tracks to authenticated;

create policy room_playlists_read on public.room_playlists for select to authenticated
using (public.can_use_room_playlist(chat_id));
create policy room_playlists_create on public.room_playlists for insert to authenticated
with check (created_by = auth.uid() and public.can_use_room_playlist(chat_id));
create policy playlist_tracks_read on public.playlist_tracks for select to authenticated
using (exists (select 1 from public.room_playlists p where p.id = playlist_id));
create policy playlist_tracks_add on public.playlist_tracks for insert to authenticated
with check (added_by = auth.uid() and exists (select 1 from public.room_playlists p where p.id = playlist_id));
create policy playlist_tracks_edit on public.playlist_tracks for update to authenticated
using (added_by = auth.uid() and exists (select 1 from public.room_playlists p where p.id = playlist_id))
with check (added_by = auth.uid() and exists (select 1 from public.room_playlists p where p.id = playlist_id));
create policy playlist_tracks_remove on public.playlist_tracks for delete to authenticated
using (added_by = auth.uid() and exists (select 1 from public.room_playlists p where p.id = playlist_id));
commit;
