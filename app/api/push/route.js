import { createClient } from '@supabase/supabase-js';
import { sendNotification } from 'web-push';

export const maxDuration = 20;

const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

function pushConfig() {
  const { WEB_PUSH_PUBLIC_KEY, WEB_PUSH_PRIVATE_KEY, WEB_PUSH_SUBJECT, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL } = process.env;
  if (!WEB_PUSH_PUBLIC_KEY || !WEB_PUSH_PRIVATE_KEY || !WEB_PUSH_SUBJECT || !SUPABASE_SERVICE_ROLE_KEY || !NEXT_PUBLIC_SUPABASE_URL) return null;
  return {
    url: NEXT_PUBLIC_SUPABASE_URL,
    serviceKey: SUPABASE_SERVICE_ROLE_KEY,
    vapid: { subject: WEB_PUSH_SUBJECT, publicKey: WEB_PUSH_PUBLIC_KEY, privateKey: WEB_PUSH_PRIVATE_KEY },
  };
}

function json(data, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

function validEndpoint(endpoint) {
  if (typeof endpoint !== 'string' || endpoint.length > 2048) return false;
  try {
    const url = new URL(endpoint);
    return url.protocol === 'https:' && !url.port && !url.username && !url.password && !url.hash && (
      ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com'].includes(url.hostname)
      || url.hostname.endsWith('.push.apple.com') || url.hostname.endsWith('.notify.windows.com')
    );
  } catch {
    return false;
  }
}

async function authorize(request) {
  const config = pushConfig();
  if (!config) return { response: json({ error: 'Notifikasi belum dikonfigurasi.' }, 503) };
  const token = request.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) return { response: json({ error: 'Silakan masuk kembali.' }, 401) };
  const supabase = createClient(config.url, config.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return { response: json({ error: 'Silakan masuk kembali.' }, 401) };
  return { config, supabase, userId: data.user.id };
}

export function GET() {
  const config = pushConfig();
  return json({ publicKey: config?.vapid.publicKey ?? null });
}

export async function PUT(request) {
  const auth = await authorize(request);
  if (auth.response) return auth.response;
  const body = await request.json().catch(() => null);
  const { endpoint, keys } = body || {};
  if (!validEndpoint(endpoint) || typeof keys?.p256dh !== 'string' || typeof keys?.auth !== 'string'
    || !/^[A-Za-z0-9_-]{87}$/.test(keys.p256dh) || !/^[A-Za-z0-9_-]{22}$/.test(keys.auth)) {
    return json({ error: 'Langganan notifikasi tidak valid.' }, 400);
  }

  const { error } = await auth.supabase.from('push_subscriptions').upsert({
    endpoint,
    profile_id: auth.userId,
    p256dh: keys.p256dh,
    auth_key: keys.auth,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'endpoint' });
  return error ? json({ error: 'Gagal menyimpan notifikasi.' }, 500) : json({ enabled: true });
}

export async function DELETE(request) {
  const auth = await authorize(request);
  if (auth.response) return auth.response;
  const body = await request.json().catch(() => null);
  if (!validEndpoint(body?.endpoint)) return json({ error: 'Langganan tidak valid.' }, 400);

  const { error } = await auth.supabase.from('push_subscriptions').delete()
    .eq('endpoint', body.endpoint).eq('profile_id', auth.userId);
  return error ? json({ error: 'Gagal menonaktifkan notifikasi.' }, 500) : json({ enabled: false });
}

export async function POST(request) {
  const auth = await authorize(request);
  if (auth.response) return auth.response;
  const body = await request.json().catch(() => null);
  if (typeof body?.chatId !== 'string' || !uuid.test(body.chatId)) {
    return json({ error: 'Room chat tidak valid.' }, 400);
  }

  const { data, error } = await auth.supabase.rpc('claim_chat_ping', {
    p_chat_id: body.chatId,
    p_sender_id: auth.userId,
  });
  if (error || !data) return json({ error: 'Gagal mengirim PING.' }, 500);
  if (data.status === 'forbidden') return json({ error: 'Room chat tidak tersedia.' }, 403);
  if (data.status === 'rate_limited') return json({ error: 'Tunggu 30 detik sebelum mengirim PING lagi.' }, 429);

  const targets = data.subscriptions.filter((subscription) => validEndpoint(subscription.endpoint));
  const payload = JSON.stringify({ type: 'chat-ping' });
  const outcomes = await Promise.allSettled(targets.map(async (subscription) => {
    try {
      await sendNotification(subscription, payload, {
        vapidDetails: auth.config.vapid, TTL: 300, urgency: 'high', timeout: 5000,
      });
      return true;
    } catch (cause) {
      if (cause.statusCode === 404 || cause.statusCode === 410) {
        await auth.supabase.from('push_subscriptions').delete()
          .eq('endpoint', subscription.endpoint).eq('p256dh', subscription.keys.p256dh);
      }
      return false;
    }
  }));
  return json({
    pushed: outcomes.some((outcome) => outcome.status === 'fulfilled' && outcome.value),
    targetCount: targets.length,
  });
}
