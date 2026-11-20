'use client';
import { useEffect, useRef, useState } from 'react';
import MomentsService from '../lib/services/moments.service.supabase.js';
import { compressMomentPhoto } from '../lib/compress-moment-photo.js';
import MessageText from './message-text.js';

export default function ChatMoments({ chatId, userId, title, onClose, onViewPhoto }) {
  const dialog = useRef(null);
  const alive = useRef(true);
  const pending = useRef(false);
  const searchRequest = useRef(null);
  const photoRequest = useRef(0);
  const listRequest = useRef(0);
  const postId = useRef(null);
  const [moments, setMoments] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState('');
  const [places, setPlaces] = useState([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [place, setPlace] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const [caption, setCaption] = useState('');
  const [compressing, setCompressing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    alive.current = true; dialog.current.showModal(); load();
    const visible = () => { if (document.visibilityState === 'visible' && !pending.current) load(); };
    document.addEventListener('visibilitychange', visible);
    return () => { alive.current = false; listRequest.current++; photoRequest.current++; searchRequest.current?.abort(); document.removeEventListener('visibilitychange', visible); };
  }, [chatId]);
  useEffect(() => {
    if (!photo) { setPreview(null); return; }
    const url = URL.createObjectURL(photo); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);
  async function load(before = null) {
    const request = ++listRequest.current; setLoading(true);
    try {
      const rows = await MomentsService.list(chatId, before);
      if (!alive.current || listRequest.current !== request) return;
      setMoments(previous => before ? [...previous, ...rows.filter(row => !previous.some(item => item.id === row.id))] : rows);
      setCursor(rows.length === 20 ? rows[rows.length - 1] : null);
      setError('');
    } catch { if (alive.current && listRequest.current === request) setError('Momen belum bisa dibuka. Coba muat ulang, ya.'); }
    finally { if (alive.current && listRequest.current === request) setLoading(false); }
  }
  async function search() {
    if (searching || query.trim().length < 3) return;
    searchRequest.current?.abort();
    const request = new AbortController(); searchRequest.current = request;
    setSearching(true); setError(''); setPlaces([]); setSearched(false);
    try {
      const rows = await MomentsService.search(chatId, query.trim(), request.signal);
      if (alive.current && searchRequest.current === request) { setPlaces(rows); setSearched(true); }
    } catch (cause) { if (alive.current && !request.signal.aborted) setError(cause.message || 'Tempat belum bisa dicari.'); }
    finally { if (alive.current && searchRequest.current === request) { setSearching(false); searchRequest.current = null; } }
  }
  async function pickPhoto(event) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    postId.current = null;
    const request = ++photoRequest.current;
    setCompressing(true); setPhoto(null); setError('');
    try {
      const compressed = await compressMomentPhoto(file);
      if (alive.current && photoRequest.current === request) setPhoto(compressed);
    } catch (cause) { if (alive.current && photoRequest.current === request) setError(cause.message); }
    finally { if (alive.current && photoRequest.current === request) setCompressing(false); }
  }
  async function publish(event) {
    event.preventDefault(); if (pending.current || !place || !photo || compressing) return;
    pending.current = true; setBusy(true); setError('');
    postId.current ||= crypto.randomUUID();
    try {
      await MomentsService.create({ chatId, id: postId.current, place, photo, caption });
      if (!alive.current) return;
      setCreating(false); setPlace(null); setPhoto(null); setCaption(''); setQuery(''); setPlaces([]); setSearched(false); postId.current = null;
      setNotice('Satu tempat, satu cerita baru buat kalian ♡'); await load();
    } catch { if (alive.current) setError('Momen belum berhasil dikonfirmasi. Coba simpan lagi; foto tidak akan digandakan.'); }
    finally { pending.current = false; if (alive.current) setBusy(false); }
  }
  async function viewPhoto(moment) {
    try { const url = await MomentsService.photo(moment.photo_path); if (alive.current) onViewPhoto(url); }
    catch { if (alive.current) setError('Foto belum bisa dibuka. Coba lagi, ya.'); }
  }
  return <dialog ref={dialog} className="chat-media-dialog moments-dialog" aria-labelledby="moments-title" onClose={onClose} onCancel={event => { if (busy) event.preventDefault(); }}>
    <header className="chat-header chat-media-header"><button className="chat-back" autoFocus disabled={busy} onClick={() => dialog.current.close()}>Kembali</button><div className="chat-contact-info"><h3 id="moments-title">Jejak Kita</h3><p>Bersama {title}</p></div></header>
    <div className="chat-media-scroll moments-scroll">
      <div className="moments-intro"><span aria-hidden="true">📍</span><h2>Pernah di sini. Bareng kamu.</h2><p>Simpan tempat, foto, dan cerita kecil yang ingin kita ingat.</p></div>
      <div className="playlist-actions"><button className="btn btn-primary" disabled={busy || compressing} onClick={() => { setCreating(!creating); setError(''); setNotice(''); }}>{creating ? 'Tutup cerita' : '+ Simpan momen'}</button><button className="btn btn-secondary" disabled={loading || busy} onClick={() => load()}>Cek yang baru</button></div>
      {error && <p className="playlist-error" role="alert">{error}</p>}{notice && <p className="playlist-status" role="status">{notice}</p>}
      {creating && <form className="playlist-form" onSubmit={publish}>
        <h3>Kita ke mana waktu itu?</h3>
        <label>Cari tempat<input maxLength={150} value={query} disabled={busy} placeholder="Misalnya: Kebun Raya Bogor" onChange={event => { searchRequest.current?.abort(); searchRequest.current = null; setSearching(false); postId.current = null; setQuery(event.target.value); setPlace(null); setPlaces([]); setSearched(false); }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); search(); } }} /></label>
        <button type="button" className="btn btn-secondary" disabled={busy || searching || query.trim().length < 3} onClick={search}>{searching ? 'Mencari tempat…' : 'Cari tempat'}</button>
        <small>Nama tempat yang kamu cari dikirim ke Photon. Data tempat © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>.</small>
        {searched && !places.length && !place && <p role="status">Belum ketemu. Coba tambahkan nama kota, ya.</p>}
        {!!places.length && <ul className="moment-place-results" aria-label="Tempat yang ditemukan">{places.map((item, index) => <li key={index}><button type="button" disabled={busy} onClick={() => { postId.current = null; setPlace(item); setPlaces([]); }}>{item.name}</button></li>)}</ul>}
        {place && <p className="moment-picked" role="status">📍 {place.name}</p>}
        <label>Foto momen kita<input type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif" disabled={busy || compressing} onChange={pickPhoto} /></label>
        {compressing && <p role="status">Meringankan fotomu dulu…</p>}
        {preview && <div><img className="moment-preview" src={preview} alt="Pratinjau foto momen" /><small>Siap disimpan · {Math.ceil(photo.size / 1024)} KB</small></div>}
        <label>Cerita kecilnya<textarea rows={3} maxLength={1500} value={caption} disabled={busy} placeholder="Waktu itu kita ketawa karena…" onChange={event => { postId.current = null; setCaption(event.target.value); }} /></label>
        <small>Cuma kalian berdua di room ini yang bisa melihatnya.</small>
        <button className="btn btn-primary" disabled={busy || compressing || !place || !photo}>{busy ? 'Menyimpan momen…' : 'Simpan buat kita'}</button>
      </form>}
      {loading && <p role="status">Membuka kenangan kita…</p>}
      {!loading && !error && !moments.length && <div className="playlist-empty"><h3>Tempat pertama, cerita pertama</h3><p>Mulai dari satu foto tempat yang pernah kalian datangi.</p></div>}
      <div className="moments-timeline">{moments.map(moment => <article key={moment.id} className="moment-card">
        <div className="moment-card-heading"><span className="moment-pin" aria-hidden="true">📍</span><div><h3>{moment.place_name}</h3><p>{moment.author_id === userId ? 'Dari kamu' : `Dari ${title}`} · {new Date(moment.created_at).toLocaleDateString('id-ID')}</p></div></div>
        {moment.photoUrl ? <button className="moment-photo-button" aria-label={`Buka foto di ${moment.place_name}`} onClick={() => viewPhoto(moment)}><img src={moment.photoUrl} alt={`Momen di ${moment.place_name}`} loading="lazy" /></button> : <p>Foto belum tersedia. Coba cek yang baru.</p>}
        {moment.caption && <p className="moment-caption"><MessageText text={moment.caption} /></p>}
        <a className="playlist-listen" target="_blank" rel="noopener noreferrer" href={`https://www.openstreetmap.org/?mlat=${moment.latitude}&mlon=${moment.longitude}#map=16/${moment.latitude}/${moment.longitude}`}>Lihat tempatnya ↗</a>
      </article>)}</div>
      {cursor && <button className="btn btn-secondary" disabled={loading || busy} onClick={() => load(cursor)}>Kenangan sebelumnya</button>}
    </div>
  </dialog>;
}
