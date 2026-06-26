import getSupabaseClient from '../supabase/client.js';
const supabase = getSupabaseClient();

class SupabaseAuthService {
  static async signUp({ email, password, username, displayName }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          display_name: displayName,
        },
      },
    });

    if (error) {
      return { success: false, error };
    }

    return { success: true, data };
  }

  static async signIn({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { success: false, error };
    }

    return { success: true, data };
  }

  static async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      return { success: false, error };
    }
    return { success: true };
  }

  static async getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      return { success: false, error };
    }
    return { success: true, data };
  }

  static async getUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      return { success: false, error };
    }
    return { success: true, data };
  }

  static onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(callback);
  }
}

export default SupabaseAuthService;
