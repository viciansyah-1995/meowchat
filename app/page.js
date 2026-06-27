'use client';

import { useEffect, useMemo, useState } from 'react';
import SupabaseAuthService from '../lib/services/supabase-auth.service.js';
import ProfileService from '../lib/services/profile.service.js';
import ProfileEditService from '../lib/services/profile-edit.service.supabase.js';
import SupabaseContactService from '../lib/services/contact.service.supabase.js';
import SupabaseChatService from '../lib/services/chat.service.supabase.js';
import InboxService from '../lib/services/inbox.service.supabase.js';
import { formatTime } from '../lib/utils/index.js';
import { getSupabaseEnvStatus } from '../lib/supabase/client.js';

const NAV_ITEMS = ['chats', 'contacts', 'profile'];

export default function MeowTrackChat() {
  const [screen, setScreen] = useState('login');
  const [activeTab, setActiveTab] = useState('chats');
  const [currentUser, setCurrentUser] = useState(null);
  const [currentProfile, setCurrentProfile] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [debugInfo, setDebugInfo] = useState('');

  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ email: '', password: '', username: '', displayName: '' });
  const [profileForm, setProfileForm] = useState({ username: '', displayName: '', bio: '' });

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [inboxItems, setInboxItems] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [chatChannel, setChatChannel] = useState(null);
  const [envDiagnostic, setEnvDiagnostic] = useState(null);

  const clearFeedback = () => {
    setErrorMessage('');
    setSuccessMessage('');
  };

  const activeChatTitle = useMemo(() => {
    if (!activeChat) return 'Chat';
    return activeChat.otherProfile?.display_name || activeChat.otherProfile?.username || 'Chat';
  }, [activeChat]);

  const loadContacts = async () => {
    const result = await SupabaseContactService.getContacts();
    if (result.success) {
      setContacts(result.data || []);
    } else {
      setDebugInfo((prev) => `${prev}\ncontacts error => ${result.error?.message || JSON.stringify(result.error)}`);
    }
  };

  const loadInbox = async () => {
    const result = await InboxService.getMyInbox();
    if (result.success) {
      setInboxItems(result.data || []);
    } else {
      setDebugInfo((prev) => `${prev}\ninbox error => ${result.error?.message || JSON.stringify(result.error)}`);
    }
  };

  const loadSessionAndProfile = async () => {
    try {
      const sessionResult = await SupabaseAuthService.getSession();
      if (!sessionResult.success) {
        setErrorMessage(sessionResult.error?.message || 'Gagal mengambil session');
        return;
      }

      const session = sessionResult.data?.session;
      if (!session?.user) {
        setCurrentUser(null);
        setCurrentProfile(null);
        setScreen('login');
        return;
      }

      setCurrentUser(session.user);
      setDebugInfo(`session user => ${session.user.email}`);

      let profileResult = await ProfileService.getMyProfile();
      if (!profileResult.success) {
        await new Promise((resolve) => setTimeout(resolve, 1200));
        profileResult = await ProfileService.getMyProfile();
      }

      if (profileResult.success) {
        setCurrentProfile(profileResult.data);
        setProfileForm({
          username: profileResult.data.username || '',
          displayName: profileResult.data.display_name || '',
          bio: profileResult.data.bio || '',
        });
        setScreen('app');
        setActiveTab('chats');
        setDebugInfo((prev) => `${prev}\nprofile => ${JSON.stringify(profileResult.data)}`);
        await Promise.all([loadContacts(), loadInbox()]);
      } else {
        setErrorMessage(profileResult.error?.message || 'Gagal mengambil profile');
        setDebugInfo((prev) => `${prev}\nprofile error => ${JSON.stringify(profileResult.error)}`);
      }
    } catch (error) {
      setErrorMessage(`Init exception: ${error.message}`);
      setDebugInfo(`init exception => ${error.stack || error.message}`);
    }
  };

  useEffect(() => {
    try {
      const envStatus = getSupabaseEnvStatus();
      setEnvDiagnostic(envStatus);
      setDebugInfo((prev) => {
        const lines = [
          `env.hasUrl=${envStatus.hasUrl}`,
          `env.hasAnonKey=${envStatus.hasAnonKey}`,
          `env.urlHost=${envStatus.urlHost || 'null'}`,
          `env.anonKeyPrefix=${envStatus.anonKeyPrefix || 'null'}`,
        ];
        return prev ? `${lines.join('\n')}\n${prev}` : lines.join('\n');
      });
    } catch (error) {
      setDebugInfo((prev) => prev ? `envDiagnostic.error=${error.message}\n${prev}` : `envDiagnostic.error=${error.message}`);
    }

    loadSessionAndProfile();

    const { data } = SupabaseAuthService.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setCurrentUser(session.user);
        let profileResult = await ProfileService.getMyProfile();
        if (!profileResult.success) {
          await new Promise((resolve) => setTimeout(resolve, 1200));
          profileResult = await ProfileService.getMyProfile();
        }
        if (profileResult.success) {
          setCurrentProfile(profileResult.data);
          setProfileForm({
            username: profileResult.data.username || '',
            displayName: profileResult.data.display_name || '',
            bio: profileResult.data.bio || '',
          });
          setScreen('app');
          await Promise.all([loadContacts(), loadInbox()]);
        }
      } else {
        setCurrentUser(null);
        setCurrentProfile(null);
        setContacts([]);
        setSearchResults([]);
        setInboxItems([]);
        setActiveChat(null);
        setMessages([]);
        setScreen('login');
      }
    });

    return () => {
      data?.subscription?.unsubscribe();
      if (chatChannel) {
        SupabaseChatService.unsubscribe(chatChannel);
      }
    };
  }, []);

  const handleRegister = async (e) => {
    e.preventDefault();
    clearFeedback();
    try {
      const result = await SupabaseAuthService.signUp({
        email: registerForm.email.trim(),
        password: registerForm.password,
        username: registerForm.username.trim(),
        displayName: registerForm.displayName.trim(),
      });

      setDebugInfo(`register => ${JSON.stringify(result.success ? { success: true, user: result.data?.user?.email } : { success: false, error: result.error?.message })}`);
      if (!result.success) {
        setErrorMessage(result.error?.message || 'Register gagal');
        return;
      }

      setSuccessMessage('Register berhasil. Jika email confirmation aktif, cek inbox email dulu.');
      setRegisterForm({ email: '', password: '', username: '', displayName: '' });
      await loadSessionAndProfile();
    } catch (error) {
      setErrorMessage(`Register exception: ${error.message}`);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    clearFeedback();
    try {
      const result = await SupabaseAuthService.signIn({
        email: loginForm.email.trim(),
        password: loginForm.password,
      });

      setDebugInfo(`login => ${JSON.stringify(result.success ? { success: true, user: result.data?.user?.email } : { success: false, error: result.error?.message })}`);
      if (!result.success) {
        setErrorMessage(result.error?.message || 'Login gagal');
        return;
      }

      setSuccessMessage('Login berhasil');
      setLoginForm({ email: '', password: '' });
      await loadSessionAndProfile();
    } catch (error) {
      setErrorMessage(`Login exception: ${error.message}`);
    }
  };

  const handleLogout = async () => {
    clearFeedback();
    if (chatChannel) {
      SupabaseChatService.unsubscribe(chatChannel);
      setChatChannel(null);
    }
    const result = await SupabaseAuthService.signOut();
    if (!result.success) {
      setErrorMessage(result.error?.message || 'Logout gagal');
      return;
    }

    setCurrentUser(null);
    setCurrentProfile(null);
    setContacts([]);
    setSearchResults([]);
    setInboxItems([]);
    setActiveChat(null);
    setMessages([]);
    setScreen('login');
    setSuccessMessage('Logout berhasil');
  };

  const handleProfileSave = async (e) => {
    e.preventDefault();
    clearFeedback();

    const result = await ProfileEditService.updateMyProfile(profileForm);
    if (!result.success) {
      setErrorMessage(result.error?.message || 'Gagal update profile');
      return;
    }

    setCurrentProfile(result.data);
    setSuccessMessage('Profile berhasil diupdate');
    await loadInbox();
  };

  const handleSearchUser = async () => {
    clearFeedback();
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const result = await ProfileService.searchProfiles(searchQuery.trim());
    if (!result.success) {
      setErrorMessage(result.error?.message || 'Gagal mencari user');
      return;
    }

    const filtered = (result.data || []).filter((profile) => profile.id !== currentProfile?.id);
    setSearchResults(filtered);
    setDebugInfo(`search results => ${filtered.length}`);
  };

  const handleAddContact = async (profile) => {
    clearFeedback();
    const result = await SupabaseContactService.addContact(profile.id);
    if (!result.success) {
      setErrorMessage(result.error?.message || 'Gagal tambah kontak');
      return;
    }
    setSuccessMessage(`Kontak @${profile.username} berhasil ditambahkan`);
    await loadContacts();
  };

  const openDirectChat = async (profile) => {
    clearFeedback();
    setDebugInfo('openDirectChat() start');

    if (!profile || !profile.id) {
      setErrorMessage('Profile tujuan tidak valid atau belum bisa dibaca dari data saat ini');
      setDebugInfo((prev) => `${prev}\ninvalid profile payload => ${JSON.stringify(profile)}`);
      return;
    }

    const chatResult = await SupabaseChatService.getOrCreateDirectChat(profile.id);
    if (!chatResult.success) {
      setErrorMessage(chatResult.error?.message || 'Gagal membuka direct chat');
      if (chatResult.debug) setDebugInfo(chatResult.debug.join('\n'));
      return;
    }
    if (chatResult.debug) setDebugInfo(chatResult.debug.join('\n'));

    const chat = chatResult.data;
    const messagesResult = await SupabaseChatService.getMessages(chat.id);
    if (!messagesResult.success) {
      setErrorMessage(messagesResult.error?.message || 'Gagal load messages');
      setDebugInfo((prev) => `${prev}\nmessagesResult.error => ${JSON.stringify(messagesResult.error)}`);
      return;
    }

    await InboxService.markChatAsRead(chat.id);
    await loadInbox();

    if (chatChannel) {
      SupabaseChatService.unsubscribe(chatChannel);
      setChatChannel(null);
    }

    const channel = SupabaseChatService.subscribeMessages(chat.id, async (newMessage) => {
      setMessages((prev) => {
        const exists = prev.some((msg) => msg.id === newMessage.id);
        if (exists) return prev;
        return [...prev, newMessage];
      });
      setDebugInfo((prev) => `${prev}\nrealtime message received => ${newMessage.id}`);
      await InboxService.markChatAsRead(chat.id);
      await loadInbox();
    });

    setChatChannel(channel);
    setActiveChat({ chat, otherProfile: profile });
    setMessages(messagesResult.data || []);
    setScreen('chat');
    setDebugInfo((prev) => `${prev}\nchat ready => ${chat.id}\nmessageCount => ${(messagesResult.data || []).length}`);
    setSuccessMessage(chatResult.created ? 'Direct chat baru dibuat' : 'Direct chat dibuka');
  };

  const handleSendMessage = async () => {
    clearFeedback();
    if (!activeChat?.chat?.id || !messageInput.trim()) return;

    const result = await SupabaseChatService.sendTextMessage(activeChat.chat.id, messageInput.trim());
    if (!result.success) {
      setErrorMessage(result.error?.message || 'Gagal kirim pesan');
      return;
    }

    setDebugInfo(`message sent => ${JSON.stringify(result.data)}`);
    setMessageInput('');
    await loadInbox();
  };

  const handleComposerKeyDown = async (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      await handleSendMessage();
    }
  };

  const Feedback = () => (
    <>
      {errorMessage && <div className="error-message">{errorMessage}</div>}
      {successMessage && <div className="success-message">{successMessage}</div>}
      {envDiagnostic && (
        <div className="success-message" style={{ textAlign: 'left' }}>
          <div><strong>Env Diagnostic</strong></div>
          <div>URL present: {String(envDiagnostic.hasUrl)}</div>
          <div>Anon key present: {String(envDiagnostic.hasAnonKey)}</div>
          <div>URL host: {envDiagnostic.urlHost || 'null'}</div>
          <div>Key prefix: {envDiagnostic.anonKeyPrefix || 'null'}</div>
        </div>
      )}
      {debugInfo && <pre className="debug-panel">{debugInfo}</pre>}
    </>
  );

  const renderLogin = () => (
    <div className={`screen ${screen === 'login' ? 'active' : ''}`} id="login-screen">
      <div className="auth-container">
        <div className="auth-logo"><h2>Database (Demo)</h2></div>
        <Feedback />
        <form className="auth-form" onSubmit={handleLogin}>
          <div className="input-group">
            <label>Email</label>
            <input type="email" value={loginForm.email} onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })} placeholder="Masukkan email" />
          </div>
          <div className="input-group">
            <label>Password</label>
            <input type="password" value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} placeholder="Masukkan password" />
          </div>
          <button type="submit" className="btn btn-primary">Masuk</button>
        </form>
        <div className="auth-footer">Belum punya akun? <a href="#" onClick={(e) => { e.preventDefault(); setScreen('register'); clearFeedback(); }}>Daftar</a></div>
      </div>
    </div>
  );

  const renderRegister = () => (
    <div className={`screen ${screen === 'register' ? 'active' : ''}`} id="register-screen">
      <div className="auth-container">
        <div className="auth-logo"><h2>Database (Demo)</h2></div>
        <Feedback />
        <form className="auth-form" onSubmit={handleRegister}>
          <div className="input-group"><label>Email</label><input type="email" value={registerForm.email} onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })} placeholder="email@contoh.com" /></div>
          <div className="input-group"><label>Username</label><input type="text" value={registerForm.username} onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })} placeholder="Pilih username" /></div>
          <div className="input-group"><label>Nama Tampilan</label><input type="text" value={registerForm.displayName} onChange={(e) => setRegisterForm({ ...registerForm, displayName: e.target.value })} placeholder="Nama yang ditampilkan" /></div>
          <div className="input-group"><label>Password</label><input type="password" value={registerForm.password} onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })} placeholder="Minimal 6 karakter" /></div>
          <button type="submit" className="btn btn-primary">Daftar</button>
        </form>
        <div className="auth-footer">Sudah punya akun? <a href="#" onClick={(e) => { e.preventDefault(); setScreen('login'); clearFeedback(); }}>Masuk</a></div>
      </div>
    </div>
  );

  const renderChatsTab = () => (
    <>
      <div className="contacts-header">
        <h3 style={{ marginBottom: 12 }}>Chats</h3>
        {inboxItems.length === 0 ? (
          <div className="empty-state" style={{ padding: '16px 0' }}><p>Belum ada percakapan</p></div>
        ) : (
          <div className="contacts-list">
            {inboxItems.map((item) => {
              const targetProfile = item.otherProfile || item.fallbackProfile || null;
              return (
                <div key={item.chat.id} className="contact-item" onClick={() => openDirectChat(targetProfile)}>
                  <div className="contact-avatar">{(targetProfile?.display_name || targetProfile?.username || '?').slice(0, 1).toUpperCase()}</div>
                  <div className="contact-info">
                    <div className="contact-name">{targetProfile?.display_name || 'Unknown'}</div>
                    <div className="contact-preview">{item.lastMessage?.content || 'Belum ada pesan'}</div>
                  </div>
                  <div className="contact-time">
                    {item.lastMessage?.created_at ? formatTime(new Date(item.lastMessage.created_at).getTime()) : ''}
                    {item.unreadCount > 0 && <span className="unread-badge">{item.unreadCount}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );

  const renderContactsTab = () => (
    <>
      <div className="contacts-header">
        <div className="search-box"><span>🔍</span><input type="text" placeholder="Cari username..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
      </div>
      <div style={{ padding: '0 16px 16px' }}><button className="btn btn-primary" style={{ width: '100%' }} onClick={handleSearchUser}>Cari User</button></div>
      <div className="contacts-header" style={{ paddingTop: 0 }}>
        <h3 style={{ marginBottom: 12 }}>Hasil Pencarian</h3>
        {searchResults.length === 0 ? <div className="empty-state" style={{ padding: '16px 0' }}><p>Belum ada hasil pencarian</p></div> : (
          <div className="contacts-list">
            {searchResults.map((profile) => (
              <div key={profile.id} className="contact-item" style={{ cursor: 'default' }}>
                <div className="contact-avatar">{(profile.display_name || profile.username || '?').slice(0, 1).toUpperCase()}</div>
                <div className="contact-info">
                  <div className="contact-name">{profile.display_name}</div>
                  <div className="contact-preview">@{profile.username}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-secondary" style={{ padding: '8px 12px' }} onClick={() => handleAddContact(profile)}>Add</button>
                  <button className="btn btn-primary" style={{ padding: '8px 12px' }} onClick={() => openDirectChat(profile)}>Chat</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="contacts-header" style={{ paddingTop: 0 }}>
        <h3 style={{ marginBottom: 12 }}>Kontak Saya</h3>
        {contacts.length === 0 ? <div className="empty-state" style={{ padding: '16px 0' }}><p>Belum ada kontak</p></div> : (
          <div className="contacts-list">
            {contacts.map((contact) => {
              const profile = contact.contact_profile;
              return (
                <div key={contact.id} className="contact-item">
                  <div className="contact-avatar">{(profile?.display_name || profile?.username || '?').slice(0, 1).toUpperCase()}</div>
                  <div className="contact-info">
                    <div className="contact-name">{contact.nickname || profile?.display_name}</div>
                    <div className="contact-preview">@{profile?.username}</div>
                  </div>
                  <button className="btn btn-primary" style={{ padding: '8px 12px' }} onClick={() => openDirectChat(profile)}>Chat</button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );

  const renderProfileTab = () => (
    <div className="contacts-header">
      <h3 style={{ marginBottom: 16 }}>Profile</h3>
      <form className="auth-form" onSubmit={handleProfileSave}>
        <div className="input-group"><label>Username</label><input type="text" value={profileForm.username} onChange={(e) => setProfileForm({ ...profileForm, username: e.target.value })} /></div>
        <div className="input-group"><label>Nama Tampilan</label><input type="text" value={profileForm.displayName} onChange={(e) => setProfileForm({ ...profileForm, displayName: e.target.value })} /></div>
        <div className="input-group"><label>Bio</label><input type="text" value={profileForm.bio} onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })} placeholder="Bio singkat" /></div>
        <button type="submit" className="btn btn-primary">Simpan Profile</button>
        <button type="button" className="btn btn-secondary" onClick={handleLogout}>Logout</button>
      </form>
    </div>
  );

  const renderAppHome = () => (
    <div className={`screen ${screen === 'app' ? 'active' : ''}`} id="app-screen">
      <div className="header"><h1>Database (Demo)</h1></div>
      <Feedback />
      {activeTab === 'chats' && renderChatsTab()}
      {activeTab === 'contacts' && renderContactsTab()}
      {activeTab === 'profile' && renderProfileTab()}
      <div className="bottom-nav">
        {NAV_ITEMS.map((item) => (
          <button key={item} className={`bottom-nav-item ${activeTab === item ? 'active' : ''}`} onClick={() => setActiveTab(item)}>
            <span className="bottom-nav-label">{item === 'chats' ? 'Chat' : item === 'contacts' ? 'Contact' : 'Profile'}</span>
          </button>
        ))}
      </div>
    </div>
  );

  const renderChat = () => (
    <div className={`screen ${screen === 'chat' ? 'active' : ''}`} id="chat-screen">
      <div className="chat-container">
        <div className="chat-header">
          <button className="chat-back" onClick={async () => { setScreen('app'); setActiveTab('chats'); setActiveChat(null); clearFeedback(); await loadInbox(); }}>←</button>
          <div className="chat-contact-info">
            <h3>{activeChatTitle}</h3>
            <p>@{activeChat?.otherProfile?.username}</p>
          </div>
        </div>
        <Feedback />
        <div className="chat-messages">
          {messages.length === 0 ? <div className="empty-state" style={{ padding: '24px' }}><p>Kirim pesan untuk memulai percakapan</p></div> : (
            messages.map((msg) => {
              const isOwn = msg.sender_id === currentUser?.id;
              return (
                <div key={msg.id} className={`message ${isOwn ? 'message-own' : 'message-other'}`}>
                  {msg.content && <p>{msg.content}</p>}
                  <div className="message-time">{formatTime(new Date(msg.created_at).getTime())}</div>
                </div>
              );
            })
          )}
        </div>
        <div className="chat-input-area">
          <textarea className="composer-textarea" rows={1} placeholder="Ketik pesan..." value={messageInput} onChange={(e) => setMessageInput(e.target.value)} onKeyDown={handleComposerKeyDown} />
          <button className="chat-btn chat-btn-send" onClick={handleSendMessage}>➤</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="container">
      {renderLogin()}
      {renderRegister()}
      {renderAppHome()}
      {renderChat()}
    </div>
  );
}
