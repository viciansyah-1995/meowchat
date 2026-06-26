import getSupabaseClient from '../supabase/client.js';
const supabase = getSupabaseClient();

class SupabaseChatService {
  static async getOrCreateDirectChat(otherProfileId) {
    const debug = ['open chat start'];

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) {
      return { success: false, error: authError, debug: [...debug, `auth.getUser.error=${JSON.stringify(authError)}`] };
    }

    const currentUser = authData?.user;
    debug.push(`currentUser.id=${currentUser?.id || 'null'}`);
    debug.push(`otherProfileId=${otherProfileId}`);

    if (!currentUser) {
      return { success: false, error: { message: 'User belum login' }, debug };
    }

    const rpcResult = await supabase.rpc('create_or_get_direct_chat', {
      other_profile_id: otherProfileId,
    });

    if (rpcResult.error) {
      debug.push(`rpc.error=${JSON.stringify(rpcResult.error)}`);
      return { success: false, error: rpcResult.error, debug };
    }

    const row = Array.isArray(rpcResult.data) ? rpcResult.data[0] : rpcResult.data;
    debug.push(`rpc.data=${JSON.stringify(row)}`);

    if (!row?.out_chat_id) {
      return {
        success: false,
        error: { message: 'RPC berhasil dipanggil tapi out_chat_id tidak dikembalikan' },
        debug,
      };
    }

    const chatResult = await supabase
      .from('chats')
      .select('id, type, direct_chat_key, created_by, created_at')
      .eq('id', row.out_chat_id)
      .maybeSingle();

    if (chatResult.error) {
      debug.push(`chatResult.error=${JSON.stringify(chatResult.error)}`);
      return { success: false, error: chatResult.error, debug };
    }

    if (!chatResult.data) {
      debug.push('chatResult.data=null');
      return {
        success: false,
        error: { message: 'Chat berhasil dibuat, tapi gagal dibaca ulang setelah RPC' },
        debug,
      };
    }

    debug.push(`chat ready => ${chatResult.data.id}`);
    return {
      success: true,
      data: chatResult.data,
      created: Boolean(row?.out_created_new),
      debug,
    };
  }

  static async getMessages(chatId) {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });

    if (error) return { success: false, error };
    return { success: true, data };
  }

  static async sendTextMessage(chatId, content) {
    const { data: authData } = await supabase.auth.getUser();
    const currentUser = authData?.user;
    if (!currentUser) {
      return { success: false, error: { message: 'User belum login' } };
    }

    const { data, error } = await supabase
      .from('messages')
      .insert({
        chat_id: chatId,
        sender_id: currentUser.id,
        message_type: 'text',
        content,
      })
      .select()
      .single();

    if (error) return { success: false, error };
    return { success: true, data };
  }

  static subscribeMessages(chatId, onInsert) {
    const channel = supabase
      .channel(`chat:${chatId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => onInsert(payload.new)
      )
      .subscribe();

    return channel;
  }

  static unsubscribe(channel) {
    if (channel) supabase.removeChannel(channel);
  }
}

export default SupabaseChatService;
