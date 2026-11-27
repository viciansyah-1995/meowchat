'use client';

import { useId } from 'react';

export default function PausedChatComposer({ value }) {
  const noticeId = useId();
  return (
    <div className="chat-input-area-wrapper">
      <div className="chat-input-area">
        <div className="composer-card composer-card-paused">
          <textarea className="composer-textarea" aria-label="Tulis pesan" aria-describedby={noticeId}
            rows={1} value={value} disabled readOnly placeholder="Chat dinonaktifkan sementara" />
          <div className="composer-toolbar">
            <button type="button" className="chat-btn chat-btn-attach" aria-label="Tambah lampiran" disabled>+</button>
            <button type="button" className="chat-btn chat-btn-send" aria-label="Kirim pesan" disabled>↑</button>
          </div>
        </div>
        <p className="composer-paused-notice" id={noticeId} role="status">Pengiriman pesan dinonaktifkan sementara.</p>
      </div>
    </div>
  );
}
