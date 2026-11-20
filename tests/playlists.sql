\set ON_ERROR_STOP on
-- Run only against a disposable local PostgreSQL database.
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
grant usage on schema auth to authenticated, anon;
create table public.profiles(id uuid primary key);
create table public.chats(id uuid primary key,type text);
create table public.chat_participants(chat_id uuid references chats,profile_id uuid references profiles,primary key(chat_id,profile_id));
insert into profiles values ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002'),('00000000-0000-0000-0000-000000000003');
insert into chats values ('10000000-0000-0000-0000-000000000001','direct'),('10000000-0000-0000-0000-000000000002','direct');
insert into chat_participants values ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001'),('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002'),('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003');
\ir ../supabase/migrations/20261120000000_shared_playlists.sql
set role authenticated;
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
insert into room_playlists(id,chat_id,name) values ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Lagu Kita');
insert into playlist_tracks(id,playlist_id,spotify_track_id,title,artist,memory_notes) values ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','4iV5W9uYEdYUVa79Axb7Rh','Lagu Satu','Penyanyi',E'Perjalanan pertama.\nPulang bersamamu.');
do $$ begin
 begin insert into playlist_tracks(playlist_id,spotify_track_id,title,artist,memory_notes) values ('20000000-0000-0000-0000-000000000001','4iV5W9uYEdYUVa79Axb7Rh','Duplikat','X','Y'); raise exception 'duplicate allowed'; exception when unique_violation then null; end;
 begin insert into playlist_tracks(playlist_id,spotify_track_id,title,artist,memory_notes) values ('20000000-0000-0000-0000-000000000001','1iV5W9uYEdYUVa79Axb7Rh','X','Y',' '); raise exception 'blank notes allowed'; exception when check_violation then null; end;
 begin update playlist_tracks set added_by='00000000-0000-0000-0000-000000000002'; raise exception 'owner spoof allowed'; exception when insufficient_privilege then null; end;
end $$;
update playlist_tracks set memory_notes=E'Catatan diperbarui.\nTetap bermakna.';
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
do $$ begin
 if (select count(*) from playlist_tracks)<>1 then raise exception 'peer cannot read'; end if;
 update playlist_tracks set memory_notes='Tidak boleh'; if found then raise exception 'peer edited owner notes'; end if;
 delete from playlist_tracks; if found then raise exception 'peer deleted owner song'; end if;
end $$;
insert into playlist_tracks(playlist_id,spotify_track_id,title,artist,memory_notes) values ('20000000-0000-0000-0000-000000000001','1iV5W9uYEdYUVa79Axb7Rh','Lagu Dua','Penyanyi','Dari peserta kedua.');
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000003';
do $$ begin
 if exists(select from room_playlists) or exists(select from playlist_tracks) then raise exception 'outsider read allowed'; end if;
 begin insert into playlist_tracks(playlist_id,spotify_track_id,title,artist,memory_notes) values ('20000000-0000-0000-0000-000000000001','2iV5W9uYEdYUVa79Axb7Rh','X','Y','Z'); raise exception 'outsider insert allowed'; exception when insufficient_privilege then null; end;
 begin insert into room_playlists(chat_id,name) values ('10000000-0000-0000-0000-000000000002','Solo'); raise exception 'single person room allowed'; exception when insufficient_privilege then null; end;
end $$;
set role anon;
do $$ begin begin perform * from room_playlists; raise exception 'anonymous access allowed'; exception when insufficient_privilege then null; end; end $$;
reset role;
select 'PASS: participants contribute; private notes, ownership, duplicate and anonymous protections verified' as result;
