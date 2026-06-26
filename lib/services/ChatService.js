import { getMessages, setMessages, getChats, setChats, getCurrentUser } from '../storage/index.js';
import { generateId } from '../utils/generateId.js';

// ============================================
// Chat Service
// ============================================
class ChatService {
  // Get or create chat between two users
  static getOrCreateChat(userId1, userId2) {
    const chats = getChats();
    const participants = [userId1, userId2].sort();
    
    // Find existing chat
    let chat = chats.find(c => {
      const p = [...c.participants].sort();
      return p[0] === participants[0] && p[1] === participants[1];
    });
    
    if (!chat) {
      chat = {
        id: generateId('chat'),
        participants: [userId1, userId2].sort(),
        createdAt: Date.now(),
        lastMessageAt: null,
        lastMessagePreview: null
      };
      chats.push(chat);
      setChats(chats);
    }
    
    return chat;
  }
  
  // Get chat by ID
  static getChatById(chatId) {
    const chats = getChats();
    return chats.find(c => c.id === chatId);
  }
  
  // Get chats for current user
  static getChats() {
    const user = getCurrentUser();
    if (!user) return [];
    
    const chats = getChats();
    return chats.filter(c => c.participants.includes(user.id))
      .sort((a, b) => (b.lastMessageAt || b.createdAt) - (a.lastMessageAt || a.createdAt));
  }
  
  // Get messages for a chat
  static getMessages(contactUserId) {
    const user = getCurrentUser();
    if (!user) return [];
    
    const allMessages = getMessages();
    return allMessages.filter(m =>
      (m.senderId === user.id && m.receiverId === contactUserId) ||
      (m.senderId === contactUserId && m.receiverId === user.id)
    ).sort((a, b) => a.timestamp - b.timestamp);
  }
  
  // Send message
  static sendMessage(receiverId, content, type = 'text', imageUrl = null) {
    const user = getCurrentUser();
    if (!user) {
      return { success: false, errors: ['Silakan login terlebih dahulu'] };
    }
    
    if (!content.trim() && !imageUrl) {
      return { success: false, errors: ['Pesan tidak boleh kosong'] };
    }
    
    // Get or create chat
    const chat = this.getOrCreateChat(user.id, receiverId);
    
    // Create message
    const message = {
      id: generateId('msg'),
      chatId: chat.id,
      senderId: user.id,
      receiverId: receiverId,
      content: content.trim(),
      type,
      imageUrl,
      status: 'sent',
      timestamp: Date.now(),
      readAt: null
    };
    
    const messages = getMessages();
    messages.push(message);
    setMessages(messages);
    
    // Update chat last message
    const chats = getChats();
    const chatIndex = chats.findIndex(c => c.id === chat.id);
    if (chatIndex !== -1) {
      chats[chatIndex].lastMessageAt = message.timestamp;
      chats[chatIndex].lastMessagePreview = type === 'image' ? '📷 Gambar' : content.trim().slice(0, 30);
      setChats(chats);
    }
    
    return { success: true, message };
  }
  
  // Mark message as read
  static markAsRead(messageId) {
    const messages = getMessages();
    const index = messages.findIndex(m => m.id === messageId);
    
    if (index !== -1) {
      messages[index].readAt = Date.now();
      messages[index].status = 'read';
      setMessages(messages);
    }
    
    return { success: true };
  }
  
  // Mark all messages from sender as read
  static markAllAsRead(senderId) {
    const user = getCurrentUser();
    if (!user) return { success: false };
    
    const messages = getMessages();
    let updated = false;
    
    messages.forEach(m => {
      if (m.senderId === senderId && m.receiverId === user.id && !m.readAt) {
        m.readAt = Date.now();
        m.status = 'read';
        updated = true;
      }
    });
    
    if (updated) {
      setMessages(messages);
    }
    
    return { success: true };
  }
  
  // Get unread count from user
  static getUnreadCount(senderId) {
    const user = getCurrentUser();
    if (!user) return 0;
    
    const messages = getMessages();
    return messages.filter(m => 
      m.senderId === senderId && 
      m.receiverId === user.id &&
      !m.readAt
    ).length;
  }
  
  // Get last message with user
  static getLastMessage(contactUserId) {
    const messages = this.getMessages(contactUserId);
    return messages[messages.length - 1];
  }
  
  // Delete message
  static deleteMessage(messageId) {
    const messages = getMessages();
    const filtered = messages.filter(m => m.id !== messageId);
    setMessages(filtered);
    return { success: true };
  }
}

export default ChatService;