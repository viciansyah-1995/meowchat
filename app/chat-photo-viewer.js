'use client';

import { useEffect, useRef, useState } from 'react';

const PHOTO_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/bmp': 'bmp',
  'image/svg+xml': 'svg',
};

export default function ChatPhotoViewer({ src, onClose }) {
  const dialogRef = useRef(null);
  const downloadRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog.open) dialog.showModal();
    return () => downloadRef.current?.abort();
  }, []);

  async function savePhoto() {
    if (downloadRef.current) return;
    const controller = new AbortController();
    downloadRef.current = controller;
    setSaving(true);
    setSaveFailed(false);
    try {
      const response = await fetch(src, { signal: controller.signal });
      if (!response.ok) throw new Error('Gambar tidak tersedia.');
      const photo = await response.blob();
      if (controller.signal.aborted) return;
      if (!photo.size) throw new Error('Foto kosong.');

      const extension = PHOTO_EXTENSIONS[photo.type]
        || new URL(src, window.location.href).pathname.match(/\.([a-z0-9]{1,8})$/i)?.[1];
      const url = URL.createObjectURL(photo);
      const link = document.createElement('a');
      link.href = url;
      link.download = extension ? `foto-chat.${extension}` : 'foto-chat';
      dialogRef.current.append(link);
      try {
        link.click();
      } finally {
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 30000);
      }
    } catch {
      if (!controller.signal.aborted) setSaveFailed(true);
    } finally {
      downloadRef.current = null;
      if (!controller.signal.aborted) setSaving(false);
    }
  }

  return (
    <dialog ref={dialogRef} className="chat-photo-viewer" aria-label="Foto chat layar penuh" onClose={() => {
      downloadRef.current?.abort();
      onClose();
    }}>
      <div className="chat-photo-toolbar">
        <button type="button" className="chat-photo-action" autoFocus onClick={() => dialogRef.current.close()}>
          Tutup
        </button>
        <button type="button" className="chat-photo-action" disabled={saving} onClick={savePhoto}>
          {saving ? 'Menyimpan…' : 'Simpan foto'}
        </button>
      </div>
      <div className="chat-photo-stage">
        <img src={src} alt="Foto dalam percakapan" />
      </div>
      {saveFailed && (
        <p className="chat-photo-error" role="alert">
          Foto gagal disimpan. <a href={src} target="_blank" rel="noreferrer">Buka foto asli</a>
        </p>
      )}
    </dialog>
  );
}
