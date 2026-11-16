begin;

alter table public.messages
  add column file_path text,
  add column file_name text,
  drop constraint messages_type_valid,
  drop constraint messages_payload_check,
  add constraint messages_type_valid check (message_type in ('text', 'image', 'voice', 'file')),
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
      when 'file' then file_path is not null
        and file_path = chat_id::text || '/' || sender_id::text || '/' || id::text
        and file_name is not null and length(trim(file_name)) between 1 and 255
        and content is null and image_url is null
      else false
    end
    and (message_type = 'voice' or (voice_path is null and voice_duration_seconds is null))
    and (message_type = 'file' or (file_path is null and file_name is null))
  );

create unique index messages_file_path_idx on public.messages (file_path)
where message_type = 'file';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-files', 'chat-files', false, 10485760, array['application/octet-stream']);

create policy "chat_files_allow_insert"
on storage.objects for insert to authenticated
with check (bucket_id = 'chat-files');

create policy "chat_files_insert_by_participant"
on storage.objects as restrictive for insert to public
with check (
  bucket_id <> 'chat-files'
  or (
    array_length(storage.foldername(name), 1) = 2
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and exists (
      select 1 from public.chat_participants
      where profile_id = (select auth.uid())
        and chat_id::text = (storage.foldername(name))[1]
    )
  )
);

create policy "chat_files_allow_select"
on storage.objects for select to authenticated
using (bucket_id = 'chat-files');

-- A file becomes readable only when a visible chat message references it.
create policy "chat_files_require_visible_message"
on storage.objects as restrictive for select to public
using (
  bucket_id <> 'chat-files'
  or exists (
    select 1 from public.messages
    where message_type = 'file' and file_path = storage.objects.name
  )
);

create policy "chat_files_disallow_update"
on storage.objects as restrictive for update to public
using (bucket_id <> 'chat-files')
with check (bucket_id <> 'chat-files');

create policy "chat_files_disallow_delete"
on storage.objects as restrictive for delete to public
using (bucket_id <> 'chat-files');

commit;
