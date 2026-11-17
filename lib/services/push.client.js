import getSupabaseClient from '../supabase/client.js';
import { readLocalPreference, writeLocalPreference } from '../storage/preferences.js';

const OWNER_KEY = 'database-push-owner';
const PREVIOUS_OWNER_KEY = 'meowchat-push-owner';

export function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export async function callPush(method, body) {
  const { data } = await getSupabaseClient().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Silakan masuk kembali.');
  const response = await fetch('/api/push', {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Gagal terhubung ke notifikasi.');
  return result;
}

function decodePublicKey(key) {
  const base64 = (key + '='.repeat((4 - key.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

export async function preparePush(userId) {
  if (!pushSupported()) return { supported: false };
  const response = await fetch('/api/push');
  if (!response.ok) throw new Error('Pengaturan notifikasi tidak bisa dimuat.');
  const { publicKey } = await response.json();
  if (!publicKey) return { supported: true, configured: false, permission: Notification.permission };
  await navigator.serviceWorker.register('/service-worker.js');
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  return {
    supported: true,
    configured: true,
    registration,
    publicKey,
    permission: Notification.permission,
    enabled: Boolean(subscription && readLocalPreference(OWNER_KEY, PREVIOUS_OWNER_KEY) === userId && Notification.permission === 'granted'),
  };
}

export async function enablePush({ registration, publicKey }, userId) {
  // Request permission from the Settings button gesture.
  if (await Notification.requestPermission() !== 'granted') {
    throw new Error('Izinkan notifikasi dari pengaturan browser.');
  }
  const applicationServerKey = decodePublicKey(publicKey);
  let subscription = await registration.pushManager.getSubscription();
  const currentKey = subscription?.options.applicationServerKey;
  if (currentKey && new Uint8Array(currentKey).some((value, index) => value !== applicationServerKey[index])) {
    await removeSubscription(subscription);
    subscription = null;
  }
  const created = !subscription;
  subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
  try {
    await callPush('PUT', subscription.toJSON());
    writeLocalPreference(OWNER_KEY, userId, PREVIOUS_OWNER_KEY);
  } catch (error) {
    if (created) await subscription.unsubscribe().catch(() => {});
    throw error;
  }
}

async function removeSubscription(subscription) {
  try {
    await callPush('DELETE', { endpoint: subscription.endpoint });
  } finally {
    await subscription.unsubscribe();
    writeLocalPreference(OWNER_KEY, null, PREVIOUS_OWNER_KEY);
  }
}

export async function disablePush() {
  if (!pushSupported()) return;
  const registration = await navigator.serviceWorker.getRegistration('/');
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) await removeSubscription(subscription);
}

export async function previewPingNotification(registration) {
  if (Notification.permission !== 'granted') throw new Error('Izinkan notifikasi di pengaturan browser.');
  await registration.showNotification('Database', {
    body: 'Your deployment is Success!',
    icon: '/app-icon.jpg',
  });
}
