'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { callPush } from '../lib/services/push.client.js';
import SupabaseChatService from '../lib/services/chat.service.supabase.js';
import { REACTIONS, STICKERS } from '../lib/chat-expressions.js';
import { VoiceComposer } from './voice-note.js';

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

function resizeTextarea(input) {
  const scrollTop = input.scrollTop;
  input.style.height = 'auto';
  input.style.height = `${input.scrollHeight}px`;
  input.scrollTop = scrollTop;
}

function ComposerTextarea({ inputRef, value, onChange, replying }) {
  useLayoutEffect(() => {
    if (CSS.supports('field-sizing', 'content')) return;
    resizeTextarea(inputRef.current);
  }, [inputRef, value]);

  useEffect(() => {
    if (CSS.supports('field-sizing', 'content')) return;
    const input = inputRef.current;
    let width = input.offsetWidth;
    const observer = new ResizeObserver(() => {
      if (width === input.offsetWidth) return;
      width = input.offsetWidth;
      resizeTextarea(input);
    });
    observer.observe(input);
    return () => observer.disconnect();
  }, [inputRef]);

  return (
    <textarea ref={inputRef} className="composer-textarea" aria-label="Tulis pesan" rows={1}
      placeholder={replying ? 'Tulis balasan...' : 'Ketik pesan...'} value={value}
      onChange={(event) => onChange(event.target.value)} />
  );
}

