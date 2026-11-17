begin;

create table public.push_subscriptions (
  endpoint text primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  p256dh text not null,
  auth_key text not null,
  updated_at timestamptz not null default now()
);

create index push_subscriptions_profile_idx on public.push_subscriptions (profile_id, updated_at desc);

create table public.chat_ping_limits (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  sent_at timestamptz not null
);

alter table public.push_subscriptions enable row level security;
alter table public.chat_ping_limits enable row level security;
revoke all on public.push_subscriptions, public.chat_ping_limits from public, anon, authenticated;
grant select, insert, update, delete on public.push_subscriptions to service_role;
grant select, insert, update on public.chat_ping_limits to service_role;

create function public.claim_chat_ping(p_chat_id uuid, p_sender_id uuid)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  subscriptions jsonb;
begin
  if not exists (
    select 1 from public.chat_participants
    where chat_id = p_chat_id and profile_id = p_sender_id
  ) then
    return jsonb_build_object('status', 'forbidden');
  end if;

  insert into public.chat_ping_limits (profile_id, sent_at)
  values (p_sender_id, now())
  on conflict (profile_id) do update set sent_at = excluded.sent_at
  where chat_ping_limits.sent_at <= now() - interval '30 seconds';

  if not found then
    return jsonb_build_object('status', 'rate_limited');
  end if;

  insert into public.messages (chat_id, sender_id, message_type, content)
  values (p_chat_id, p_sender_id, 'text', 'PING!');

  select coalesce(jsonb_agg(jsonb_build_object(
    'endpoint', target.endpoint,
    'keys', jsonb_build_object('p256dh', target.p256dh, 'auth', target.auth_key)
  )), '[]'::jsonb) into subscriptions
  from (
    select s.endpoint, s.p256dh, s.auth_key
    from public.chat_participants p
    join public.push_subscriptions s on s.profile_id = p.profile_id
    where p.chat_id = p_chat_id and p.profile_id <> p_sender_id
    order by s.updated_at desc
    limit 20
  ) target;

  return jsonb_build_object('status', 'ok', 'subscriptions', subscriptions);
end;
$$;

revoke all on function public.claim_chat_ping(uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_chat_ping(uuid, uuid) to service_role;

commit;
