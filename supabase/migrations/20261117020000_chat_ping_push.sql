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

create table public.push_server_config (
  singleton boolean primary key default true check (singleton),
  secret_hash bytea not null check (octet_length(secret_hash) = 32)
);

alter table public.push_subscriptions enable row level security;
alter table public.chat_ping_limits enable row level security;
alter table public.push_server_config enable row level security;
revoke all on public.push_subscriptions, public.chat_ping_limits, public.push_server_config from public, anon, authenticated;

create function public.require_push_server(p_server_secret text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.push_server_config
    where secret_hash = sha256(convert_to(p_server_secret, 'UTF8'))
  ) then
    raise insufficient_privilege using message = 'Push service is unauthorized';
  end if;
end;
$$;

create function public.manage_push_subscription(
  p_server_secret text, p_action text, p_endpoint text,
  p_p256dh text default null, p_auth_key text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_push_server(p_server_secret);
  if p_action = 'subscribe' then
    insert into public.push_subscriptions (endpoint, profile_id, p256dh, auth_key)
    values (p_endpoint, (select auth.uid()), p_p256dh, p_auth_key)
    on conflict (endpoint) do update set
      profile_id = excluded.profile_id, p256dh = excluded.p256dh,
      auth_key = excluded.auth_key, updated_at = now();
  elsif p_action = 'unsubscribe' then
    delete from public.push_subscriptions
    where endpoint = p_endpoint and profile_id = (select auth.uid());
  elsif p_action = 'expire' then
    delete from public.push_subscriptions where endpoint = p_endpoint and p256dh = p_p256dh;
  else
    raise invalid_parameter_value using message = 'Unknown push action';
  end if;
end;
$$;

create function public.claim_chat_ping(p_chat_id uuid, p_server_secret text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  subscriptions jsonb;
  sender_id uuid := (select auth.uid());
begin
  perform public.require_push_server(p_server_secret);
  if not exists (
    select 1 from public.chat_participants
    where chat_id = p_chat_id and profile_id = sender_id
  ) then
    return jsonb_build_object('status', 'forbidden');
  end if;

  insert into public.chat_ping_limits (profile_id, sent_at)
  values (sender_id, now())
  on conflict (profile_id) do update set sent_at = excluded.sent_at
  where chat_ping_limits.sent_at <= now() - interval '30 seconds';

  if not found then
    return jsonb_build_object('status', 'rate_limited');
  end if;

  insert into public.messages (chat_id, sender_id, message_type, content)
  values (p_chat_id, sender_id, 'text', 'PING!');

  select coalesce(jsonb_agg(jsonb_build_object(
    'endpoint', target.endpoint,
    'keys', jsonb_build_object('p256dh', target.p256dh, 'auth', target.auth_key)
  )), '[]'::jsonb) into subscriptions
  from (
    select s.endpoint, s.p256dh, s.auth_key
    from public.chat_participants p
    join public.push_subscriptions s on s.profile_id = p.profile_id
    where p.chat_id = p_chat_id and p.profile_id <> sender_id
    order by s.updated_at desc
    limit 20
  ) target;

  return jsonb_build_object('status', 'ok', 'subscriptions', subscriptions);
end;
$$;

revoke all on function public.require_push_server(text) from public, anon, authenticated;
revoke all on function public.manage_push_subscription(text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.claim_chat_ping(uuid, text) from public, anon, authenticated;
grant execute on function public.manage_push_subscription(text, text, text, text, text) to authenticated;
grant execute on function public.claim_chat_ping(uuid, text) to authenticated;

commit;
