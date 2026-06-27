import { createClient } from '@supabase/supabase-js';

let cachedClient = null;

export function getSupabaseEnvStatus() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return {
    hasUrl: Boolean(supabaseUrl),
    hasAnonKey: Boolean(supabaseAnonKey),
    urlHost: supabaseUrl ? (() => {
      try {
        return new URL(supabaseUrl).host;
      } catch {
        return 'invalid-url';
      }
    })() : null,
    anonKeyPrefix: supabaseAnonKey ? supabaseAnonKey.slice(0, 12) : null,
  };
}

export function getSupabaseClient() {
  if (cachedClient) return cachedClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase environment variables are missing');
  }

  cachedClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return cachedClient;
}

export default getSupabaseClient;
