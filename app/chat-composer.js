'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import SupabaseChatService from '../lib/services/chat.service.supabase.js';
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

export default function ChatComposer({ chatId, replyTo, value, onChange, onSendText, sendingText, onSent, onError, children }) {
  const [showOptions, setShowOptions] = useState(false);
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
    if (showOptions) firstOptionRef.current?.focus();
  }, [showOptions]);

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

  return (
    <div className="chat-input-area-wrapper">
      {children}
      <div className="chat-input-area">
        <div className={showOptions ? 'composer-card composer-card-options' : 'composer-card'} onKeyDown={(event) => {
          if (event.key !== 'Escape' || !showOptions) return;
          setShowOptions(false);
          addButtonRef.current?.focus();
        }}>
          <input ref={galleryRef} type="file" accept="image/*" onChange={(event) => pickAttachment(event, 'image')} hidden />
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={(event) => pickAttachment(event, 'image')} hidden />
          <input ref={fileRef} type="file" onChange={(event) => pickAttachment(event, 'file')} hidden />
          <VoiceComposer chatId={chatId} disabled={sendingText || sendingAttachment} replyTo={replyTo} onSent={onSent}>
            {({ record, panel }) => panel || (
              <>
                {showOptions ? (
                  <div className="composer-options" id={optionsId} role="group" aria-label="Jenis lampiran">
                    <button ref={firstOptionRef} type="button" onClick={() => openPicker(galleryRef)}>Galeri</button>
                    <button type="button" onClick={() => openPicker(cameraRef)}>Kamera</button>
                    <button type="button" onClick={() => openPicker(fileRef)}>File</button>
                    <button type="button" onClick={() => { setShowOptions(false); record(); }}>Voice note</button>
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
                  <button ref={addButtonRef} type="button" className="chat-btn chat-btn-attach"
                    aria-label="Tambah lampiran" aria-expanded={showOptions} aria-controls={showOptions ? optionsId : undefined}
                    disabled={sendingText || sendingAttachment || Boolean(attachment)}
                    onMouseDown={(event) => {
                      if (document.activeElement === inputRef.current) event.preventDefault();
                    }}
                    onClick={() => {
                      inputRef.current?.blur();
                      setShowOptions(!showOptions);
                      addButtonRef.current?.focus();
                    }}>
                    <span aria-hidden="true">{showOptions ? '×' : '+'}</span>
                  </button>
                  {!showOptions && (
                    <button type="button" className="chat-btn chat-btn-send"
                      aria-label={attachment ? 'Kirim lampiran' : 'Kirim pesan'}
                      disabled={sendingText || sendingAttachment || (!attachment && !value.trim())}
                      onClick={attachment ? sendAttachment : onSendText}>
                      <span aria-hidden="true">{sendingText || sendingAttachment ? '…' : '↑'}</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </VoiceComposer>
        </div>
      </div>
    </div>
  );
}
