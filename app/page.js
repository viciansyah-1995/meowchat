'use client';

import { useState, useEffect, useRef } from 'react';
import AuthService from '../lib/services/AuthService.js';
import ContactService from '../lib/services/ContactService.js';
import ChatService from '../lib/services/ChatService.js';
import { generateId, getInitials, formatTime, formatDate } from '../lib/utils/index.js';

// ============================================
// MAIN APP COMPONENT
// ============================================
export default function MeowTrackChat() {
  // Screen state: 'login', 'register', 'contacts', 'chat'
  const [screen, setScreen] = useState('login');
  const [currentUser, setCurrentUser] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [messages, setMessages] = useState([]);
  
  // Form states
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ username: '', password: '', displayName: '' });
  const [searchQuery, setSearchQuery] = useState('');
  
  // Chat state
  const [activeChat, setActiveChat] = useState(null);
  const [messageInput, setMessageInput] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const messagesEndRef = useRef(null);
  
  // Modal state
  const [showAddContact, setShowAddContact] = useState(false);
  const [addContactQuery, setAddContactQuery] = useState('');

  // ============================================
  // INITIALIZATION
  // ============================================
  useEffect(() => {
    const user = AuthService.getCurrentUser();
    if (user) {
      setCurrentUser(user);
      loadData();
      setScreen('contacts');
    }
  }, []);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeChat]);

  const loadData = () => {
    setContacts(ContactService.getContacts());
    setMessages(ChatService.getMessages(activeChat?.contactUserId));
  };

  // ============================================
  // AUTH HANDLERS
  // ============================================
  const handleRegister = (e) => {
    e.preventDefault();
    setErrorMessage('');
    
    const { username, password, displayName } = registerForm;
    const result = AuthService.register(username, password, displayName);
    
    if (result.success) {
      setCurrentUser(result.user);
      loadData();
      setScreen('contacts');
      setRegisterForm({ username: '', password: '', displayName: '' });
    } else {
      setErrorMessage(result.errors.join(', '));
    }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    setErrorMessage('');
    
    const { username, password } = loginForm;
    const result = AuthService.login(username, password);
    
    if (result.success) {
      setCurrentUser(result.user);
      loadData();
      setScreen('contacts');
      setLoginForm({ username: '', password: '' });
    } else {
      setErrorMessage(result.errors.join(', '));
    }
  };

  const handleLogout = () => {
    AuthService.logout();
    setCurrentUser(null);
    setContacts([]);
    setMessages([]);
    setScreen('login');
  };

  // ============================================
  // CONTACT HANDLERS
  // ============================================
  const handleAddContact = (e) => {
    e.preventDefault();
    setErrorMessage('');
    
    const result = ContactService.addContact(addContactQuery);
    
    if (result.success) {
      setContacts(ContactService.getContacts());
      setShowAddContact(false);
      setAddContactQuery('');
    } else {
      setErrorMessage(result.errors.join(', '));
    }
  };

  const openChat = (contact) => {
    setActiveChat(contact);
    setMessages(ChatService.getMessages(contact.contactUserId));
    setScreen('chat');
  };

  // ============================================
  // MESSAGE HANDLERS
  // ============================================
  const handleSendMessage = () => {
    if (!messageInput.trim()) return;
    
    const result = ChatService.sendMessage(
      activeChat.contactUserId,
      messageInput,
      'text',
      null
    );
    
    if (result.success) {
      setMessages(ChatService.getMessages(activeChat.contactUserId));
      setMessageInput('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleImageUrl = () => {
    const url = prompt('Masukkan URL gambar:');
    if (url) {
      const result = ChatService.sendMessage(
        activeChat.contactUserId,
        '',
        'image',
        url
      );
      
      if (result.success) {
        setMessages(ChatService.getMessages(activeChat.contactUserId));
      }
    }
  };

  // ============================================
  // SCREENS
  // ============================================
  const renderLogin = () => (
    <div className="screen active" id="login-screen">
      <div className="auth-container">
        <div className="auth-logo">
          <h2>MeowTrack Chat</h2>
          <p>Chat tanpa nomor HP</p>
        </div>
        
        {errorMessage && (
          <div className="error-message">{errorMessage}</div>
        )}
        
        <form className="auth-form" onSubmit={handleLogin}>
          <div className="input-group">
            <label>Username</label>
            <input
              type="text"
              value={loginForm.username}
              onChange={(e) => setLoginForm({...loginForm, username: e.target.value})}
              placeholder="Masukkan username"
            />
          </div>
          <div className="input-group">
            <label>Password</label>
            <input
              type="password"
              value={loginForm.password}
              onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
              placeholder="Masukkan password"
            />
          </div>
          <button type="submit" className="btn btn-primary">Masuk</button>
        </form>
        <div className="auth-footer">
          Belum punya akun? <a href="#" onClick={(e) => { e.preventDefault(); setScreen('register'); setErrorMessage(''); }}>Daftar</a>
        </div>
      </div>
    </div>
  );

  const renderRegister = () => (
    <div className="screen active" id="register-screen">
      <div className="auth-container">
        <div className="auth-logo">
          <h2>Daftar</h2>
          <p>Buat akun baru</p>
        </div>
        
        {errorMessage && (
          <div className="error-message">{errorMessage}</div>
        )}
        
        <form className="auth-form" onSubmit={handleRegister}>
          <div className="input-group">
            <label>Username</label>
            <input
              type="text"
              value={registerForm.username}
              onChange={(e) => setRegisterForm({...registerForm, username: e.target.value})}
              placeholder="Pilih username"
            />
          </div>
          <div className="input-group">
            <label>Nama Tampilan</label>
            <input
              type="text"
              value={registerForm.displayName}
              onChange={(e) => setRegisterForm({...registerForm, displayName: e.target.value})}
              placeholder="Nama yang ditampilkan"
            />
          </div>
          <div className="input-group">
            <label>Password</label>
            <input
              type="password"
              value={registerForm.password}
              onChange={(e) => setRegisterForm({...registerForm, password: e.target.value})}
              placeholder="Buat password"
            />
          </div>
          <button type="submit" className="btn btn-primary">Daftar</button>
        </form>
        <div className="auth-footer">
          Sudah punya akun? <a href="#" onClick={(e) => { e.preventDefault(); setScreen('login'); setErrorMessage(''); }}>Masuk</a>
        </div>
      </div>
    </div>
  );

  const renderContacts = () => {
    const filteredContacts = searchQuery 
      ? ContactService.searchContacts(searchQuery)
      : contacts;

    return (
      <div className="screen" id="contacts-screen">
        <div className="header">
          <h1>MeowTrack Chat</h1>
          <button className="header-back" onClick={handleLogout} style={{ marginLeft: 'auto', fontSize: '16px' }}>Logout</button>
        </div>
        <div className="contacts-header">
          <div className="search-box">
            <span>🔍</span>
            <input
              type="text"
              placeholder="Cari kontak..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        
        {errorMessage && (
          <div className="error-message" style={{ margin: '12px 16px' }}>{errorMessage}</div>
        )}
        
        {filteredContacts.length === 0 ? (
          <div className="empty-state">
            <h3>Belum ada kontak</h3>
            <p>Tambahkan kontak untuk memulai percakapan</p>
          </div>
        ) : (
          <div className="contacts-list">
            {filteredContacts.map(contact => {
              const lastMsg = ChatService.getLastMessage(contact.contactUserId);
              const unread = ChatService.getUnreadCount(contact.contactUserId);
              
              return (
                <div key={contact.id} className="contact-item" onClick={() => openChat(contact)}>
                  <div className="contact-avatar">
                    {getInitials(contact.contactDisplayName)}
                  </div>
                  <div className="contact-info">
                    <div className="contact-name">{contact.contactDisplayName}</div>
                    <div className="contact-preview">
                      {lastMsg ? (lastMsg.type === 'image' ? '📷 Gambar' : lastMsg.content.slice(0, 30)) : 'Belum ada pesan'}
                    </div>
                  </div>
                  <div className="contact-time">
                    {lastMsg && formatDate(lastMsg.timestamp)}
                    {unread > 0 && <span className="unread-badge">{unread}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        
        <button className="fab" onClick={() => setShowAddContact(true)}>+</button>
        
        {/* Add Contact Modal */}
        <div className={`modal-overlay ${showAddContact ? 'active' : ''}`} onClick={() => { setShowAddContact(false); setErrorMessage(''); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Tambah Kontak</h3>
            <form onSubmit={handleAddContact}>
              <div className="input-group">
                <label>Username</label>
                <input
                  type="text"
                  value={addContactQuery}
                  onChange={(e) => setAddContactQuery(e.target.value)}
                  placeholder="Masukkan username"
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => { setShowAddContact(false); setErrorMessage(''); }}>Batal</button>
                <button type="submit" className="btn btn-primary">Tambah</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  };

  const renderChat = () => {
    return (
      <div className="screen" id="chat-screen">
        <div className="chat-container">
          <div className="chat-header">
            <button className="chat-back" onClick={() => { setScreen('contacts'); setActiveChat(null); }}>←</button>
            <div className="contact-avatar" style={{ width: '40px', height: '40px', fontSize: '14px' }}>
              {activeChat && getInitials(activeChat.contactDisplayName)}
            </div>
            <div className="chat-contact-info">
              <h3>{activeChat?.contactDisplayName}</h3>
              <p>@{activeChat?.contactUsername}</p>
            </div>
          </div>
          
          <div className="chat-messages">
            {messages.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px' }}>
                <p>Kirim pesan untuk memulai percakapan</p>
              </div>
            ) : (
              messages.map(msg => {
                const isOwn = msg.senderId === currentUser?.id;
                return (
                  <div key={msg.id} className={`message ${isOwn ? 'message-own' : 'message-other'}`}>
                    {msg.type === 'image' && msg.imageUrl && (
                      <img src={msg.imageUrl} alt="Gambar" className="message-image" />
                    )}
                    {msg.content && <p>{msg.content}</p>}
                    <div className="message-time">{formatTime(msg.timestamp)}</div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>
          
          <div className="chat-input-area">
            <button className="chat-btn" onClick={handleImageUrl}>🖼️</button>
            <input
              type="text"
              placeholder="Ketik pesan..."
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyPress={handleKeyPress}
            />
            <button className="chat-btn chat-btn-send" onClick={handleSendMessage}>
              ➤
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ============================================
  // MAIN RENDER
  // ============================================
  return (
    <div className="container">
      {screen === 'login' && renderLogin()}
      {screen === 'register' && renderRegister()}
      {screen === 'contacts' && renderContacts()}
      {screen === 'chat' && renderChat()}
    </div>
  );
}