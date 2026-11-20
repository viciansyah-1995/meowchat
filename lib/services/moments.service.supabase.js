import getSupabaseClient from '../supabase/client.js';
import { MAX_MOMENT_PHOTO_BYTES } from '../compress-moment-photo.js';
const BUCKET = 'room-moments';
export default class MomentsService {
  static async list(chatId, before) {
    const supabase = getSupabaseClient();
    let query = supabase.from('room_moments').select('*').eq('chat_id', chatId).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(20);
    if (before) query = query.or(`created_at.lt.${before.created_at},and(created_at.eq.${before.created_at},id.lt.${before.id})`);
    const { data, error } = await query;
    if (error) throw error;
    if (!data.length) return [];
    const signed = await supabase.storage.from(BUCKET).createSignedUrls(data.map(row => row.photo_path), 900);
    if (signed.error) throw signed.error;
    return data.map(row => ({ ...row, photoUrl: signed.data.find(item => item.path === row.photo_path)?.signedUrl || null }));
  }
  static async create({ chatId, id, place, photo, caption }) {
    const supabase = getSupabaseClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) throw new Error('Masuk kembali untuk menyimpan momen.');
    if (photo.type !== 'image/jpeg' || !photo.size || photo.size > MAX_MOMENT_PHOTO_BYTES) throw new Error('Foto harus dikompres sebelum disimpan.');
    const previous = await supabase.from('room_moments').select('id').eq('id', id).maybeSingle();
    if (previous.error) throw previous.error;
    if (previous.data) return;
    const path = `${chatId}/${auth.user.id}/${id}.jpg`;
    const upload = await supabase.storage.from(BUCKET).upload(path, photo, { contentType: 'image/jpeg', upsert: false });
    if (upload.error && String(upload.error.statusCode) !== '409' && upload.error.error !== 'Duplicate') throw upload.error;
    const result = await supabase.from('room_moments').upsert({ id, chat_id: chatId, place_name: place.name, latitude: place.latitude, longitude: place.longitude, caption: caption.trim(), photo_path: path, photo_bytes: photo.size }, { onConflict: 'id', ignoreDuplicates: true });
    if (result.error) {
      // Unknown network failures may have committed. Retain the upload for an idempotent retry.
      if (['23514','42501','23503'].includes(result.error.code)) await supabase.storage.from(BUCKET).remove([path]);
      throw result.error;
    }
  }
  static async photo(path) {
    const { data, error } = await getSupabaseClient().storage.from(BUCKET).createSignedUrl(path, 900);
    if (error) throw error;
    return data.signedUrl;
  }
  static async search(chatId, query, signal) {
    const { data, error } = await getSupabaseClient().auth.getSession();
    if (error || !data.session) throw new Error('Masuk kembali untuk mencari tempat.');
    const response = await fetch('/api/places', { method: 'POST', headers: { Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ chatId, query }), signal });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Belum bisa mencari tempat.');
    return result.places;
  }
}
