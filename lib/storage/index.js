import { STORAGE_KEYS, SCHEMA_VERSION } from './keys.js';

// ============================================
// Storage Adapter
// ============================================
class StorageAdapter {
  constructor() {
    this.initialized = false;
  }

  // Initialize and migrate if needed
  init() {
    if (this.initialized) return;
    
    const storedVersion = localStorage.getItem(STORAGE_KEYS.SCHEMA_VERSION);
    if (storedVersion !== SCHEMA_VERSION) {
      this.runMigrations();
    }
    
    this.initialized = true;
  }

  runMigrations() {
    console.log('[Storage] Running migrations...');
    localStorage.setItem(STORAGE_KEYS.SCHEMA_VERSION, SCHEMA_VERSION);
  }

  // Get collection
  getCollection(key) {
    this.init();
    try {
      return JSON.parse(localStorage.getItem(key) || '[]');
    } catch (e) {
      console.error('[Storage] Error getting collection:', key, e);
      return [];
    }
  }

  // Set collection
  setCollection(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (e) {
      console.error('[Storage] Error setting collection:', key, e);
      return false;
    }
  }

  // Find by ID
  findById(collection, id) {
    const data = this.getCollection(collection);
    return data.find(item => item.id === id);
  }

  // Find one
  findOne(collection, predicate) {
    const data = this.getCollection(collection);
    return data.find(predicate);
  }

  // Find many
  findMany(collection, predicate) {
    const data = this.getCollection(collection);
    return data.filter(predicate);
  }

  // Insert
  insert(collection, document) {
    const data = this.getCollection(collection);
    data.push(document);
    return this.setCollection(collection, data) ? document : null;
  }

  // Update
  update(collection, id, updates) {
    const data = this.getCollection(collection);
    const index = data.findIndex(item => item.id === id);
    if (index === -1) return null;
    
    data[index] = { ...data[index], ...updates };
    return this.setCollection(collection, data) ? data[index] : null;
  }

  // Delete
  delete(collection, id) {
    const data = this.getCollection(collection);
    const filtered = data.filter(item => item.id !== id);
    return this.setCollection(collection, filtered);
  }

  // Clear all
  clearAll() {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  }
}

// Singleton instance
export const storage = new StorageAdapter();

// Named exports for convenience
export const getUsers = () => storage.getCollection(STORAGE_KEYS.USERS);
export const setUsers = (users) => storage.setCollection(STORAGE_KEYS.USERS, users);

export const getContacts = () => storage.getCollection(STORAGE_KEYS.CONTACTS);
export const setContacts = (contacts) => storage.setCollection(STORAGE_KEYS.CONTACTS, contacts);

export const getMessages = () => storage.getCollection(STORAGE_KEYS.MESSAGES);
export const setMessages = (messages) => storage.setCollection(STORAGE_KEYS.MESSAGES, messages);

export const getChats = () => storage.getCollection(STORAGE_KEYS.CHATS);
export const setChats = (chats) => storage.setCollection(STORAGE_KEYS.CHATS, chats);

export const getCurrentUser = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.CURRENT_USER) || 'null');
  } catch {
    return null;
  }
};

export const setCurrentUser = (user) => {
  if (user) {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
  } else {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  }
};