'use client';

export default function PausedChatComposer({ value }) {
  return (
    <div className="chat-input-area-wrapper">
      <div className="chat-input-area">
        <div className="composer-card composer-card-paused">
          <textarea className="composer-textarea" aria-label="Tulis pesan"
            rows={1} value={value} disabled readOnly placeholder="Ketik pesan..." />
          <div className="composer-toolbar">
            <button type="button" className="chat-btn chat-btn-attach" aria-label="Tambah lampiran" disabled>+</button>
            <button type="button" className="chat-btn chat-btn-send" aria-label="Kirim pesan" disabled>↑</button>
          </div>
        </div>
      </div>
    </div>
  );
}
