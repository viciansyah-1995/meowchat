import getSupabaseClient from '../supabase/client.js';

class ProfileService {
  static async getMyProfile() {
    const supabase = getSupabaseClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) return { success: false, error: authError };

    const userId = authData?.user?.id;
    if (!userId) return { success: false, error: { message: 'User belum login' } };

    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (error) return { success: false, error };
    if (!data) {
      return { success: false, error: { message: 'Profile belum tersedia. Coba ulang beberapa detik lagi.' } };
    }
    return { success: true, data };
  }

  static async searchProfiles(query) {
    const supabase = getSupabaseClient();
    const normalizedQuery = (query || '').trim();
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
