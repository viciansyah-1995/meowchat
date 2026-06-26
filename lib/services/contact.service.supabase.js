import supabase from '../supabase/client.js';

class SupabaseContactService {
  static async getContacts() {
    const { data, error } = await supabase
      .from('contacts')
      .select(`
        id,
        owner_id,
        contact_profile_id,
        nickname,
        created_at,
        contact_profile:profiles!contacts_contact_profile_id_fkey(
          id,
          username,
          display_name,
          avatar_url
        )
      `)
      .order('created_at', { ascending: false });

    if (error) return { success: false, error };
    return { success: true, data };
  }

  static async addContact(contactProfileId, nickname = null) {
    const { data: authData } = await supabase.auth.getUser();
    const currentUser = authData?.user;
    if (!currentUser) {
      return { success: false, error: { message: 'User belum login' } };
    }

    const { data, error } = await supabase
      .from('contacts')
      .insert({
        owner_id: currentUser.id,
        contact_profile_id: contactProfileId,
        nickname,
      })
      .select()
      .single();

    if (error) return { success: false, error };
    return { success: true, data };
  }
}

export default SupabaseContactService;
