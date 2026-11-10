begin;

-- A sender can see receipts from the other participants in their own chat.
drop policy if exists "message_reads_select_sender" on public.message_reads;
create policy "message_reads_select_sender"
on public.message_reads
for select
to authenticated
using (
  exists (
    select 1
    from public.messages as message
    join public.chat_participants as reader on reader.chat_id = message.chat_id
    where message.id = message_reads.message_id
      and message.sender_id = (select auth.uid())
      and reader.profile_id = message_reads.profile_id
      and reader.profile_id <> message.sender_id
  )
);

-- A receipt must belong to the current user and point to a visible incoming message.
drop policy if exists "message_reads_insert_visible_incoming" on public.message_reads;
create policy "message_reads_insert_visible_incoming"
on public.message_reads
as restrictive
for insert
to authenticated
with check (
  profile_id = (select auth.uid())
  and exists (
    select 1
    from public.messages as message
    where message.id = message_reads.message_id
      and message.sender_id <> (select auth.uid())
  )
);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'message_reads'
  ) then
    alter publication supabase_realtime add table public.message_reads;
  end if;
end;
$$;

commit;
