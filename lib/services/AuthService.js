import { getUsers, setUsers, getCurrentUser, setCurrentUser } from '../storage/index.js';
import { generateId } from '../utils/generateId.js';

// ============================================
// Validation
// ============================================
const Validation = {
  username: {
    min: 3,
    max: 20,
    pattern: /^[a-zA-Z0-9_]+$/,
    validate(username) {
      const errors = [];
      if (username.length < this.min) errors.push(`username terlalu pendek (min ${this.min} karakter)`);
      if (username.length > this.max) errors.push(`username terlalu panjang (max ${this.max} karakter)`);
      if (!this.pattern.test(username)) errors.push('username hanya boleh huruf, angka, dan underscore');
      return errors;
    }
  },
  password: {
    min: 6,
    validate(password) {
      const errors = [];
      if (password.length < this.min) errors.push(`password terlalu pendek (min ${this.min} karakter)`);
      return errors;
    }
  },
  displayName: {
    min: 1,
    max: 50,
    validate(displayName) {
      const errors = [];
      if (displayName.length < this.min) errors.push('nama tidak boleh kosong');
      if (displayName.length > this.max) errors.push(`nama terlalu panjang (max ${this.max} karakter)`);
      return errors;
    }
  }
};

// ============================================
// Auth Service
// ============================================
class AuthService {
  // Register new user
  static register(username, password, displayName) {
    // Validate
    const allErrors = [
      ...Validation.username.validate(username),
      ...Validation.password.validate(password),
      ...Validation.displayName.validate(displayName)
    ];
    
    if (allErrors.length > 0) {
      return { success: false, errors: allErrors };
    }
    
    // Check if username exists
    const users = getUsers();
    if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
      return { success: false, errors: ['Username sudah digunakan'] };
    }
    
    // Create user
    const user = {
      id: generateId('user'),
      username,
      password,
      displayName,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    users.push(user);
    setUsers(users);
    
    // Auto login
    setCurrentUser(user);
    
    return { success: true, user };
  }
  
  // Login
  static login(username, password) {
    const users = getUsers();
    const user = users.find(u => 
      u.username.toLowerCase() === username.toLowerCase() && 
      u.password === password
    );
    
    if (!user) {
      return { success: false, errors: ['Username atau password salah'] };
    }
    
    setCurrentUser(user);
    return { success: true, user };
  }
  
  // Logout
  static logout() {
    setCurrentUser(null);
    return { success: true };
  }
  
  // Get current user
  static getCurrentUser() {
    return getCurrentUser();
  }
  
  // Check if authenticated
  static isAuthenticated() {
    return getCurrentUser() !== null;
  }
  
  // Get all users (for contact search)
  static getAllUsers() {
    return getUsers();
  }
  
  // Find user by username
  static findByUsername(username) {
    const users = getUsers();
    return users.find(u => u.username.toLowerCase() === username.toLowerCase());
  }
  
  // Find user by ID
  static findById(id) {
    const users = getUsers();
    return users.find(u => u.id === id);
  }
}

export default AuthService;