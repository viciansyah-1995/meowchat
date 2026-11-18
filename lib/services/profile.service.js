import getSupabaseClient from '../supabase/client.js';

class ProfileService {
  static async getMyProfile(userId, signal) {
    const supabase = getSupabaseClient();
    let query = supabase.from('profiles').select('*').eq('id', userId);
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query.maybeSingle();
    if (error) return { success: false, error };
    if (!data) {
      return { success: false, error: { message: 'Profile belum tersedia. Coba ulang beberapa detik lagi.' } };
    }
    return { success: true, data };
  }

  static async searchProfiles(query) {
    const supabase = getSupabaseClient();
    const normalizedQuery = (query || '').trim().replace(/[\\%_]/g, '\\$&');
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .ilike('username', `%${normalizedQuery}%`)
      .limit(20);

    if (error) return { success: false, error };
    return { success: true, data };
  }
}

export default ProfileService;
