import getSupabaseClient from '../supabase/client.js';

const MESSAGE_PAGE_SIZE = 100;
const VOICE_BUCKET = 'chat-voice';
const FILE_BUCKET = 'chat-files';

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

  static async getMessages(chatId, before = null, mediaOnly = false) {
    const supabase = getSupabaseClient();
    let query = supabase.from('messages').select('*').eq('chat_id', chatId);
    if (mediaOnly) query = query.in('message_type', ['image', 'file', 'voice']);
    if (before) {
      query = query.or(`created_at.lt.${before.created_at},and(created_at.eq.${before.created_at},id.lt.${before.id})`);
    }
    const pageSize = mediaOnly ? 30 : MESSAGE_PAGE_SIZE;
    const { data, error } = await query
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(pageSize + 1);
    if (error) return { success: false, error };
    const page = data.slice(0, pageSize);
    return {
      success: true,
      olderCursor: data.length > pageSize ? page.at(-1) : null,
      data: mediaOnly ? page : page.reverse(),
    };
  }

  static async getMedia(chatId, before = null) {
    return this.getMessages(chatId, before, true);
  }

  static async getStarredMessages(userId, chatId, before = null) {
    let query = getSupabaseClient().from('message_stars')
      .select('message_id, starred_at, message:messages!inner(*)')
      .eq('profile_id', userId);
    if (chatId) query = query.eq('message.chat_id', chatId);
    if (before) {
      query = query.or(`starred_at.lt.${before.starred_at},and(starred_at.eq.${before.starred_at},message_id.lt.${before.message_id})`);
    }
    const pageSize = 30;
    const { data, error } = await query.order('starred_at', { ascending: false })
      .order('message_id', { ascending: false }).limit(pageSize + 1);
    if (error) return { success: false, error };
    const page = data.slice(0, pageSize);
    const last = page.at(-1);
    return {
      success: true,
      data: page.map((row) => row.message),
      olderCursor: data.length > pageSize ? { starred_at: last.starred_at, message_id: last.message_id } : null,
    };
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

  static async sendFileMessage(chatId, attachment, replyToMessageId = null) {
    const supabase = getSupabaseClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    const senderId = authData?.user?.id;
    if (!senderId) return { success: false, error: authError };

    const path = `${chatId}/${senderId}/${attachment.id}`;
    const bytes = await attachment.file.arrayBuffer();
    const { error: uploadError } = await supabase.storage.from(FILE_BUCKET).upload(path, bytes, {
      contentType: 'application/octet-stream',
      upsert: false,
    });
    // Keep the same object and message IDs when a user retries after a network failure.
    if (uploadError && uploadError.status !== 409 && !['409', 'Duplicate', 'KeyAlreadyExists'].includes(uploadError.statusCode)) {
      return { success: false, error: uploadError };
    }

    const { error } = await supabase.from('messages').upsert({
      id: attachment.id,
      chat_id: chatId,
      sender_id: senderId,
      message_type: 'file',
      file_path: path,
      file_name: Array.from(attachment.file.name.trim()).slice(0, 255).join('') || 'Lampiran',
      reply_to_message_id: replyToMessageId,
    }, { onConflict: 'id', ignoreDuplicates: true });
    return { success: !error, error };
  }

  static async downloadFile(path) {
    return getSupabaseClient().storage.from(FILE_BUCKET).download(path);
  }

  static async sendVoiceMessage(chatId, recording, replyToMessageId = null) {
    const supabase = getSupabaseClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    const senderId = authData?.user?.id;
    if (!senderId) return { success: false, error: authError };

    const path = `${chatId}/${senderId}/${recording.id}.${recording.extension}`;
    const { error: uploadError } = await supabase.storage.from(VOICE_BUCKET).upload(path, recording.blob, {
      contentType: recording.blob.type.split(';')[0],
      upsert: false,
    });
    // Retrying the same recording can reuse the object if the first upload reached Storage.
    if (uploadError && uploadError.status !== 409 && uploadError.statusCode !== '409') {
      return { success: false, error: uploadError };
    }

    const { error } = await supabase.from('messages').upsert({
      id: recording.id,
      chat_id: chatId,
      sender_id: senderId,
      message_type: 'voice',
      voice_path: path,
      voice_duration_seconds: recording.duration,
      reply_to_message_id: replyToMessageId,
    }, { onConflict: 'id', ignoreDuplicates: true });
    return { success: !error, error };
  }

  static async downloadVoice(path) {
    return getSupabaseClient().storage.from(VOICE_BUCKET).download(path);
  }

  static subscribeChat(chatId, peerId, { onMessage, onRead, onReady }) {
    const supabase = getSupabaseClient();
    const channel = supabase
      .channel(`chat:${chatId}:${crypto.randomUUID()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` }, ({ new: message }) => onMessage(message))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message_reads', filter: `profile_id=eq.${peerId}` }, ({ new: receipt }) => onRead(receipt))
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') onReady();
      });

    return channel;
  }

  static unsubscribe(channel) {
    const supabase = getSupabaseClient();
    if (channel) supabase.removeChannel(channel);
  }
}

export default SupabaseChatService;
