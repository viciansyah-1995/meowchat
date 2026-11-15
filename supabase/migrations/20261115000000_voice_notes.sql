begin;

alter table public.messages
  add column voice_path text,
  add column voice_duration_seconds smallint,
  drop constraint messages_type_valid,
  drop constraint messages_payload_check,
  add constraint messages_type_valid check (message_type in ('text', 'image', 'voice')),
  add constraint messages_payload_check check (
    case message_type
      when 'text' then content is not null and length(trim(content)) > 0
      when 'image' then image_url is not null
      when 'voice' then voice_path is not null
        and voice_duration_seconds is not null
        and voice_duration_seconds between 1 and 60
        and voice_path in (
          chat_id::text || '/' || sender_id::text || '/' || id::text || '.webm',
          chat_id::text || '/' || sender_id::text || '/' || id::text || '.m4a',
          chat_id::text || '/' || sender_id::text || '/' || id::text || '.ogg'
        )
      else false
    end
    and (message_type = 'voice' or (voice_path is null and voice_duration_seconds is null))
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-voice', 'chat-voice', false, 5242880, array['audio/webm', 'audio/mp4', 'audio/ogg']);

-- Scope uploads to the signed-in participant's folder in that conversation.
create policy "voice_upload_by_participant"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'chat-voice'
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and exists (
    select 1 from public.chat_participants
    where profile_id = (select auth.uid())
      and chat_id::text = (storage.foldername(name))[1]
  )
);

-- Message RLS limits this lookup to participants. Draft uploads have no visible message.
create policy "voice_read_by_participant"
on storage.objects for select to authenticated
using (bucket_id = 'chat-voice');

-- Keep this bucket private even if another Storage policy allows broader reads.
create policy "voice_require_visible_message"
on storage.objects as restrictive for select to public
using (
  bucket_id <> 'chat-voice'
  or exists (
    select 1 from public.messages
    where message_type = 'voice' and voice_path = storage.objects.name
  )
);

create unique index messages_voice_path_idx on public.messages (voice_path)
where message_type = 'voice';

commit;
