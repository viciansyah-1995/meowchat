begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-wallpaper', 'chat-wallpaper', false, 524288, array['image/webp']);

create policy "chat_wallpaper_read_authenticated"
on storage.objects for select to authenticated
using (bucket_id = 'chat-wallpaper' and name = 'chat-wallpaper.webp');

create policy "chat_wallpaper_require_signed_in"
on storage.objects as restrictive for select to public
using (
  bucket_id <> 'chat-wallpaper'
  or (name = 'chat-wallpaper.webp' and (select auth.uid()) is not null)
);

create policy "chat_wallpaper_no_client_insert"
on storage.objects as restrictive for insert to public
with check (bucket_id <> 'chat-wallpaper');

create policy "chat_wallpaper_no_client_update"
on storage.objects as restrictive for update to public
using (bucket_id <> 'chat-wallpaper')
with check (bucket_id <> 'chat-wallpaper');

create policy "chat_wallpaper_no_client_delete"
on storage.objects as restrictive for delete to public
using (bucket_id <> 'chat-wallpaper');

commit;
