# Image Upload via Supabase Storage

## Target bucket
- `chat-media`

## Frontend scope
- pick image from camera/gallery
- validate image type
- max file size: 10 MB
- preview before send
- upload to Supabase Storage
- send message with `message_type = 'image'` and `image_url`

## Required Supabase setup
Run these SQL steps (or equivalent bucket setup in dashboard):

```sql
insert into storage.buckets (id, name, public)
values ('chat-media', 'chat-media', true)
on conflict (id) do nothing;
```

Then create storage policies so authenticated users can upload and read files from `chat-media`.

## Notes
- current implementation sends pure image messages
- caption support can be added later by allowing text + image payload flow
