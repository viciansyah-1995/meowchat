'use client';

import { useEffect, useRef, useState } from 'react';
import SupabaseChatService from '../lib/services/chat.service.supabase.js';

const MAX_SECONDS = 60;
const VOICE_FORMATS = {
  'audio/webm': 'webm',
  'audio/mp4': 'm4a',
  'audio/ogg': 'ogg',
};

function showDuration(seconds) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function VoiceComposer({ chatId, disabled, replyTo, onSent }) {
  const [phase, setPhase] = useState('idle');
  const [elapsed, setElapsed] = useState(0);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState('');
  const recordingRef = useRef(null);
  const sendingRef = useRef(false);
  const aliveRef = useRef(false);
  const previewUrl = draft?.url;

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      recordingRef.current?.cancel();
    };
  }, []);

  useEffect(() => {
    if (previewUrl) return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  async function record() {
    if (disabled || recordingRef.current || draft) return;
    setError('');
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Browser ini belum mendukung perekaman suara.');
      return;
    }

    const attempt = { cancel: () => { recordingRef.current = null; } };
    recordingRef.current = attempt;
    setPhase('requesting');
    let stream;
    try {
      const mimeType = Object.keys(VOICE_FORMATS).find((type) => MediaRecorder.isTypeSupported(type));
      if (!mimeType) throw new Error('Format rekaman tidak didukung.');
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (recordingRef.current !== attempt) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 64000 });
      const chunks = [];
      const startedAt = performance.now();
      let duration = 1;
      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        window.clearInterval(ticker);
        window.clearTimeout(limit);
        document.removeEventListener('visibilitychange', onVisibility);
        stream.getTracks().forEach((track) => track.stop());
      };
      const stop = () => {
        if (recorder.state === 'inactive') return;
        duration = Math.min(MAX_SECONDS, Math.max(1, Math.ceil((performance.now() - startedAt) / 1000)));
        setPhase('finishing');
        recorder.stop();
      };
      const onVisibility = () => {
        if (document.visibilityState === 'hidden') stop();
      };
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder.onstop = () => {
        release();
        if (recordingRef.current !== attempt) return;
        recordingRef.current = null;
        setPhase('idle');
        const type = (recorder.mimeType || mimeType).split(';')[0];
        const blob = new Blob(chunks, { type });
        if (!blob.size || blob.size > 5 * 1024 * 1024 || !VOICE_FORMATS[type]) {
          setError('Rekaman tidak bisa digunakan. Coba rekam ulang.');
          return;
        }
        setDraft({ id: crypto.randomUUID(), blob, extension: VOICE_FORMATS[type], duration, url: URL.createObjectURL(blob) });
      };
      recorder.onerror = () => {
        if (recordingRef.current !== attempt) return;
        attempt.cancel();
        setPhase('idle');
        setError('Rekaman gagal. Coba lagi.');
      };
      recorder.start();
      const ticker = window.setInterval(() => {
        setElapsed(Math.min(MAX_SECONDS, Math.floor((performance.now() - startedAt) / 1000)));
      }, 250);
      const limit = window.setTimeout(stop, MAX_SECONDS * 1000);
      document.addEventListener('visibilitychange', onVisibility);
      attempt.stop = stop;
      attempt.cancel = () => {
        recordingRef.current = null;
        if (recorder.state !== 'inactive') recorder.stop();
        release();
      };
      setElapsed(0);
      setPhase('recording');
      if (document.visibilityState === 'hidden') stop();
    } catch (cause) {
      stream?.getTracks().forEach((track) => track.stop());
      if (recordingRef.current !== attempt) return;
      recordingRef.current = null;
      setPhase('idle');
      setError(cause.name === 'NotAllowedError' ? 'Izinkan akses mikrofon untuk merekam.' : 'Mikrofon tidak bisa digunakan.');
    }
  }

  async function send() {
    if (!draft || disabled || sendingRef.current) return;
    sendingRef.current = true;
    setPhase('sending');
    setError('');
    try {
      const result = await SupabaseChatService.sendVoiceMessage(chatId, draft, replyTo);
      if (!result.success) throw result.error;
      if (!aliveRef.current) return;
      setDraft(null);
      onSent();
    } catch {
      if (aliveRef.current) setError('Voice note gagal dikirim. Coba kirim lagi.');
    } finally {
      sendingRef.current = false;
      if (aliveRef.current) setPhase('idle');
    }
  }

  return (
    <div className="voice-composer">
      <button type="button" className="chat-btn chat-btn-attach" aria-label={phase === 'recording' ? 'Hentikan rekaman' : 'Rekam voice note'}
        disabled={phase !== 'recording' && (disabled || phase !== 'idle' || Boolean(draft))}
        onClick={() => phase === 'recording' ? recordingRef.current?.stop() : record()}>
        <span aria-hidden="true">{phase === 'recording' ? '■' : '🎙️'}</span>
      </button>
      {(phase !== 'idle' || draft || error) && (
        <div className="voice-panel">
          {phase === 'requesting' && <p role="status">Menunggu izin mikrofon…</p>}
          {phase === 'recording' && <p>Merekam {showDuration(elapsed)} / 1:00</p>}
          {phase === 'finishing' && <p role="status">Menyiapkan rekaman…</p>}
          {draft && (
            <>
              <p>Pratinjau voice note · {showDuration(draft.duration)}</p>
              <audio controls src={draft.url} preload="metadata" />
              <div className="voice-actions">
                <button type="button" className="btn btn-secondary" disabled={phase === 'sending'} onClick={() => { setDraft(null); setError(''); }}>Buang</button>
                <button type="button" className="btn btn-primary" disabled={disabled || phase === 'sending'} onClick={send}>{phase === 'sending' ? 'Mengirim…' : 'Kirim voice note'}</button>
              </div>
            </>
          )}
          {error && <p className="voice-error" role="alert">{error}</p>}
          {error && !draft && <button type="button" className="btn btn-secondary" onClick={() => setError('')}>Tutup</button>}
        </div>
      )}
    </div>
  );
}

export function VoiceMessage({ path, duration }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const aliveRef = useRef(false);

  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  useEffect(() => {
    if (url) return () => URL.revokeObjectURL(url);
  }, [url]);

  async function load() {
    setLoading(true);
    setError(false);
    try {
      const result = await SupabaseChatService.downloadVoice(path);
      if (result.error || !result.data?.size) throw result.error;
      if (aliveRef.current) setUrl(URL.createObjectURL(result.data));
    } catch {
      if (aliveRef.current) setError(true);
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }

  return (
    <div className="voice-message" onClick={(event) => event.stopPropagation()}>
      <p>Voice note · {showDuration(duration)}</p>
      {url ? <audio controls autoPlay src={url} /> : (
        <button type="button" className="btn btn-secondary" onClick={load} disabled={loading}>
          {loading ? 'Memuat…' : error ? 'Coba putar lagi' : 'Putar'}
        </button>
      )}
    </div>
  );
}