export default function ChatComposer({ chatId, replyTo, value, onChange, onSendText, sendingText, onExpressionSent, onSent, onError, children }) {
  const [showOptions, setShowOptions] = useState(false);
  const [expressionTab, setExpressionTab] = useState(null);
  const [sendingExpression, setSendingExpression] = useState(false);
  const expressionRef = useRef(null);
  const expressionButtonRef = useRef(null);
  const [pingStatus, setPingStatus] = useState('');
  const [sendingPing, setSendingPing] = useState(false);
  const pingRef = useRef(false);
  const [attachment, setAttachment] = useState(null);
  const [sendingAttachment, setSendingAttachment] = useState(false);
  const inputRef = useRef(null);
  const addButtonRef = useRef(null);
  const firstOptionRef = useRef(null);
  const galleryRef = useRef(null);
  const cameraRef = useRef(null);
  const fileRef = useRef(null);
  const sendingRef = useRef(false);
  const alive = useRef(false);
  const optionsId = useId();
  const previewUrl = attachment?.previewUrl;

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  useEffect(() => {
    if (previewUrl) return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    if (expressionTab) expressionButtonRef.current?.focus();
    else if (showOptions) firstOptionRef.current?.focus();
  }, [showOptions, expressionTab]);

  useEffect(() => {
    if (!pingStatus || sendingPing) return;
    const timer = window.setTimeout(() => setPingStatus(''), 6000);
    return () => window.clearTimeout(timer);
  }, [pingStatus, sendingPing]);

  async function sendExpression(type, key) {
    if (expressionRef.current?.sending) return;
    const previous = expressionRef.current;
    const attempt = previous && previous.type === type && previous.key === key
      ? previous : { type, key, id: crypto.randomUUID() };
    attempt.sending = true;
    expressionRef.current = attempt;
    setSendingExpression(true);
    onError('');
    try {
      const result = await SupabaseChatService.sendExpression(chatId, type, key, attempt.id, replyTo);
      if (!result.success) throw result.error;
      if (!alive.current) return;
      expressionRef.current = null;
      if (type === 'reaction') setExpressionTab(null);
      setShowOptions(false);
      onExpressionSent(result.data);
      addButtonRef.current?.focus();
    } catch {
      if (alive.current) onError('Ekspresi gagal dikirim. Coba lagi.');
    } finally {
      attempt.sending = false;
      if (alive.current) setSendingExpression(false);
    }
  }

  async function sendPing() {
    if (pingRef.current) return;
    pingRef.current = true;
    setShowOptions(false);
    setSendingPing(true);
    setPingStatus('Mengirim PING…');
    onError('');
    try {
      const result = await callPush('POST', { chatId });
      if (!alive.current) return;
      setPingStatus(result.pushed
        ? 'PING terkirim.'
        : result.targetCount ? 'PING masuk ke chat. Push tidak berhasil dikirim.'
          : 'PING masuk ke chat. Lawan chat belum mengaktifkan notifikasi.');
    } catch (cause) {
      if (alive.current) {
        setPingStatus('');
        onError(cause.message || 'Gagal mengirim PING.');
      }
    } finally {
      pingRef.current = false;
      if (alive.current) setSendingPing(false);
    }
  }

  function openPicker(input) {
    setShowOptions(false);
    input.current?.click();
  }

  function pickAttachment(event, kind) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (kind === 'image' && !file.type.startsWith('image/')) {
      onError('Pilih file gambar dari galeri atau kamera.');
      return;
    }
    if (!file.size || file.size > MAX_ATTACHMENT_BYTES) {
      onError(file.size ? 'Ukuran lampiran maksimal 10 MB.' : 'File kosong. Pilih file lain.');
      return;
    }
    onError('');
    setAttachment({
      kind,
      file,
      id: crypto.randomUUID(),
      previewUrl: kind === 'image' ? URL.createObjectURL(file) : null,
    });
  }

  async function sendAttachment() {
    if (!attachment || sendingRef.current) return;
    sendingRef.current = true;
    setSendingAttachment(true);
    onError('');
    try {
      let result;
      if (attachment.kind === 'image') {
        const upload = await SupabaseChatService.uploadChatImage(attachment.file);
        if (!upload.success) throw upload.error;
        result = await SupabaseChatService.sendImageMessage(chatId, upload.data.publicUrl, replyTo);
      } else {
        result = await SupabaseChatService.sendFileMessage(chatId, attachment, replyTo);
      }
      if (!result.success) throw result.error;
      if (!alive.current) return;
      setAttachment(null);
      onSent();
    } catch {
      if (alive.current) onError('Lampiran gagal dikirim. Coba kirim lagi.');
    } finally {
      sendingRef.current = false;
      if (alive.current) setSendingAttachment(false);
    }
  }

  const expressionPicker = expressionTab && (
    <div id={optionsId} className="expression-picker" role="group" aria-label={expressionTab === 'reaction' ? 'Pilih reaksi' : 'Pilih stiker'}>
      <div className="expression-picker-heading">
        <button type="button" disabled={sendingExpression} onClick={() => {
          setExpressionTab(null);
          if (expressionTab === 'sticker') inputRef.current?.focus();
          else firstOptionRef.current?.focus();
        }}>{expressionTab === 'sticker' ? 'Keyboard' : 'Kembali'}</button>
        <span>{expressionTab === 'reaction' ? 'Reaksi' : 'Stiker Kucing'}</span>
      </div>
      <div className={expressionTab === 'reaction' ? 'expression-grid reaction-grid' : 'expression-grid sticker-grid'}>
        {(expressionTab === 'reaction' ? REACTIONS : STICKERS).map((choice, index) => (
          <button key={choice.id} ref={index === 0 ? expressionButtonRef : null} type="button"
            aria-label={`Kirim ${expressionTab === 'reaction' ? 'reaksi' : 'stiker'} ${choice.label}`}
            disabled={sendingExpression} onClick={() => sendExpression(expressionTab, choice.id)}>
            {expressionTab === 'reaction'
              ? <span className="reaction-picker-emoji" aria-hidden="true">{choice.emoji}</span>
              : <img src={choice.src} alt="" />}
            <span>{choice.label}</span>
          </button>
        ))}
      </div>
      {sendingExpression && <p role="status">Mengirim…</p>}
    </div>
  );

  return (
    <div className="chat-input-area-wrapper">
      {children}
      <div className="chat-input-area">
        {pingStatus && <p className="composer-ping-status" role="status">{pingStatus}</p>}
        <div className={showOptions ? 'composer-card composer-card-options' : 'composer-card'} onKeyDown={(event) => {
          if (event.key !== 'Escape' || (!showOptions && !expressionTab) || sendingExpression) return;
          setExpressionTab(null);
          setShowOptions(false);
          addButtonRef.current?.focus();
        }}>
          <input ref={galleryRef} type="file" accept="image/*" onChange={(event) => pickAttachment(event, 'image')} hidden />
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={(event) => pickAttachment(event, 'image')} hidden />
          <input ref={fileRef} type="file" onChange={(event) => pickAttachment(event, 'file')} hidden />
          <VoiceComposer chatId={chatId} disabled={sendingText || sendingAttachment || sendingExpression} replyTo={replyTo} onSent={onSent}>
            {({ record, panel }) => panel || (
              <>
                {expressionTab === 'reaction' ? (
                  expressionPicker
                ) : showOptions ? (
                  <div className="composer-options" id={optionsId} role="group" aria-label="Opsi chat">
                    <button ref={firstOptionRef} type="button" onClick={() => openPicker(galleryRef)}>Galeri</button>
                    <button type="button" onClick={() => openPicker(cameraRef)}>Kamera</button>
                    <button type="button" onClick={() => openPicker(fileRef)}>File</button>
                    <button type="button" onClick={() => { setShowOptions(false); record(); }}>Voice note</button>
                    <button type="button" onClick={() => setExpressionTab('reaction')}>Reaksi</button>
                    <button type="button" onClick={() => { setShowOptions(false); setExpressionTab('sticker'); }}>Stiker</button>
                    <button type="button" className="composer-ping-option" onClick={sendPing} disabled={sendingPing}>PING!</button>
                  </div>
                ) : attachment ? (
                  <div className="composer-attachment">
                    {previewUrl && <img src={previewUrl} alt="Pratinjau gambar" className="pending-image-preview" />}
                    <span className="replying-snippet">{attachment.file.name}</span>
                    <button className="replying-close" type="button" aria-label="Hapus lampiran"
                      disabled={sendingAttachment} onClick={() => setAttachment(null)}>×</button>
                  </div>
                ) : (
                  <ComposerTextarea inputRef={inputRef} value={value} onChange={onChange} replying={Boolean(replyTo)} />
                )}
                <div className="composer-toolbar">
                  <div className="composer-shortcuts">
                  <button ref={addButtonRef} type="button" className="chat-btn chat-btn-attach"
                    aria-label="Tambah lampiran" aria-expanded={showOptions} aria-controls={showOptions ? optionsId : undefined}
                    disabled={sendingText || sendingAttachment || sendingExpression || Boolean(attachment)}
                    onMouseDown={(event) => {
                      if (document.activeElement === inputRef.current) event.preventDefault();
                    }}
                    onClick={() => {
                      inputRef.current?.blur();
                      setExpressionTab(null);
                      setShowOptions(!showOptions);
                      addButtonRef.current?.focus();
                    }}>
                    <span aria-hidden="true">{showOptions ? '×' : '+'}</span>
                  </button>
                  {!showOptions && expressionTab !== 'reaction' && (
                    <button type="button" className="chat-btn composer-sticker-shortcut"
                      aria-label={expressionTab === 'sticker' ? 'Kembali ke keyboard' : 'Buka stiker'}
                      aria-expanded={expressionTab === 'sticker'} aria-controls={expressionTab === 'sticker' ? optionsId : undefined}
                      disabled={sendingText || sendingAttachment || sendingExpression || Boolean(attachment)}
                      onClick={() => {
                        if (expressionTab === 'sticker') {
                          setExpressionTab(null);
                          inputRef.current?.focus();
                        } else {
                          inputRef.current?.blur();
                          setExpressionTab('sticker');
                        }
                      }}>
                      {expressionTab === 'sticker' ? (
                        <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                          <rect x="2" y="5" width="20" height="14" rx="3" />
                          <path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M7 15h10" />
                        </svg>
                      ) : (
                        <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M20 13V6a3 3 0 0 0-3-3H6a3 3 0 0 0-3 3v11a3 3 0 0 0 3 3h7z" />
                          <path d="M20 13h-4a3 3 0 0 0-3 3v4M8 8h.01M15 8h.01M8 12c1.5 1.5 3.5 1.5 5 0" />
                        </svg>
                      )}
                    </button>
                  )}
                  </div>
                  {!showOptions && (
                    <button type="button" className="chat-btn chat-btn-send"
                      aria-label={attachment ? 'Kirim lampiran' : 'Kirim pesan'}
                      disabled={sendingText || sendingAttachment || sendingExpression || (!attachment && !value.trim())}
                      onClick={attachment ? sendAttachment : onSendText}>
                      <span aria-hidden="true">{sendingText || sendingAttachment ? '…' : '↑'}</span>
                    </button>
                  )}
                </div>
                {expressionTab === 'sticker' && expressionPicker}
              </>
            )}
          </VoiceComposer>
        </div>
      </div>
    </div>
  );
}
