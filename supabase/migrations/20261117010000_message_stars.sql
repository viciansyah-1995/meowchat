begin;

create table public.message_stars (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  starred_at timestamptz not null default now(),
  primary key (profile_id, message_id)
);

create index message_stars_recent_idx on public.message_stars (profile_id, starred_at desc, message_id desc);
create index message_stars_message_idx on public.message_stars (message_id);

alter table public.message_stars enable row level security;
revoke all on public.message_stars from anon, authenticated;
grant select, insert, delete on public.message_stars to authenticated;

create policy "message_stars_select_own_visible"
on public.message_stars for select to authenticated
using (
  profile_id = (select auth.uid())
  and exists (select 1 from public.messages where id = message_stars.message_id)
);

create policy "message_stars_insert_own_visible"
on public.message_stars for insert to authenticated
with check (
  profile_id = (select auth.uid())
  and exists (select 1 from public.messages where id = message_stars.message_id)
);

create policy "message_stars_delete_own"
on public.message_stars for delete to authenticated
using (profile_id = (select auth.uid()));

commit;
