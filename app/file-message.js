'use client';

import { useRef, useState } from 'react';
import SupabaseChatService from '../lib/services/chat.service.supabase.js';

export function FileMessage({ path, name }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const downloading = useRef(false);

  async function download() {
    if (downloading.current) return;
    downloading.current = true;
    setLoading(true);
    setError(false);
    try {
      const { data, error } = await SupabaseChatService.downloadFile(path);
      if (error || !data) throw error;
      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = name;
      document.body.append(link);
      try {
        link.click();
      } finally {
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 30000);
      }
    } catch {
      setError(true);
    } finally {
      downloading.current = false;
      setLoading(false);
    }
  }

  return (
    <div className="file-message" onClick={(event) => event.stopPropagation()}>
      <p className="file-message-name">{name}</p>
      <button type="button" className="btn btn-secondary" disabled={loading} onClick={download}>
        {loading ? 'Mengunduh…' : error ? 'Coba unduh lagi' : 'Unduh file'}
      </button>
      {error && <p className="voice-error" role="alert">File gagal diunduh.</p>}
    </div>
  );
}
