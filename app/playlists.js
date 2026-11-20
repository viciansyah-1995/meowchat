'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import PlaylistService from '../lib/services/playlist.service.supabase.js';
import { spotifyTrackUrl } from '../lib/playlist-links.js';

const emptyTrack = { url: '', title: '', artist: '', notes: '' };
const roomName = (room) => room?.otherProfile?.display_name || room?.otherProfile?.username || room?.fallbackProfile?.display_name || 'Teman chat';
function errorText(error) {
  if (['42P01', '42703', 'PGRST205'].includes(error?.code)) return 'Rak lagu kita belum siap. Coba lagi sebentar, ya.';
  if (error?.code === '42501') return 'Playlist ini cuma bisa dibuka oleh kalian berdua.';
  return error instanceof Error ? error.message : 'Belum bisa membuka lagu kita. Cek koneksimu lalu coba lagi, ya.';
}

function PlaylistDetail({ playlist, room, userId, onBack, onChat }) {
  const [tracks, setTracks] = useState([]);
  const [limit, setLimit] = useState(50);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState(null);
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const generation = useRef(0);
  const editorRef = useRef(null);
  const editorOpen = Boolean(form);
  useEffect(() => { if (editorOpen) editorRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' }); }, [editorOpen, editing]);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; generation.current++; }; }, []);
  const load = useCallback(async (quiet = false) => {
    const request = ++generation.current;
    if (!quiet) setLoading(true);
    try {
      const data = await PlaylistService.tracks(playlist.id, limit);
      if (!alive.current || request !== generation.current) return;
      setTracks(data); setError('');
    } catch (cause) { if (alive.current && request === generation.current) setError(errorText(cause)); }
    finally { if (alive.current && request === generation.current) setLoading(false); }
  }, [playlist.id, limit]);
  useEffect(() => {
    load();
    const refresh = () => { if (document.visibilityState === 'visible' && !saving.current) load(true); };
    const timer = setInterval(refresh, 15000);
    document.addEventListener('visibilitychange', refresh);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', refresh); generation.current++; };
  }, [load]);

  async function save(event) {
    event.preventDefault();
    if (saving.current) return;
    saving.current = true; setBusy(true); setError(''); setNotice(''); generation.current++;
    try {
      await PlaylistService.saveTrack(playlist.id, form, editing);
      if (!alive.current) return;
      setForm(null); setEditing(null); setNotice(editing ? 'Ceritamu sudah diperbarui.' : 'Lagunya masuk. Ceritanya ikut tersimpan ♡');
      await load(true);
    } catch (cause) { if (alive.current) setError(errorText(cause)); }
    finally { saving.current = false; if (alive.current) setBusy(false); }
  }
  async function remove() {
    if (saving.current) return;
    saving.current = true; setBusy(true); setError(''); generation.current++;
    try {
      await PlaylistService.removeTrack(removing);
      if (!alive.current) return;
      setRemoving(null); setNotice('Lagunya sudah dilepas dari playlist ini.'); await load(true);
    } catch (cause) { if (alive.current) setError(errorText(cause)); }
    finally { saving.current = false; if (alive.current) setBusy(false); }
  }
  const field = (key) => ({ value: form[key], onChange: e => setForm({ ...form, [key]: e.target.value }) });
  return (
    <section className="playlist-page">
      <button className="playlist-back" onClick={onBack}>← Rak lagu kita</button>
      <header className="playlist-hero">
        <span className="playlist-art" aria-hidden="true">♫</span>
        <p className="playlist-eyebrow">LAGU UNTUK KITA BERDUA</p>
        <h2>{playlist.name}</h2><p>Bersama {roomName(room)}</p>
        <p className="playlist-caption">Beberapa rasa lebih mudah disampaikan lewat lagu.</p>
        {room && <button className="btn btn-secondary" onClick={() => onChat(room)}>Ngobrol dulu</button>}
      </header>
      <div className="playlist-actions">
        <button className="btn btn-primary" disabled={busy} onClick={() => { setForm({ ...emptyTrack }); setEditing(null); setError(''); setNotice(''); }}>+ Titip lagu</button>
        <button className="btn btn-secondary" disabled={loading || busy} onClick={() => load()}>Cek yang baru</button>
      </div>
      {error && !form && <p className="playlist-error" role="alert">{error}</p>}
      {notice && <p className="playlist-status" role="status">{notice}</p>}
      {form && <form ref={editorRef} className="playlist-form" onSubmit={save}>
        <h3>{editing ? 'Ada cerita yang mau kamu ubah?' : 'Lagu apa yang ingin kamu titipkan?'}</h3>
        {!editing && <label>Link dari Spotify<input type="url" required maxLength={500} placeholder="https://open.spotify.com/track/…" {...field('url')} /></label>}
        <div className="playlist-form-row">
          <label>Judul lagunya<input required maxLength={160} placeholder="Lagu yang lagi kamu pikirin…" {...field('title')} /></label>
          <label>Siapa yang nyanyi?<input required maxLength={160} placeholder="Nama penyanyi atau band-nya" {...field('artist')} /></label>
        </div>
        <label>Memory Notes · Cerita di baliknya<textarea required rows={4} maxLength={2000} placeholder="Kenapa lagu ini berarti buatmu? Mungkin tentang perjalanan kita, rindu yang belum sempat diucapkan, atau satu sore yang ingin kamu ulang…" {...field('notes')} /></label>
        <small>Cuma kamu dan teman dengarmu yang bisa baca cerita ini. {form.notes.length}/2000</small>
        {error && <p className="playlist-error" role="alert">{error}</p>}
        <div className="playlist-actions">
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Menyimpan ceritamu…' : editing ? 'Simpan ceritaku' : 'Titip lagu & cerita'}</button>
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => { setForm(null); setEditing(null); setError(''); }}>Batal</button>
        </div>
      </form>}
      {loading && !tracks.length && <p role="status">Memuat lagu…</p>}
      {!loading && !error && !tracks.length && <div className="playlist-empty"><span aria-hidden="true">♪</span><h3>Mulai dari satu lagu yang berarti</h3><p>Punya lagu yang bikin ingat dia? Titipkan di sini, sekalian ceritanya.</p></div>}
      {!!tracks.length && <div className="playlist-table-head" aria-hidden="true"><span>#</span><span>Lagunya</span><span className="playlist-date">Dititipkan</span><span /></div>}
      <div className="playlist-tracks">
        {tracks.map((track, index) => <details className="playlist-track" key={track.id}>
          <summary className="playlist-track-row" aria-label={`Buka cerita ${track.title}`}>
            <span className="playlist-track-number" aria-hidden="true">{index + 1}</span>
            <span className="playlist-song-icon" style={{ '--song-hue': [...track.spotify_track_id].reduce((sum, letter) => sum + letter.charCodeAt(0), 0) % 360 }} aria-hidden="true">♫</span>
            <span className="playlist-song-copy"><strong>{track.title}</strong><span>{track.artist}</span><small>♡ {track.memory_notes}</small></span>
            <span className="playlist-date">{new Date(track.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}<small>{track.added_by === userId ? 'dari kamu' : roomName(room)}</small></span>
            <span className="playlist-row-chevron" aria-hidden="true">⌄</span>
          </summary>
          <div className="playlist-track-story">
            <div className="playlist-memory"><span>Memory Notes · Cerita kita</span><p>{track.memory_notes}</p></div>
            <p className="playlist-byline">Dititipkan {track.added_by === userId ? 'oleh kamu' : `oleh ${roomName(room)}`} · {new Date(track.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
            <a className="playlist-listen" href={spotifyTrackUrl(track.spotify_track_id)} target="_blank" rel="noopener noreferrer">Dengerin di Spotify ↗</a>
            {track.added_by === userId && <div className="playlist-track-tools">
              <button disabled={busy} onClick={() => { setEditing(track.id); setForm({ url: spotifyTrackUrl(track.spotify_track_id), title: track.title, artist: track.artist, notes: track.memory_notes }); setError(''); }}>Ubah ceritaku</button>
              <button disabled={busy} onClick={() => setRemoving(track.id)}>Lepas lagu ini</button>
            </div>}
            {removing === track.id && <div className="playlist-delete" role="group" aria-label="Lepas lagu dari playlist"><p>Lepas lagu ini beserta ceritamu dari playlist kita?</p><button disabled={busy} onClick={remove}>Iya, lepas</button><button disabled={busy} onClick={() => setRemoving(null)}>Tetap simpan</button></div>}
          </div>
        </details>)}
      </div>
      {tracks.length >= limit && <button className="btn btn-secondary" disabled={loading || busy} onClick={() => setLimit(limit + 50)}>Lihat lagu yang lain</button>}
    </section>
  );
}

export default function Playlists({ userId, rooms, roomsLoading, roomsError, onRefreshRooms, onChat }) {
  const [playlists, setPlaylists] = useState([]);
  const [selected, setSelected] = useState(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [chatId, setChatId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [more, setMore] = useState(false);
  const alive = useRef(true);
  const saving = useRef(false);
  const request = useRef(0);
  const directRooms = rooms.filter(item => item.chat?.type === 'direct');
  useEffect(() => { alive.current = true; return () => { alive.current = false; request.current++; }; }, []);
  const load = useCallback(async (before = null) => {
    const current = ++request.current; setLoading(true);
    try {
      const data = await PlaylistService.list(before);
      if (!alive.current || current !== request.current) return;
      setPlaylists(prev => before ? [...prev, ...data.filter(row => !prev.some(p => p.id === row.id))] : data);
      setMore(data.length === 50); setError('');
    } catch (cause) { if (alive.current && current === request.current) setError(errorText(cause)); }
    finally { if (alive.current && current === request.current) setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  async function create(event) {
    event.preventDefault(); if (saving.current) return;
    saving.current = true; setBusy(true); setError(''); request.current++; setLoading(false);
    try {
      const playlist = await PlaylistService.create(chatId, name);
      if (!alive.current) return;
      setPlaylists(prev => [playlist, ...prev]); setCreating(false); setSelected(playlist); setName(''); setChatId('');
    } catch (cause) { if (alive.current) setError(errorText(cause)); }
    finally { saving.current = false; if (alive.current) setBusy(false); }
  }
  if (selected) return <PlaylistDetail key={selected.id} playlist={selected} room={rooms.find(item => item.chat.id === selected.chat_id)} userId={userId} onChat={onChat} onBack={() => { setSelected(null); load(); }} />;
  return <section className="playlist-page">
    <header className="playlist-intro"><p className="playlist-eyebrow">SEBUAH TEMPAT UNTUK LAGU KITA</p><h2>Lagu Kita</h2><p>Lagu yang kita suka. Cerita yang kita simpan.</p></header>
    <div className="playlist-actions"><button className="btn btn-primary" disabled={busy} onClick={() => setCreating(!creating)}>{creating ? 'Tutup' : '+ Bikin playlist'}</button><button className="btn btn-secondary" disabled={loading || busy} onClick={() => { load(); onRefreshRooms(); }}>Cek yang baru</button></div>
    {error && <p className="playlist-error" role="alert">{error}</p>}
    {creating && <form className="playlist-form" onSubmit={create}>
      <h3>Mau bikin playlist bareng siapa?</h3>
      <label>Teman dengarmu<select required value={chatId} onChange={e => setChatId(e.target.value)}><option value="">Pilih teman berbagi lagu</option>{directRooms.map(room => <option key={room.chat.id} value={room.chat.id}>{roomName(room)}</option>)}</select></label>
      {roomsLoading && <p role="status">Mencari teman dengarmu…</p>}
      {roomsError && <p role="alert">Teman chatmu belum muncul. <button type="button" onClick={onRefreshRooms}>Coba lagi</button></p>}
      {!roomsLoading && !roomsError && !directRooms.length && <p>Belum ada teman dengar? Mulai ngobrol dari menu Contact dulu, ya.</p>}
      <label>Kasih nama playlist kalian<input required maxLength={80} value={name} onChange={e => setName(e.target.value)} placeholder="Misalnya: Di Jalan Pulang, Tentang Kita, atau Rindu Jam Dua" /></label>
      <small>Satu ruang kecil buat kalian berdua. Kalian bisa sama-sama titip lagu di sini.</small>
      <button className="btn btn-primary" disabled={busy || !chatId || !name.trim()}>{busy ? 'Menyiapkan ruang kalian…' : 'Bikin ruang buat lagu kita'}</button>
    </form>}
    {loading && <p role="status">Membuka rak lagu kita…</p>}
    {!loading && !error && !playlists.length && <div className="playlist-empty"><span aria-hidden="true">♫</span><h3>Masih kosong, tapi nggak akan lama</h3><p>Bikin playlist berdua. Titip satu lagu, lalu ceritakan kenapa kamu memilihnya.</p><small>Cukup link Spotify. Ceritanya dari kamu.</small></div>}
    <div className="playlist-collection">{playlists.map(playlist => <button className="playlist-cover" key={playlist.id} onClick={() => setSelected(playlist)}><span className="playlist-art" aria-hidden="true">♫</span><span className="playlist-cover-copy"><strong>{playlist.name}</strong><span>Bersama {roomName(rooms.find(room => room.chat.id === playlist.chat_id))}</span><small>Dengarkan ceritanya →</small></span></button>)}</div>
    {more && <button className="btn btn-secondary" disabled={loading} onClick={() => load(playlists[playlists.length - 1])}>Intip playlist yang lain</button>}
  </section>;
}
