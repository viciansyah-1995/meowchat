begin;
create function public.can_view_room_moments(room_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select auth.uid() is not null
 and exists(select 1 from public.chats where id=room_id and type='direct')
 and exists(select 1 from public.chat_participants where chat_id=room_id and profile_id=auth.uid())
 and (select count(*) from public.chat_participants where chat_id=room_id)=2;
$$;
revoke all on function public.can_view_room_moments(uuid) from public, anon;
grant execute on function public.can_view_room_moments(uuid) to authenticated;
create table public.room_moments (
 id uuid primary key,
 chat_id uuid not null references public.chats(id) on delete cascade,
 author_id uuid not null default auth.uid() references public.profiles(id),
 place_name text not null check(length(trim(place_name)) between 1 and 500),
 latitude double precision not null check(latitude between -90 and 90),
 longitude double precision not null check(longitude between -180 and 180),
 caption text not null default '' check(length(caption)<=1500),
 photo_path text not null unique,
 photo_bytes integer not null check(photo_bytes between 1 and 716800),
 created_at timestamptz not null default now(),
 constraint moment_photo_path_valid check(photo_path=chat_id::text || '/' || author_id::text || '/' || id::text || '.jpg')
);
create index room_moments_recent on public.room_moments(chat_id,created_at desc,id desc);
alter table public.room_moments enable row level security;
revoke all on public.room_moments from anon,authenticated;
grant select,insert on public.room_moments to authenticated;
create policy room_moments_read on public.room_moments for select to authenticated using(public.can_view_room_moments(chat_id));
create policy room_moments_add on public.room_moments for insert to authenticated with check(author_id=auth.uid() and public.can_view_room_moments(chat_id));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('room-moments','room-moments',false,716800,array['image/jpeg']);
create policy moment_photo_insert on storage.objects for insert to authenticated with check(bucket_id='room-moments');
create policy moment_photo_insert_scope on storage.objects as restrictive for insert to public with check(
 bucket_id<>'room-moments' or (
 name ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}/[a-f0-9-]{36}\.jpg$'
 and split_part(name,'/',2)=auth.uid()::text
 and public.can_view_room_moments(case when split_part(name,'/',1) ~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$' then split_part(name,'/',1)::uuid else null end)
 ));
create policy moment_photo_select on storage.objects for select to authenticated using(bucket_id='room-moments');
create policy moment_photo_visible_record on storage.objects as restrictive for select to public using(
 bucket_id<>'room-moments' or exists(select 1 from public.room_moments where photo_path=storage.objects.name));
create policy moment_photo_delete on storage.objects for delete to authenticated using(bucket_id='room-moments');
-- Only the uploader can clean up their own upload, without deleting a published photo.
create policy moment_photo_cleanup on storage.objects as restrictive for delete to public using(
 bucket_id<>'room-moments' or (split_part(name,'/',2)=auth.uid()::text
 and public.can_view_room_moments(case when split_part(name,'/',1) ~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$' then split_part(name,'/',1)::uuid else null end)
 and not exists(select 1 from public.room_moments where photo_path=storage.objects.name)));
create policy moment_photo_no_update on storage.objects as restrictive for update to public using(bucket_id<>'room-moments') with check(bucket_id<>'room-moments');

-- Shared across function instances so place search cannot burst across Vercel instances.
create table public.moment_location_gate(id boolean primary key default true check(id),next_at timestamptz not null);
insert into public.moment_location_gate values(true,'epoch');
alter table public.moment_location_gate enable row level security;
revoke all on public.moment_location_gate from public,anon,authenticated;
create function public.claim_moment_location_search(room_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if not public.can_view_room_moments(room_id) then return false; end if;
 update public.moment_location_gate set next_at=clock_timestamp()+interval '1100 milliseconds'
 where id and next_at<=clock_timestamp();
 return found;
end $$;
revoke all on function public.claim_moment_location_search(uuid) from public,anon;
grant execute on function public.claim_moment_location_search(uuid) to authenticated;
commit;
