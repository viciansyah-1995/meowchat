'use client';

import { useEffect, useRef, useState } from 'react';
import { formatTime } from '../lib/utils/index.js';
import SupabaseChatService from '../lib/services/chat.service.supabase.js';
import { FileMessage } from './file-message.js';
import { VoiceMessage } from './voice-note.js';
import { ExpressionMessage } from './chat-expressions.js';
import { MessageStarButton } from './message-stars.js';

export default function ChatMedia({ chatId, title, stars, userId, onClose, onViewPhoto }) {
  const dialogRef = useRef(null);
  const requestRef = useRef(null);
  const [media, setMedia] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  async function load(before) {
    if (requestRef.current) return;
    const request = {};
    requestRef.current = request;
    setLoading(true);
    setError(false);
    try {
      const result = stars
        ? await SupabaseChatService.getStarredMessages(userId, chatId, before)
        : await SupabaseChatService.getMedia(chatId, before);
      if (!result.success) throw result.error;
      if (requestRef.current !== request) return;
      setMedia((previous) => before ? [...previous, ...result.data] : result.data);
      setCursor(result.olderCursor);
    } catch {
      if (requestRef.current === request) setError(true);
    } finally {
      if (requestRef.current === request) {
        requestRef.current = null;
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    if (!dialogRef.current.open) dialogRef.current.showModal();
    load(null);
    return () => { requestRef.current = null; };
  }, [chatId]);

  return (
    <dialog className="chat-media-dialog" ref={dialogRef} aria-labelledby="chat-media-title" onClose={onClose}>
      <header className="chat-header chat-media-header">
        <button type="button" className="chat-back" autoFocus onClick={() => dialogRef.current.close()}>Kembali</button>
        <div className="chat-contact-info">
          <h3 id="chat-media-title">{stars ? 'Pesan Berbintang' : 'Media chat'}</h3>
          <p>{title}</p>
        </div>
      </header>
      <div className="chat-media-scroll" aria-busy={loading}>
        <ul className={stars ? 'chat-media-list starred-message-list' : 'chat-media-list'}>
          {media.map((message) => (
            <li key={message.id} className="chat-media-item">
              {message.message_type === 'image' && message.image_url && (
                <button type="button" className="message-image-button chat-media-photo" aria-label="Buka foto layar penuh"
                  onClick={(event) => {
                    event.currentTarget.focus({ preventScroll: true });
                    onViewPhoto(message.image_url);
                  }}>
                  <img src={message.image_url} alt="Foto chat" loading="lazy" />
                </button>
              )}
              {message.message_type === 'voice' && message.voice_path && (
                <VoiceMessage path={message.voice_path} duration={message.voice_duration_seconds} />
              )}
              {message.message_type === 'file' && message.file_path && (
                <FileMessage path={message.file_path} name={message.file_name} />
              )}
              <ExpressionMessage message={message} />
              {stars && message.content && <p className="message-content">{message.content}</p>}
              <div className="collection-message-meta">
                <time dateTime={message.created_at}>
                  {new Date(message.created_at).toLocaleDateString('id-ID')} · {formatTime(new Date(message.created_at).getTime())}
                </time>
                {stars && <MessageStarButton messageId={message.id} stars={stars}
                  onUnstar={() => setMedia((previous) => previous.filter((item) => item.id !== message.id))} />}
              </div>
            </li>
          ))}
        </ul>
        {!loading && !error && !cursor && !media.length && (
          <p className="empty-state">{stars ? 'Belum ada pesan berbintang.' : 'Belum ada media di chat ini.'}</p>
        )}
        {stars?.error && (
          <div className="chat-media-status">
            <p role="alert">{stars.error}</p>
            {!stars.ready && <button type="button" className="btn btn-secondary" onClick={stars.retry}>Muat ulang bintang</button>}
          </div>
        )}
        {loading && <p className="chat-media-status" role="status">{stars ? 'Memuat pesan…' : 'Memuat media…'}</p>}
        {error && <p className="chat-media-status" role="alert">{stars ? 'Pesan berbintang gagal dimuat.' : 'Media gagal dimuat.'}</p>}
        {!loading && (error || cursor) && (
          <button type="button" className="btn btn-secondary chat-media-more" onClick={() => load(cursor)}>
            {error ? 'Coba lagi' : stars ? 'Muat pesan sebelumnya' : 'Muat media sebelumnya'}
          </button>
        )}
      </div>
    </dialog>
  );
}
