import supabase from '../supabase/client.js';

class ProfileEditService {
  static async updateMyProfile({ username, displayName, bio }) {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) return { success: false, error: authError };

    const currentUser = authData?.user;
    if (!currentUser) {
      return { success: false, error: { message: 'User belum login' } };
    }

    const payload = {
      username: username?.trim(),
      display_name: displayName?.trim(),
      bio: bio?.trim() || null,
    };

    const { data, error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', currentUser.id)
      .select()
      .single();

    if (error) return { success: false, error };
    return { success: true, data };
  }
}

export default ProfileEditService;
