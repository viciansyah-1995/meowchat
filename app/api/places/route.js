import { createClient } from '@supabase/supabase-js';
export const maxDuration = 15;
const json = (value, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
export async function POST(request) {
  const token = request.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) return json({ error: 'Masuk dulu untuk mencari tempat.' }, 401);
  const { NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: key } = process.env;
  if (!url || !key) return json({ error: 'Pencarian tempat belum siap.' }, 503);
  const supabase = createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return json({ error: 'Sesi berakhir. Masuk kembali, ya.' }, 401);
  const body = await request.json().catch(() => null);
  const query = typeof body?.query === 'string' ? body.query.trim() : '';
  if (query.length < 3 || query.length > 150 || !/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(body?.chatId || '')) return json({ error: 'Tulis nama tempat antara 3–150 karakter.' }, 400);
  const membership = await supabase.rpc('can_view_room_moments', { room_id: body.chatId });
  if (membership.error) return json({ error: 'Pencarian tempat belum siap. Coba lagi nanti.' }, 503);
  if (!membership.data) return json({ error: 'Tempat ini hanya untuk peserta room.' }, 403);
  const gate = await supabase.rpc('claim_moment_location_search', { room_id: body.chatId });
  if (gate.error) return json({ error: 'Pencarian tempat belum siap. Coba lagi nanti.' }, 503);
  if (!gate.data) return json({ error: 'Tunggu sebentar sebelum mencari lagi, ya.' }, 429);
  try {
    const endpoint = new URL(process.env.PHOTON_SEARCH_URL || 'https://photon.komoot.io/api/');
    endpoint.searchParams.set('q', query); endpoint.searchParams.set('limit', '5');
    const response = await fetch(endpoint, { headers: { 'User-Agent': 'Database-Moments/1.0', Accept: 'application/json' }, next: { revalidate: 86400 }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error('upstream');
    const payload = await response.json();
    const places = (payload.features || []).slice(0, 5).flatMap(feature => {
      const p = feature.properties || {};
      const [longitude, latitude] = feature.geometry?.coordinates || [];
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude)>90 || Math.abs(longitude)>180) return [];
      const name = [...new Set([p.name, p.street, p.city, p.state, p.country].filter(value => typeof value === 'string' && value))].join(', ').slice(0, 500);
      return name ? [{ name, latitude, longitude }] : [];
    });
    return json({ places });
  } catch { return json({ error: 'Tempatnya belum ketemu karena layanan sedang sibuk. Coba lagi sebentar, ya.' }, 502); }
}
