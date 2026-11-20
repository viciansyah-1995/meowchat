\set ON_ERROR_STOP on
\ir playlists.sql
create schema storage;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
alter table storage.objects enable row level security;
grant usage on schema storage to authenticated;
grant select,insert,delete,update on storage.objects to authenticated;
\ir ../supabase/migrations/20261120010000_room_moments.sql
set role authenticated;
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
insert into storage.objects(bucket_id,name) values('room-moments','10000000-0000-0000-0000-000000000001/00000000-0000-0000-0000-000000000001/40000000-0000-0000-0000-000000000001.jpg');
insert into room_moments(id,chat_id,place_name,latitude,longitude,photo_path,photo_bytes,caption)
values('40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Kebun Raya Bogor',-6.6,106.8,'10000000-0000-0000-0000-000000000001/00000000-0000-0000-0000-000000000001/40000000-0000-0000-0000-000000000001.jpg',100000,E'Sore itu.\nBareng kamu.');
do $$ begin
 if not public.claim_moment_location_search('10000000-0000-0000-0000-000000000001') then raise exception 'first search denied'; end if;
 if public.claim_moment_location_search('10000000-0000-0000-0000-000000000001') then raise exception 'search burst allowed'; end if;
 delete from storage.objects; if found then raise exception 'published photo deleted'; end if;
 begin insert into room_moments(id,chat_id,place_name,latitude,longitude,photo_path,photo_bytes) values('40000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','X',100,0,'10000000-0000-0000-0000-000000000001/00000000-0000-0000-0000-000000000001/40000000-0000-0000-0000-000000000002.jpg',900000); raise exception 'invalid location/oversized photo allowed'; exception when check_violation then null; end;
 begin insert into room_moments(id,chat_id,place_name,latitude,longitude,photo_path,photo_bytes) values('40000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','X',0,0,'10000000-0000-0000-0000-000000000001/00000000-0000-0000-0000-000000000001/40000000-0000-0000-0000-000000000003.jpg',900000); raise exception 'oversized photo allowed'; exception when check_violation then null; end;
end $$;
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
do $$ begin
 if (select count(*) from room_moments)<>1 or (select count(*) from storage.objects)<>1 then raise exception 'peer cannot read'; end if;
 delete from storage.objects; if found then raise exception 'peer deleted photo'; end if;
 begin insert into storage.objects(bucket_id,name) values('room-moments','10000000-0000-0000-0000-000000000001/00000000-0000-0000-0000-000000000001/40000000-0000-0000-0000-000000000003.jpg'); raise exception 'spoofed photo owner'; exception when insufficient_privilege then null; end;
end $$;
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000003';
do $$ begin
 if exists(select from room_moments) or exists(select from storage.objects) then raise exception 'outsider reads photos'; end if;
 if public.claim_moment_location_search('10000000-0000-0000-0000-000000000001') then raise exception 'outsider search'; end if;
end $$;
set role anon;
do $$ begin begin perform * from room_moments; raise exception 'anonymous moments'; exception when insufficient_privilege then null; end; end $$;
reset role;
select 'PASS: private moments/photos, peer access, validation, ownership and location search throttle' as result;
