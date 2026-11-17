'use client';

import { useEffect, useState } from 'react';
import { disablePush, enablePush, preparePush } from '../lib/services/push.client.js';

export default function PushSettings({ userId }) {
  const [device, setDevice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    preparePush(userId).then((settings) => {
      if (active) setDevice(settings);
    }).catch((cause) => {
      if (active) setError(cause.message);
    });
    return () => { active = false; };
  }, [userId]);

  async function toggle() {
    setBusy(true);
    setError('');
    try {
      if (device.enabled) await disablePush();
      else await enablePush(device, userId);
      setDevice({ ...device, enabled: !device.enabled });
    } catch (cause) {
      setError(cause.message || 'Gagal mengubah notifikasi.');
      const revised = await preparePush(userId).catch(() => null);
      if (revised) setDevice(revised);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="push-settings" aria-labelledby="push-settings-title">
      <h4 id="push-settings-title">Notifikasi PING</h4>
      {device?.supported === false && <p>Notifikasi push belum tersedia di browser ini. Di iPhone atau iPad, buka aplikasi dari Layar Utama.</p>}
      {device?.supported && !device.configured && <p>Notifikasi belum tersedia.</p>}
      {!device && !error && <p role="status">Memeriksa dukungan notifikasi…</p>}
      {device?.configured && (
        <>
          <p>{device.enabled ? 'Aktif di perangkat ini.' : 'Terima PING saat aplikasi tidak sedang dibuka.'}</p>
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={toggle}>
            {device.enabled ? 'Nonaktifkan notifikasi' : 'Aktifkan notifikasi'}
          </button>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
