-- =====================================================
-- MeowTrack Chat - Supabase Schema
-- Auth: email + password
-- Public identity: username + display_name
-- =====================================================

create extension if not exists pgcrypto;

-- =====================================================
-- profiles
-- =====================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text not null,
  avatar_url text,
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint username_format check (username ~ '^[A-Za-z0-9_]{3,20}$')
);

create index if not exists idx_profiles_username on public.profiles (username);

-- =====================================================
-- contacts
-- =====================================================
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  contact_profile_id uuid not null references public.profiles(id) on delete cascade,
  nickname text,
  created_at timestamptz not null default now(),
  unique(owner_id, contact_profile_id),
  constraint contacts_not_self check (owner_id <> contact_profile_id)
);

create index if not exists idx_contacts_owner on public.contacts (owner_id);
create index if not exists idx_contacts_contact_profile on public.contacts (contact_profile_id);

-- =====================================================
-- chats
-- =====================================================
create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'direct',
  direct_chat_key text unique,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint chats_type_valid check (type in ('direct'))
);

create index if not exists idx_chats_direct_key on public.chats (direct_chat_key);

-- =====================================================
-- chat_participants
-- =====================================================
create table if not exists public.chat_participants (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique(chat_id, profile_id)
);

create index if not exists idx_chat_participants_chat on public.chat_participants (chat_id);
create index if not exists idx_chat_participants_profile on public.chat_participants (profile_id);

-- =====================================================
-- messages
-- =====================================================
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  message_type text not null default 'text',
  content text,
  image_url text,
  reply_to_message_id uuid references public.messages(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint messages_type_valid check (message_type in ('text', 'image')),
  constraint messages_payload_check check (
    (message_type = 'text' and content is not null and length(trim(content)) > 0)
    or
    (message_type = 'image' and image_url is not null)
  )
);

create index if not exists idx_messages_chat_created_at on public.messages (chat_id, created_at);
create index if not exists idx_messages_sender on public.messages (sender_id);

-- =====================================================
-- message_reads
-- =====================================================
create table if not exists public.message_reads (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  unique(message_id, profile_id)
);

create index if not exists idx_message_reads_profile on public.message_reads (profile_id);
create index if not exists idx_message_reads_message on public.message_reads (message_id);

-- =====================================================
-- updated_at helper
-- =====================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- apply updated_at triggers

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_messages_updated_at on public.messages;
create trigger set_messages_updated_at
before update on public.messages
for each row execute function public.set_updated_at();

-- =====================================================
-- auth → profiles trigger
-- =====================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text, 1, 8)),
    coalesce(new.raw_user_meta_data->>'display_name', 'New User')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- =====================================================
-- helper: check chat participant
-- =====================================================
create or replace function public.is_chat_participant(_chat_id uuid, _profile_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.chat_participants cp
    where cp.chat_id = _chat_id
      and cp.profile_id = _profile_id
  );
$$;

-- =====================================================
-- RLS enable
-- =====================================================
alter table public.profiles enable row level security;
alter table public.contacts enable row level security;
alter table public.chats enable row level security;
alter table public.chat_participants enable row level security;
alter table public.messages enable row level security;
alter table public.message_reads enable row level security;

-- =====================================================
-- profiles policies
-- =====================================================
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
on public.profiles
for select
to authenticated
using (true);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- =====================================================
-- contacts policies
-- =====================================================
drop policy if exists "contacts_select_own" on public.contacts;
create policy "contacts_select_own"
on public.contacts
for select
to authenticated
using (owner_id = auth.uid());

drop policy if exists "contacts_insert_own" on public.contacts;
create policy "contacts_insert_own"
on public.contacts
for insert
to authenticated
with check (owner_id = auth.uid());

drop policy if exists "contacts_delete_own" on public.contacts;
create policy "contacts_delete_own"
on public.contacts
for delete
to authenticated
using (owner_id = auth.uid());

-- =====================================================
-- chats policies
-- =====================================================
drop policy if exists "chats_select_participant" on public.chats;
create policy "chats_select_participant"
on public.chats
for select
to authenticated
using (public.is_chat_participant(id, auth.uid()));

drop policy if exists "chats_insert_authenticated" on public.chats;
create policy "chats_insert_authenticated"
on public.chats
for insert
to authenticated
with check (created_by = auth.uid());

-- =====================================================
-- chat_participants policies
-- =====================================================
drop policy if exists "chat_participants_select_own_chats" on public.chat_participants;
create policy "chat_participants_select_own_chats"
on public.chat_participants
for select
to authenticated
using (public.is_chat_participant(chat_id, auth.uid()));

drop policy if exists "chat_participants_insert_if_creator" on public.chat_participants;
create policy "chat_participants_insert_if_creator"
on public.chat_participants
for insert
to authenticated
with check (
  exists (
    select 1 from public.chats c
    where c.id = chat_id
      and c.created_by = auth.uid()
  )
);

-- =====================================================
-- messages policies
-- =====================================================
drop policy if exists "messages_select_participant" on public.messages;
create policy "messages_select_participant"
on public.messages
for select
to authenticated
using (public.is_chat_participant(chat_id, auth.uid()));

drop policy if exists "messages_insert_sender_participant" on public.messages;
create policy "messages_insert_sender_participant"
on public.messages
for insert
to authenticated
with check (
  sender_id = auth.uid()
  and public.is_chat_participant(chat_id, auth.uid())
);

-- =====================================================
-- message_reads policies
-- =====================================================
drop policy if exists "message_reads_select_own" on public.message_reads;
create policy "message_reads_select_own"
on public.message_reads
for select
to authenticated
using (profile_id = auth.uid());

drop policy if exists "message_reads_insert_own" on public.message_reads;
create policy "message_reads_insert_own"
on public.message_reads
for insert
to authenticated
with check (profile_id = auth.uid());

-- =====================================================
-- realtime publication
-- =====================================================
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.chats;
alter publication supabase_realtime add table public.chat_participants;
