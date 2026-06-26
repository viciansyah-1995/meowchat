import { getContacts, setContacts, getCurrentUser } from '../storage/index.js';
import { generateId } from '../utils/generateId.js';
import AuthService from './AuthService.js';

// ============================================
// Contact Service
// ============================================
class ContactService {
  // Get contacts for current user
  static getContacts() {
    const user = getCurrentUser();
    if (!user) return [];
    
    const allContacts = getContacts();
    return allContacts.filter(c => c.userId === user.id);
  }
  
  // Add contact by username
  static addContact(username) {
    const user = getCurrentUser();
    if (!user) {
      return { success: false, errors: ['Silakan login terlebih dahulu'] };
    }
    
    // Find target user
    const targetUser = AuthService.findByUsername(username);
    if (!targetUser) {
      return { success: false, errors: ['User tidak ditemukan'] };
    }
    
    if (targetUser.id === user.id) {
      return { success: false, errors: ['Tidak bisa menambahkan diri sendiri'] };
    }
    
    // Check if already added
    const contacts = getContacts();
    if (contacts.find(c => c.userId === user.id && c.contactUserId === targetUser.id)) {
      return { success: false, errors: ['User sudah ada di kontak'] };
    }
    
    // Create contact
    const contact = {
      id: generateId('contact'),
      userId: user.id,
      contactUserId: targetUser.id,
      contactUsername: targetUser.username,
      contactDisplayName: targetUser.displayName,
      addedAt: Date.now()
    };
    
    contacts.push(contact);
    setContacts(contacts);
    
    return { success: true, contact };
  }
  
  // Remove contact
  static removeContact(contactId) {
    const contacts = getContacts();
    const filtered = contacts.filter(c => c.id !== contactId);
    setContacts(filtered);
    return { success: true };
  }
  
  // Get contact by user ID
  static getContactByUserId(targetUserId) {
    const user = getCurrentUser();
    if (!user) return null;
    
    const contacts = getContacts();
    return contacts.find(c => c.userId === user.id && c.contactUserId === targetUserId);
  }
  
  // Search contacts
  static searchContacts(query) {
    const contacts = this.getContacts();
    const q = query.toLowerCase();
    return contacts.filter(c => 
      c.contactDisplayName.toLowerCase().includes(q) ||
      c.contactUsername.toLowerCase().includes(q)
    );
  }
}

export default ContactService;