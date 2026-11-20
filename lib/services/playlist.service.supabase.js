import getSupabaseClient from '../supabase/client.js';
import { spotifyTrackId } from '../playlist-links.js';

export default class PlaylistService {
  static async list(before) {
    let query = getSupabaseClient().from('room_playlists').select('*').order('created_at', { ascending: false }).order('id', { ascending: false }).limit(50);
    if (before) query = query.or(`created_at.lt.${before.created_at},and(created_at.eq.${before.created_at},id.lt.${before.id})`);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  }
  static async tracks(playlistId, limit = 50) {
    const { data, error } = await getSupabaseClient().from('playlist_tracks').select('*').eq('playlist_id', playlistId)
      .order('created_at', { ascending: false }).order('id', { ascending: false }).range(0, limit - 1);
    if (error) throw error;
    return data;
  }
  static async create(chatId, name) {
    const { data, error } = await getSupabaseClient().from('room_playlists').insert({ chat_id: chatId, name: name.trim() }).select().single();
    if (error) throw error;
    return data;
  }
  static async saveTrack(playlistId, form, trackId) {
    const values = { title: form.title.trim(), artist: form.artist.trim(), memory_notes: form.notes.trim() };
    if (!values.title || !values.artist || !values.memory_notes) throw new Error('Isi judul, penyanyi, dan ceritamu dulu, ya.');
    const supabase = getSupabaseClient();
    let query;
    if (trackId) query = supabase.from('playlist_tracks').update(values).eq('id', trackId).eq('playlist_id', playlistId);
    else {
      const spotifyId = spotifyTrackId(form.url);
      if (!spotifyId) throw new Error('Tempel link lagu lengkap dari Spotify, ya: https://open.spotify.com/track/…');
      query = supabase.from('playlist_tracks').insert({ ...values, playlist_id: playlistId, spotify_track_id: spotifyId });
    }
    const { data, error } = await query.select().single();
    if (error?.code === '23505') throw new Error('Lagu ini sudah ada di playlist kita ♡');
    if (error) throw error;
    return data;
  }
  static async removeTrack(id) {
    const { data, error } = await getSupabaseClient().from('playlist_tracks').delete().eq('id', id).select('id');
    if (error) throw error;
    if (!data?.length) throw new Error('Lagunya belum bisa dilepas. Coba cek yang baru dulu, ya.');
  }
}
