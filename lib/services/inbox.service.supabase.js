import getSupabaseClient from '../supabase/client.js';

class InboxService {
  static async getMyInbox() {
    const supabase = getSupabaseClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) return { success: false, error: authError };

    const currentUser = authData?.user;
    if (!currentUser) return { success: false, error: { message: 'User belum login' } };

    const chatsResult = await supabase.from('chat_participants').select('chat_id').eq('profile_id', currentUser.id);
    if (chatsResult.error) return { success: false, error: chatsResult.error };

    const chatIds = [...new Set((chatsResult.data || []).map((row) => row.chat_id))];
    if (chatIds.length === 0) return { success: true, data: [] };

    const items = await Promise.all(
      chatIds.map(async (chatId) => {
        const [chatRes, participantsRes, messagesRes, readsRes] = await Promise.all([
          supabase.from('chats').select('*').eq('id', chatId).maybeSingle(),
          supabase.from('chat_participants').select('profile_id').eq('chat_id', chatId),
          supabase.from('messages').select('*').eq('chat_id', chatId).order('created_at', { ascending: false }).limit(20),
          supabase.from('message_reads').select('message_id, profile_id').eq('profile_id', currentUser.id),
        ]);

        if (chatRes.error) throw chatRes.error;
        if (participantsRes.error) throw participantsRes.error;
        if (messagesRes.error) throw messagesRes.error;
        if (readsRes.error) throw readsRes.error;

        const participantIds = (participantsRes.data || []).map((p) => p.profile_id);
        const otherUserId = participantIds.find((id) => id !== currentUser.id);

        let otherProfile = null;
        if (otherUserId) {
          const otherProfileRes = await supabase.from('profiles').select('id, username, display_name, avatar_url').eq('id', otherUserId).maybeSingle();
          if (otherProfileRes.error) throw otherProfileRes.error;
          otherProfile = otherProfileRes.data;
        } else {
          const lastOtherSenderId = (messagesRes.data || []).find((m) => m.sender_id !== currentUser.id)?.sender_id || null;
          if (lastOtherSenderId) {
            const otherProfileRes = await supabase.from('profiles').select('id, username, display_name, avatar_url').eq('id', lastOtherSenderId).maybeSingle();
            if (otherProfileRes.error) throw otherProfileRes.error;
            otherProfile = otherProfileRes.data;
          }
        }

        const messages = messagesRes.data || [];
        const lastMessage = messages[0] || null;
        const readIds = new Set((readsRes.data || []).map((r) => r.message_id));
        const unreadCount = messages.filter((msg) => msg.sender_id !== currentUser.id && !readIds.has(msg.id)).length;

        return {
          chat: chatRes.data,
          otherProfile,
          fallbackProfile: otherUserId ? { id: otherUserId, username: 'user', display_name: 'Unknown User' } : null,
          lastMessage,
          unreadCount,
        };
      })
    );

    items.sort((a, b) => {
      const aTime = a.lastMessage?.created_at || a.chat?.created_at || '';
      const bTime = b.lastMessage?.created_at || b.chat?.created_at || '';
      return bTime.localeCompare(aTime);
    });

    return { success: true, data: items };
  }

  static async markChatAsRead(chatId) {
    const supabase = getSupabaseClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) return { success: false, error: authError };

    const currentUser = authData?.user;
    if (!currentUser) return { success: false, error: { message: 'User belum login' } };

    const messagesRes = await supabase.from('messages').select('id, sender_id').eq('chat_id', chatId);
    if (messagesRes.error) return { success: false, error: messagesRes.error };

    const unreadIncoming = (messagesRes.data || [])
      .filter((msg) => msg.sender_id !== currentUser.id)
      .map((msg) => ({ message_id: msg.id, profile_id: currentUser.id }));

    if (unreadIncoming.length === 0) return { success: true, data: [] };

    const upsertRes = await supabase
      .from('message_reads')
      .upsert(unreadIncoming, { onConflict: 'message_id,profile_id', ignoreDuplicates: true })
      .select();

    if (upsertRes.error) return { success: false, error: upsertRes.error };
    return { success: true, data: upsertRes.data };
  }
}

export default InboxService;
