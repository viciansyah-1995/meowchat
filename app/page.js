'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import SupabaseAuthService from '../lib/services/supabase-auth.service.js';
import ProfileService from '../lib/services/profile.service.js';
import ProfileEditService from '../lib/services/profile-edit.service.supabase.js';
import SupabaseContactService from '../lib/services/contact.service.supabase.js';
import SupabaseChatService from '../lib/services/chat.service.supabase.js';
import InboxService from '../lib/services/inbox.service.supabase.js';
import { formatTime } from '../lib/utils/index.js';
import getSupabaseClient, { getSupabaseEnvStatus } from '../lib/supabase/client.js';
import ChatComposer from './chat-composer.js';
import ChatPhotoViewer from './chat-photo-viewer.js';
import { FileMessage } from './file-message.js';
import { VoiceMessage } from './voice-note.js';

const NAV_ITEMS = [
  { key: 'chats', label: 'Chat', icon: '💬' },
  { key: 'contacts', label: 'Contact', icon: '👥' },
  { key: 'profile', label: 'Pengaturan', icon: '⚙️' },
];
const APP_THEMES = [
  { id: 'system', label: 'Bawaan sistem' },
  { id: 'ocean', label: 'Laut & Mint' },
  { id: 'sunset', label: 'Senja & Lavender' },
  { id: 'citrus', label: 'Lemon & Pistachio' },
  { id: 'sky', label: 'Langit & Persik' },
];
const CHAT_THEME_KEY = 'meowchat-chat-theme';
const IS_DEBUG_MODE = process.env.NODE_ENV !== 'production';
const CHAT_REFRESH_INTERVAL_MS = 5000;

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
  const [olderCursor, setOlderCursor] = useState(null);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [messageReadMap, setMessageReadMap] = useState({});
  const [replyingTo, setReplyingTo] = useState(null);
  const [messageInput, setMessageInput] = useState('');
  const [appTheme, setAppTheme] = useState('system');
  const [wallpaperUrl, setWallpaperUrl] = useState(null);
  const [viewedPhoto, setViewedPhoto] = useState(null);
  const [envDiagnostic, setEnvDiagnostic] = useState(null);
  const [isBootLoading, setIsBootLoading] = useState(true);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [isInboxLoading, setIsInboxLoading] = useState(false);
  const [isChatOpening, setIsChatOpening] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [installPromptEvent, setInstallPromptEvent] = useState(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const chatScreenRef = useRef(null);
  const chatMessagesRef = useRef(null);
  const followNewMessagesRef = useRef(false);
  const keepBottomRef = useRef(true);
  const messageViewportHeightRef = useRef(0);
  const olderRequestRef = useRef(null);

  useEffect(() => {
    try {
      const savedTheme = window.localStorage.getItem(CHAT_THEME_KEY);
      if (APP_THEMES.some(({ id }) => id === savedTheme)) setAppTheme(savedTheme);
    } catch {
      // A browser that blocks storage can still change the theme for this visit.
    }
  }, []);

  useLayoutEffect(() => {
    document.documentElement.dataset.appTheme = appTheme;
  }, [appTheme]);

  const selectAppTheme = (theme) => {
    setAppTheme(theme);
    try {
      window.localStorage.setItem(CHAT_THEME_KEY, theme);
    } catch {
      // Keep the theme active for this visit.
    }
  };

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

  const loadInbox = useCallback(async () => {
    setIsInboxLoading(true);
    try {
      const result = await InboxService.getMyInbox();
      if (result.success) {
        setInboxItems(result.data || []);
      } else {
        setDebugInfo((prev) => `${prev}\ninbox error => ${result.error?.message || JSON.stringify(result.error)}`);
      }
    } finally {
      setIsInboxLoading(false);
    }
  }, []);

  const chatId = screen === 'chat' ? activeChat?.chat?.id : null;
  const peerId = activeChat?.otherProfile?.id;
  const userId = currentUser?.id;

  const chatOpen = Boolean(chatId);
  useEffect(() => {
    if (!chatOpen || !userId) return;

    const controller = new AbortController();
    let url;
    async function loadWallpaper() {
      try {
        const { data, error } = await getSupabaseClient().storage
          .from('chat-wallpaper').download('chat-wallpaper.webp', {}, { signal: controller.signal });
        if (controller.signal.aborted || error || !data?.size) return;
        url = URL.createObjectURL(data);
        setWallpaperUrl(url);
      } catch {
        // The theme background remains visible if the wallpaper is unavailable.
      }
    }
    loadWallpaper();
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
      setWallpaperUrl(null);
    };
  }, [chatOpen, userId]);

  const syncReadStatus = useCallback(async (page, readerId, isCurrent, markedIds) => {
    const receipts = await InboxService.getReadStatusMap(
      page.filter((message) => message.sender_id === userId).map((message) => message.id),
      readerId
    );
    if (isCurrent() && receipts.success) {
      setMessageReadMap((previous) => ({ ...receipts.data, ...previous }));
    }
    if (!isCurrent() || document.visibilityState !== 'visible') return;
    const unreadIds = page
      .filter((message) => message.sender_id !== userId && !markedIds?.has(message.id))
      .map((message) => message.id);
    if (!unreadIds.length) return;
    const result = await InboxService.markMessagesAsRead(unreadIds);
    if (!isCurrent() || !result.success) return;
    if (markedIds) unreadIds.forEach((id) => markedIds.add(id));
    if (result.data.length > 0) await loadInbox();
  }, [userId, loadInbox]);

  useEffect(() => {
    if (screen !== 'chat') return;
    const viewport = window.visualViewport;
    const chatScreen = chatScreenRef.current;
    if (!viewport || !chatScreen) return;

    let frame = 0;
    const fitChatToViewport = () => {
      const top = Math.max(0, viewport.offsetTop);
      chatScreen.style.top = `${top}px`;
      chatScreen.style.height = `${viewport.height}px`;
      const keyboardInset = window.innerHeight - top - viewport.height;
      chatScreen.toggleAttribute('data-keyboard-open', keyboardInset > 100 && viewport.scale === 1);
    };
    const scheduleFit = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fitChatToViewport);
    };

    fitChatToViewport();
    viewport.addEventListener('resize', scheduleFit);
    viewport.addEventListener('scroll', scheduleFit);
    window.addEventListener('resize', scheduleFit);
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener('resize', scheduleFit);
      viewport.removeEventListener('scroll', scheduleFit);
      window.removeEventListener('resize', scheduleFit);
      chatScreen.style.removeProperty('top');
      chatScreen.style.removeProperty('height');
      chatScreen.removeAttribute('data-keyboard-open');
    };
  }, [screen]);

  useLayoutEffect(() => {
    const container = chatMessagesRef.current;
    if (!chatId || isChatOpening || !container) return;
    keepBottomRef.current = true;
    messageViewportHeightRef.current = container.clientHeight;
    const observer = new ResizeObserver(() => {
      messageViewportHeightRef.current = container.clientHeight;
      if (keepBottomRef.current) container.scrollTop = container.scrollHeight;
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [chatId, isChatOpening]);

  useLayoutEffect(() => {
    if (!followNewMessagesRef.current) return;
    followNewMessagesRef.current = false;
    const container = chatMessagesRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (!chatId || !peerId || !userId) return;
    let closed = false;
    let refreshing = false;
    const markedIds = new Set();
    const receivedIds = new Set();
    const isCurrent = () => !closed;

    const mergeMessages = (incoming) => {
      const additions = incoming.filter((message) => !receivedIds.has(message.id));
      if (!additions.length) return;
      additions.forEach((message) => receivedIds.add(message.id));
      const container = chatMessagesRef.current;
      if (container && container.scrollHeight - container.clientHeight - container.scrollTop <= 48) {
        followNewMessagesRef.current = true;
      }
      setMessages((previous) => {
        const existingIds = new Set(previous.map((message) => message.id));
        const newMessages = additions.filter((message) => !existingIds.has(message.id));
        if (!newMessages.length) return [...previous];
        return [...previous, ...newMessages].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
      });
    };

    const refreshChat = async () => {
      if (closed || refreshing || document.visibilityState !== 'visible') return;
      refreshing = true;
      try {
        const result = await SupabaseChatService.getMessages(chatId);
        if (closed || !result.success) return;
        mergeMessages(result.data);
        await syncReadStatus(result.data, peerId, isCurrent, markedIds);
      } finally {
        refreshing = false;
      }
    };

    const reportError = (error) => {
      if (!closed && IS_DEBUG_MODE) console.error('Chat sync failed', error);
    };

    const channel = SupabaseChatService.subscribeChat(chatId, peerId, {
      onMessage(message) {
        if (closed) return;
        mergeMessages([message]);
        if (message.sender_id === peerId) syncReadStatus([message], peerId, isCurrent, markedIds).catch(reportError);
        else loadInbox().catch(reportError);
      },
      onRead(receipt) {
        if (!closed) setMessageReadMap((previous) => ({ ...previous, [receipt.message_id]: [receipt] }));
      },
      onReady() {
        if (!closed) refreshChat().catch(reportError);
      },
    });

    const refreshVisibleChat = () => refreshChat().catch(reportError);
    document.addEventListener('visibilitychange', refreshVisibleChat);
    window.addEventListener('online', refreshVisibleChat);
    const refreshTimer = window.setInterval(refreshVisibleChat, CHAT_REFRESH_INTERVAL_MS);
    refreshVisibleChat();

    return () => {
      closed = true;
      followNewMessagesRef.current = false;
      olderRequestRef.current = null;
      window.clearInterval(refreshTimer);
      window.removeEventListener('online', refreshVisibleChat);
      document.removeEventListener('visibilitychange', refreshVisibleChat);
      SupabaseChatService.unsubscribe(channel);
    };
  }, [chatId, peerId, userId, loadInbox, syncReadStatus]);

  const hydrateAppShell = async (profile) => {
    setCurrentProfile(profile);
    setProfileForm({
      username: profile.username || '',
      displayName: profile.display_name || '',
      bio: profile.bio || '',
    });
    setScreen('app');
    setActiveTab('chats');
    if (IS_DEBUG_MODE) {
      setDebugInfo((prev) => `${prev}\nprofile => ${JSON.stringify(profile)}`);
    }

    setTimeout(() => {
      loadContacts().catch((error) => {
        if (IS_DEBUG_MODE) {
          setDebugInfo((prev) => `${prev}\nloadContacts async error => ${error.message || JSON.stringify(error)}`);
        }
      });

      loadInbox().catch((error) => {
        if (IS_DEBUG_MODE) {
          setDebugInfo((prev) => `${prev}\nloadInbox async error => ${error.message || JSON.stringify(error)}`);
        }
      });
    }, 0);
  };

  const loadSessionAndProfile = async () => {
    try {
      setIsBootLoading(true);
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
      if (IS_DEBUG_MODE) {
        setDebugInfo(`session user => ${session.user.email}`);
      }

      let profileResult = await ProfileService.getMyProfile();
      if (!profileResult.success) {
        await new Promise((resolve) => setTimeout(resolve, 1200));
        profileResult = await ProfileService.getMyProfile();
      }

      if (profileResult.success) {
        await hydrateAppShell(profileResult.data);
      } else {
        setErrorMessage(profileResult.error?.message || 'Gagal mengambil profile');
        if (IS_DEBUG_MODE) {
          setDebugInfo((prev) => `${prev}\nprofile error => ${JSON.stringify(profileResult.error)}`);
        }
      }
    } catch (error) {
      setErrorMessage(`Init exception: ${error.message}`);
      if (IS_DEBUG_MODE) {
        setDebugInfo(`init exception => ${error.stack || error.message}`);
      }
    } finally {
      setIsBootLoading(false);
    }
  };

  useEffect(() => {
    if (IS_DEBUG_MODE) {
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
    }

    const installDismissed = window.localStorage.getItem('database_demo_install_prompt_dismissed');

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPromptEvent(event);
      if (!installDismissed) {
        setShowInstallPrompt(true);
      }
    };

    const handleAppInstalled = () => {
      setInstallPromptEvent(null);
      setShowInstallPrompt(false);
      window.localStorage.setItem('database_demo_install_prompt_dismissed', 'installed');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    if (!installDismissed && window.matchMedia('(display-mode: browser)').matches) {
      setShowInstallPrompt(true);
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
          await hydrateAppShell(profileResult.data);
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
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      data?.subscription?.unsubscribe();
    };
  }, []);

  const handleRegister = async (e) => {
    e.preventDefault();
    clearFeedback();
    setIsAuthLoading(true);
    try {
      const result = await SupabaseAuthService.signUp({
        email: registerForm.email.trim(),
        password: registerForm.password,
        username: registerForm.username.trim(),
        displayName: registerForm.displayName.trim(),
      });

      if (IS_DEBUG_MODE) {
        setDebugInfo(`register => ${JSON.stringify(result.success ? { success: true, user: result.data?.user?.email } : { success: false, error: result.error?.message })}`);
      }
      if (!result.success) {
        setErrorMessage(result.error?.message || 'Register gagal');
        return;
      }

      setSuccessMessage('Register berhasil. Jika email confirmation aktif, cek inbox email dulu.');
      setRegisterForm({ email: '', password: '', username: '', displayName: '' });
      await loadSessionAndProfile();
    } catch (error) {
      setErrorMessage(`Register exception: ${error.message}`);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    clearFeedback();
    setIsAuthLoading(true);
    try {
      const result = await SupabaseAuthService.signIn({
        email: loginForm.email.trim(),
        password: loginForm.password,
      });

      if (IS_DEBUG_MODE) {
        setDebugInfo(`login => ${JSON.stringify(result.success ? { success: true, user: result.data?.user?.email } : { success: false, error: result.error?.message })}`);
      }
      if (!result.success) {
        setErrorMessage(result.error?.message || 'Login gagal');
        return;
      }

      setSuccessMessage('Login berhasil');
      setLoginForm({ email: '', password: '' });
      await loadSessionAndProfile();
    } catch (error) {
      setErrorMessage(`Login exception: ${error.message}`);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    clearFeedback();
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
    setReplyingTo(null);
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

  const handleSearchUser = async (event) => {
    event.preventDefault();
    const input = searchQuery.trim();
    if (!input || isSearchingUsers) return;
    const query = input.replace(/^@/, '');
    clearFeedback();
    setSearchResults([]);
    if (!/^[A-Za-z0-9_]{1,20}$/.test(query)) {
      setErrorMessage('Gunakan huruf, angka, atau garis bawah untuk mencari username.');
      return;
    }
    setIsSearchingUsers(true);

    try {
      const result = await ProfileService.searchProfiles(query);
      if (!result.success) throw result.error;
      const filtered = (result.data || []).filter((profile) => profile.id !== currentProfile?.id);
      setSearchResults(filtered);
      setDebugInfo(`search results => ${filtered.length}`);
    } catch {
      setErrorMessage('Gagal mencari user. Coba lagi.');
    } finally {
      setIsSearchingUsers(false);
    }
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

  const handleInstallApp = async () => {
    if (installPromptEvent) {
      installPromptEvent.prompt();
      const choice = await installPromptEvent.userChoice;
      if (choice.outcome === 'accepted') {
        setSuccessMessage('Install app dimulai');
        setShowInstallPrompt(false);
      }
      setInstallPromptEvent(null);
      return;
    }

    setSuccessMessage('Kalau tombol install browser belum muncul, buka menu browser lalu pilih Add to Home Screen atau Install App.');
  };

  const dismissInstallPrompt = () => {
    setShowInstallPrompt(false);
    window.localStorage.setItem('database_demo_install_prompt_dismissed', 'true');
  };

  const openDirectChat = async (profile) => {
    clearFeedback();
    setIsChatOpening(true);
    setDebugInfo('openDirectChat() start');

    if (!profile || !profile.id) {
      setErrorMessage('Profile tujuan tidak valid atau belum bisa dibaca dari data saat ini');
      setDebugInfo((prev) => `${prev}\ninvalid profile payload => ${JSON.stringify(profile)}`);
      setIsChatOpening(false);
      return;
    }

    const chatResult = await SupabaseChatService.getOrCreateDirectChat(profile.id);
    if (!chatResult.success) {
      setErrorMessage(chatResult.error?.message || 'Gagal membuka direct chat');
      if (chatResult.debug && IS_DEBUG_MODE) setDebugInfo(chatResult.debug.join('\n'));
      setIsChatOpening(false);
      return;
    }
    if (chatResult.debug) setDebugInfo(chatResult.debug.join('\n'));

    const chat = chatResult.data;
    const messagesResult = await SupabaseChatService.getMessages(chat.id);
    if (!messagesResult.success) {
      setErrorMessage(messagesResult.error?.message || 'Gagal load messages');
      if (IS_DEBUG_MODE) {
        setDebugInfo((prev) => `${prev}\nmessagesResult.error => ${JSON.stringify(messagesResult.error)}`);
      }
      setIsChatOpening(false);
      return;
    }

    setActiveChat({ chat, otherProfile: profile });
    setMessages(messagesResult.data || []);
    setOlderCursor(messagesResult.olderCursor);
    setIsLoadingOlder(false);
    setMessageReadMap({});
    setReplyingTo(null);
    setScreen('chat');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollChatToBottom();
      });
    });
    if (IS_DEBUG_MODE) {
      setDebugInfo((prev) => `${prev}\nchat ready => ${chat.id}\nmessageCount => ${(messagesResult.data || []).length}`);
    }
    setIsChatOpening(false);
  };

  const loadOlderMessages = async () => {
    if (!chatId || !olderCursor || olderRequestRef.current) return;
    const request = {};
    olderRequestRef.current = request;
    const isCurrent = () => olderRequestRef.current === request;
    setIsLoadingOlder(true);
    try {
      const result = await SupabaseChatService.getMessages(chatId, olderCursor);
      if (!isCurrent()) return;
      if (!result.success) throw result.error;
      setMessages((previous) => {
        const existingIds = new Set(previous.map((message) => message.id));
        return [...result.data.filter((message) => !existingIds.has(message.id)), ...previous];
      });
      setOlderCursor(result.olderCursor);
      await syncReadStatus(result.data, peerId, isCurrent);
    } catch {
      if (isCurrent()) setErrorMessage('Riwayat pesan gagal dimuat. Coba lagi.');
    } finally {
      if (isCurrent()) {
        olderRequestRef.current = null;
        setIsLoadingOlder(false);
      }
    }
  };

  const handleSendMessage = async () => {
    clearFeedback();
    if (!activeChat?.chat?.id || !messageInput.trim() || isSendingMessage) return;

    setIsSendingMessage(true);
    try {
      const result = await SupabaseChatService.sendTextMessage(activeChat.chat.id, messageInput.trim(), replyingTo?.id || null);
      if (!result.success) {
        setErrorMessage(result.error?.message || 'Gagal kirim pesan');
        return;
      }

      if (IS_DEBUG_MODE) {
        setDebugInfo(`message sent => ${JSON.stringify(result.data)}`);
      }
      setMessageInput('');
      setReplyingTo(null);
      await loadInbox();
    } finally {
      setIsSendingMessage(false);
    }
  };

  const getReplyPreviewText = (message) => {
    if (!message) return '';
    if (message.message_type === 'voice') return 'Voice note';
    if (message.message_type === 'file') return message.file_name;
    return (message.content || '').trim().slice(0, 90) || 'Pesan';
  };

  const getReplyAuthorLabel = (message) => {
    if (!message) return '';
    return message.sender_id === currentUser?.id ? 'You' : (activeChat?.otherProfile?.display_name || activeChat?.otherProfile?.username || 'User');
  };

  const scrollChatToBottom = () => {
    const container = chatMessagesRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  };

  const Feedback = () => (
    <>
      {errorMessage && <div className="error-message">{errorMessage}</div>}
      {successMessage && <div className="success-message">{successMessage}</div>}
      {IS_DEBUG_MODE && envDiagnostic && (
        <div className="success-message" style={{ textAlign: 'left' }}>
          <div><strong>Env Diagnostic</strong></div>
          <div>URL present: {String(envDiagnostic.hasUrl)}</div>
          <div>Anon key present: {String(envDiagnostic.hasAnonKey)}</div>
          <div>URL host: {envDiagnostic.urlHost || 'null'}</div>
          <div>Key prefix: {envDiagnostic.anonKeyPrefix || 'null'}</div>
        </div>
      )}
      {IS_DEBUG_MODE && debugInfo && <pre className="debug-panel">{debugInfo}</pre>}
    </>
  );

  const renderInstallPrompt = () => {
    if (!(screen === 'login' || screen === 'register') || !showInstallPrompt) return null;

    return (
      <div className="install-prompt-card">
        <div className="install-prompt-copy">
          <div className="install-prompt-badge">PWA</div>
          <h3>Install Database App</h3>
          <p>Buka lebih cepat seperti aplikasi mobile langsung dari home screen.</p>
        </div>
        <div className="install-prompt-actions">
          <button type="button" className="btn btn-secondary install-prompt-secondary" onClick={dismissInstallPrompt}>Nanti</button>
          <button type="button" className="btn btn-primary install-prompt-primary" onClick={handleInstallApp}>{installPromptEvent ? 'Install Sekarang' : 'Lihat Cara Install'}</button>
        </div>
      </div>
    );
  };

  const renderLogin = () => (
    <div className={`screen ${screen === 'login' ? 'active' : ''}`} id="login-screen">
      <div className="auth-container">
        <div className="auth-logo"><h2>Database (Demo)</h2></div>
        {renderInstallPrompt()}
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
          <button type="submit" className="btn btn-primary" disabled={isAuthLoading}>{isAuthLoading ? 'Loading...' : 'Masuk'}</button>
        </form>
        <div className="auth-footer">Belum punya akun? <a href="#" onClick={(e) => { e.preventDefault(); setScreen('register'); clearFeedback(); }}>Daftar</a></div>
      </div>
    </div>
  );

  const renderRegister = () => (
    <div className={`screen ${screen === 'register' ? 'active' : ''}`} id="register-screen">
      <div className="auth-container">
        <div className="auth-logo"><h2>Database (Demo)</h2></div>
        {renderInstallPrompt()}
        <Feedback />
        <form className="auth-form" onSubmit={handleRegister}>
          <div className="input-group"><label>Email</label><input type="email" value={registerForm.email} onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })} placeholder="email@contoh.com" /></div>
          <div className="input-group"><label>Username</label><input type="text" value={registerForm.username} onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })} placeholder="Pilih username" /></div>
          <div className="input-group"><label>Nama Tampilan</label><input type="text" value={registerForm.displayName} onChange={(e) => setRegisterForm({ ...registerForm, displayName: e.target.value })} placeholder="Nama yang ditampilkan" /></div>
          <div className="input-group"><label>Password</label><input type="password" value={registerForm.password} onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })} placeholder="Minimal 6 karakter" /></div>
          <button type="submit" className="btn btn-primary" disabled={isAuthLoading}>{isAuthLoading ? 'Loading...' : 'Daftar'}</button>
        </form>
        <div className="auth-footer">Sudah punya akun? <a href="#" onClick={(e) => { e.preventDefault(); setScreen('login'); clearFeedback(); }}>Masuk</a></div>
      </div>
    </div>
  );

  const renderChatsTab = () => (
    <>
      <div className="contacts-header">
        <h3 style={{ marginBottom: 12 }}>Chats</h3>
        {isInboxLoading ? (
          <div className="skeleton-list">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton-item" />)}</div>
        ) : inboxItems.length === 0 ? (
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
                    <div className="contact-preview">{item.lastMessage?.file_name || (item.lastMessage?.message_type === 'voice' ? 'Voice note' : item.lastMessage?.content || 'Belum ada pesan')}</div>
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
        <form className="contact-search" role="search" onSubmit={handleSearchUser} aria-busy={isSearchingUsers}>
          <div className="search-box">
            <input type="search" aria-label="Cari username" placeholder="Cari username..." value={searchQuery}
              autoCapitalize="none" autoComplete="off" spellCheck={false} enterKeyHint="search"
              disabled={isSearchingUsers} onChange={(event) => {
                setSearchQuery(event.target.value);
                setSearchResults([]);
                clearFeedback();
              }} />
          </div>
          <button type="submit" className="btn btn-primary contact-search-button"
            disabled={!searchQuery.trim() || isSearchingUsers}>
            {isSearchingUsers ? 'Mencari…' : 'Cari User'}
          </button>
        </form>
      </div>
      <div className="contacts-header" style={{ paddingTop: 0 }}>
        <h3 style={{ marginBottom: 12 }}>Hasil Pencarian</h3>
        {isSearchingUsers ? <div className="skeleton-list">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton-item" />)}</div> : searchResults.length === 0 ? <div className="empty-state" style={{ padding: '16px 0' }}><p>Belum ada hasil pencarian</p></div> : (
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
      <h3 style={{ marginBottom: 16 }}>Pengaturan</h3>
      <fieldset className="chat-theme-picker">
        <legend>Tema aplikasi</legend>
        {APP_THEMES.map(({ id, label }) => (
          <label key={id} className="chat-theme-option">
            <input type="radio" name="chat-theme" checked={appTheme === id} onChange={() => selectAppTheme(id)} />
            <span>{label}</span>
            <span className="chat-theme-swatches" data-app-theme={id} aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </label>
        ))}
      </fieldset>
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
      <div className="mobile-app-shell">
        <div className="header mobile-header"><h1>Database (Demo)</h1></div>
        <Feedback />
        <div className="app-scroll-area">
          {activeTab === 'chats' && renderChatsTab()}
          {activeTab === 'contacts' && renderContactsTab()}
          {activeTab === 'profile' && renderProfileTab()}
        </div>
        <div className="bottom-nav mobile-bottom-nav">
          {NAV_ITEMS.map((item) => (
            <button key={item.key} className={`bottom-nav-item ${activeTab === item.key ? 'active' : ''}`} onClick={() => setActiveTab(item.key)}>
              <span className="bottom-nav-icon" aria-hidden="true">{item.icon}</span>
              <span className="bottom-nav-label">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const handleBackToChats = async () => {
    setScreen('app');
    setActiveTab('chats');
    setActiveChat(null);
    setMessageReadMap({});
    setReplyingTo(null);
    clearFeedback();
    await loadInbox();
  };

  const renderChat = () => (
    <div ref={chatScreenRef} className={`screen ${screen === 'chat' ? 'active' : ''}`} id="chat-screen">
      <div className="chat-container">
        <header className="chat-header">
          <button type="button" className="chat-back" onClick={handleBackToChats}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m12 19-7-7 7-7M5 12h14" />
            </svg>
            Daftar pesan
          </button>
          <div className="chat-contact-info">
            <h3>{activeChatTitle}</h3>
            <p>@{activeChat?.otherProfile?.username}</p>
          </div>
        </header>
        {errorMessage && <div className="error-message" role="alert">{errorMessage}</div>}
        <div className="chat-history">
          {chatOpen && wallpaperUrl && <div className="chat-wallpaper" aria-hidden="true" style={{ backgroundImage: `url(${wallpaperUrl})` }} />}
        {isChatOpening ? (
          <div className="chat-loading-shell">
            <div className="chat-loading-header">
              <div className="skeleton-line skeleton-line-title" />
              <div className="skeleton-line skeleton-line-subtitle" />
            </div>
            <div className="chat-messages chat-messages-loading">
              <div className="skeleton-chat">{Array.from({ length: 6 }).map((_, i) => <div key={i} className={`skeleton-bubble ${i % 2 === 0 ? 'left' : 'right'}`} />)}</div>
            </div>
          </div>
        ) : (
        <div className="chat-messages" ref={chatMessagesRef} onScroll={(event) => {
          const { scrollHeight, clientHeight, scrollTop } = event.currentTarget;
          if (clientHeight !== messageViewportHeightRef.current) return;
          keepBottomRef.current = scrollHeight - clientHeight - scrollTop <= 48;
        }}>
          {olderCursor && (
            <button type="button" className="btn btn-secondary chat-load-older" onClick={loadOlderMessages} disabled={isLoadingOlder}>
              {isLoadingOlder ? 'Memuat riwayat…' : 'Muat pesan sebelumnya'}
            </button>
          )}
          {messages.length === 0 ? <div className="empty-state" style={{ padding: '24px' }}><p>Kirim pesan untuk memulai percakapan</p></div> : (
            messages.map((msg) => {
              const isOwn = msg.sender_id === currentUser?.id;
              const reads = messageReadMap[msg.id] || [];
              const readByOther = reads.some((r) => r.profile_id === peerId);
              return (
                <div key={msg.id} className={`message ${isOwn ? 'message-own' : 'message-other'}`} onClick={() => setReplyingTo(msg)}>
                  {msg.reply_to_message_id ? (() => {
                    const repliedMessage = messages.find((item) => item.id === msg.reply_to_message_id);
                    if (!repliedMessage) return null;
                    return (
                      <div className="reply-quote">
                        <div className="reply-quote-author">{getReplyAuthorLabel(repliedMessage)}</div>
                        <div className="reply-quote-text">{getReplyPreviewText(repliedMessage)}</div>
                      </div>
                    );
                  })() : null}
                  {msg.message_type === 'image' && msg.image_url ? (
                    <button type="button" className="message-image-button" aria-label="Buka foto layar penuh" onClick={(event) => {
                      event.stopPropagation();
                      event.currentTarget.focus({ preventScroll: true });
                      setViewedPhoto({ chatId, src: msg.image_url });
                    }}>
                      <img src={msg.image_url} alt="Foto chat" className="message-image" />
                    </button>
                  ) : null}
                  {chatId && msg.message_type === 'voice' && msg.voice_path && (
                    <VoiceMessage path={msg.voice_path} duration={msg.voice_duration_seconds} />
                  )}
                  {chatId && msg.message_type === 'file' && msg.file_path && (
                    <FileMessage path={msg.file_path} name={msg.file_name} />
                  )}
                  {msg.content && <p className="message-content">{msg.content}</p>}
                  <div className="message-meta">
                    <time dateTime={msg.created_at}>{formatTime(new Date(msg.created_at).getTime())}</time>
                    {isOwn && (
                      <span className={`message-receipt ${readByOther ? 'message-receipt-read' : 'message-receipt-sent'}`}>
                        <svg width="14" height="12" viewBox="0 0 16 12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="m1 6 3 3 6-6" />
                          {readByOther && <path d="m7.5 8 1 1 6-6" />}
                        </svg>
                        {readByOther ? 'Dibaca' : 'Terkirim'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
        )}
        </div>
        {!isChatOpening && chatId && (
          <ChatComposer
            key={chatId}
            chatId={chatId}
            replyTo={replyingTo?.id}
            value={messageInput}
            onChange={setMessageInput}
            onSendText={handleSendMessage}
            sendingText={isSendingMessage}
            onError={setErrorMessage}
            onSent={() => {
              setReplyingTo(null);
              loadInbox().catch(() => {});
            }}
          >
            {replyingTo && (
              <div className="replying-bar">
                <div className="replying-copy">
                  <div className="replying-label">Membalas {getReplyAuthorLabel(replyingTo)}</div>
                  <div className="replying-snippet">{getReplyPreviewText(replyingTo)}</div>
                </div>
                <button className="replying-close" type="button" aria-label="Batalkan balasan" onClick={() => setReplyingTo(null)}>×</button>
              </div>
            )}
          </ChatComposer>
        )}
      </div>
    </div>
  );

  return (
    <div className="container">
      {renderLogin()}
      {renderRegister()}
      {renderAppHome()}
      {renderChat()}
      {chatId && viewedPhoto?.chatId === chatId && (
        <ChatPhotoViewer src={viewedPhoto.src} onClose={() => setViewedPhoto(null)} />
      )}
    </div>
  );
}
