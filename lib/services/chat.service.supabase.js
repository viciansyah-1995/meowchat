import getSupabaseClient from '../supabase/client.js';

class SupabaseChatService {
  static async getOrCreateDirectChat(otherProfileId) {
    const supabase = getSupabaseClient();
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

    const rpcResult = await supabase.rpc('create_or_get_direct_chat', { other_profile_id: otherProfileId });
    if (rpcResult.error) {
      debug.push(`rpc.error=${JSON.stringify(rpcResult.error)}`);
      return { success: false, error: rpcResult.error, debug };
    }

    const row = Array.isArray(rpcResult.data) ? rpcResult.data[0] : rpcResult.data;
    debug.push(`rpc.data=${JSON.stringify(row)}`);

    if (!row?.out_chat_id) {
      return { success: false, error: { message: 'RPC berhasil dipanggil tapi out_chat_id tidak dikembalikan' }, debug };
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
      return { success: false, error: { message: 'Chat berhasil dibuat, tapi gagal dibaca ulang setelah RPC' }, debug };
    }

    debug.push(`chat ready => ${chatResult.data.id}`);
    return { success: true, data: chatResult.data, created: Boolean(row?.out_created_new), debug };
  }

  static async getMessages(chatId) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('messages').select('*').eq('chat_id', chatId).order('created_at', { ascending: true });
    if (error) return { success: false, error };
    return { success: true, data };
  }

  static async sendTextMessage(chatId, content, replyToMessageId = null) {
    const supabase = getSupabaseClient();
    const { data: authData } = await supabase.auth.getUser();
    const currentUser = authData?.user;
    if (!currentUser) return { success: false, error: { message: 'User belum login' } };

    const payload = { chat_id: chatId, sender_id: currentUser.id, message_type: 'text', content };
    if (replyToMessageId) payload.reply_to_message_id = replyToMessageId;

    const { data, error } = await supabase
      .from('messages')
      .insert(payload)
      .select()
      .single();

    if (error) return { success: false, error };
    return { success: true, data };
  }

  static async uploadChatImage(file) {
    const supabase = getSupabaseClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) return { success: false, error: authError };

    const currentUser = authData?.user;
    if (!currentUser) return { success: false, error: { message: 'User belum login' } };

    const extension = (file.name?.split('.').pop() || 'jpg').toLowerCase();
    const filePath = `${currentUser.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;

    const uploadRes = await supabase.storage
      .from('chat-media')
      .upload(filePath, file, { upsert: false, contentType: file.type || 'image/jpeg' });

    if (uploadRes.error) return { success: false, error: uploadRes.error };

    const publicUrlRes = supabase.storage.from('chat-media').getPublicUrl(filePath);
    const publicUrl = publicUrlRes?.data?.publicUrl;
    if (!publicUrl) return { success: false, error: { message: 'Upload berhasil tapi public URL tidak tersedia' } };

    return { success: true, data: { path: filePath, publicUrl } };
  }

  static async sendImageMessage(chatId, imageUrl, replyToMessageId = null) {
    const supabase = getSupabaseClient();
    const { data: authData } = await supabase.auth.getUser();
    const currentUser = authData?.user;
    if (!currentUser) return { success: false, error: { message: 'User belum login' } };

    const payload = { chat_id: chatId, sender_id: currentUser.id, message_type: 'image', image_url: imageUrl };
    if (replyToMessageId) payload.reply_to_message_id = replyToMessageId;

    const { data, error } = await supabase
      .from('messages')
      .insert(payload)
      .select()
      .single();

    if (error) return { success: false, error };
    return { success: true, data };
  }

  static subscribeMessages(channelName, chatId, onInsert) {
    const supabase = getSupabaseClient();
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` }, (payload) => onInsert(payload.new))
      .subscribe();

    return channel;
  }

  static unsubscribe(channel) {
    const supabase = getSupabaseClient();
    if (channel) supabase.removeChannel(channel);
  }
}

export default SupabaseChatService;
