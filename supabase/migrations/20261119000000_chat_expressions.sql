begin;

alter table public.messages
  add column expression_key text,
  drop constraint messages_type_valid,
  drop constraint messages_payload_check,
  add constraint messages_type_valid check (message_type in ('text', 'image', 'voice', 'file', 'reaction', 'sticker')),
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
      when 'reaction' then expression_key is not null and expression_key in ('love', 'kiss', 'sad')
        and content is null and image_url is null
      when 'sticker' then expression_key is not null and expression_key in ('happy', 'love', 'sad', 'angry', 'sleepy')
        and content is null and image_url is null
      else false
    end
    and (message_type in ('reaction', 'sticker') or expression_key is null)
    and (message_type = 'voice' or (voice_path is null and voice_duration_seconds is null))
    and (message_type = 'file' or (file_path is null and file_name is null))
  );

commit;
