'use client';

import { useEffect, useState } from 'react';
import { disablePush, enablePush, preparePush, previewPingNotification } from '../lib/services/push.client.js';

const PERMISSION_LABEL = {
  granted: 'Diizinkan',
  denied: 'Diblokir',
  default: 'Belum dipilih',
};

export default function PushSettings({ userId }) {
  const [device, setDevice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    preparePush(userId).then((settings) => {
      if (active) setDevice(settings);
    }).catch((cause) => {
      if (active) setError(cause.message);
    });
    return () => { active = false; };
  }, [userId, refresh]);

  async function toggle() {
    setBusy(true);
    setError('');
    setStatus('');
    try {
      if (device.enabled) await disablePush();
      else await enablePush(device, userId);
      setStatus(device.enabled ? 'Notifikasi PING dinonaktifkan.' : 'Notifikasi PING diaktifkan.');
    } catch (cause) {
      setError(cause.message || 'Gagal mengubah notifikasi.');
    } finally {
      const revised = await preparePush(userId).catch(() => null);
      if (revised) setDevice(revised);
      setBusy(false);
    }
  }

  async function preview() {
    setBusy(true);
    setError('');
    setStatus('');
    try {
      await previewPingNotification(device.registration);
      setStatus('Notifikasi tes ditampilkan di perangkat ini.');
    } catch {
      setError('Gagal menampilkan notifikasi tes. Periksa izin browser.');
    } finally {
      setBusy(false);
    }
  }

  function reloadSettings() {
    setError('');
    setStatus('');
    setDevice(null);
    setRefresh((value) => value + 1);
  }

  return (
    <section className="push-settings" aria-labelledby="push-settings-title">
      <h4 id="push-settings-title">Notifikasi push</h4>
      {device?.supported === false && <p>Notifikasi push belum tersedia di browser ini. Di iPhone atau iPad, buka aplikasi dari Layar Utama.</p>}
      {device?.supported && !device.configured && <p>Layanan push belum tersedia.</p>}
      {!device && !error && <p role="status">Memeriksa dukungan notifikasi…</p>}
      {device?.configured && (
        <>
          <dl className="push-status-list">
            <div><dt>Izin browser</dt><dd>{PERMISSION_LABEL[device.permission]}</dd></div>
            <div><dt>PING di perangkat ini</dt><dd>{device.enabled ? 'Aktif' : 'Nonaktif'}</dd></div>
          </dl>
          {device.permission === 'denied' && <p>Izinkan notifikasi di pengaturan browser, lalu periksa ulang.</p>}
          <div className="push-settings-actions">
            <button type="button" className="btn btn-secondary" disabled={busy || device.permission === 'denied'} onClick={toggle}>
              {device.enabled ? 'Nonaktifkan PING' : 'Aktifkan PING'}
            </button>
            {device.enabled && (
              <button type="button" className="btn btn-secondary" disabled={busy} onClick={preview}>Uji tampilan</button>
            )}
            {device.permission === 'denied' && (
              <button type="button" className="btn btn-secondary" onClick={reloadSettings}>Periksa ulang</button>
            )}
          </div>
        </>
      )}
      {error && <p role="alert">{error}</p>}
      {!device && error && <button type="button" className="btn btn-secondary" onClick={reloadSettings}>Coba lagi</button>}
      {status && <p role="status">{status}</p>}
    </section>
  );
}
