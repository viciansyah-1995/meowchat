'use client';

import { useEffect, useRef, useState } from 'react';
import getSupabaseClient from '../lib/supabase/client.js';

export function useMessageStars(userId) {
  const [ids, setIds] = useState(null);
  const [loadedUserId, setLoadedUserId] = useState(null);
  const [pendingId, setPendingId] = useState(null);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const sessionRef = useRef(null);
  const ready = Boolean(userId && loadedUserId === userId && ids);

  useEffect(() => {
    setIds(null);
    setLoadedUserId(null);
    setPendingId(null);
    setError('');
    if (!userId) return;

    const session = { busy: false };
    sessionRef.current = session;
    async function load() {
      try {
        const ids = new Set();
        let after;
        const pageSize = 500;
        for (;;) {
          let query = getSupabaseClient().from('message_stars').select('message_id')
            .eq('profile_id', userId).order('message_id').limit(pageSize);
          if (after) query = query.gt('message_id', after);
          const { data, error } = await query;
          if (error) throw error;
          if (sessionRef.current !== session) return;
          data.forEach((row) => ids.add(row.message_id));
          if (data.length < pageSize) break;
          after = data.at(-1).message_id;
        }
        setIds(ids);
        setLoadedUserId(userId);
      } catch {
        if (sessionRef.current === session) setError('Pesan berbintang gagal dimuat.');
      }
    }
    load();
    return () => { sessionRef.current = null; };
  }, [userId, refresh]);

  async function toggle(messageId, wasStarred) {
    const session = sessionRef.current;
    if (!ready || !session || session.busy) return;
    session.busy = true;
    setPendingId(messageId);
    setError('');
    try {
      const table = getSupabaseClient().from('message_stars');
      const { error } = wasStarred
        ? await table.delete().eq('profile_id', userId).eq('message_id', messageId)
        : await table.upsert({ profile_id: userId, message_id: messageId }, {
          onConflict: 'profile_id,message_id', ignoreDuplicates: true,
        });
      if (error) throw error;
      if (sessionRef.current !== session) return;
      setIds((previous) => {
        const next = new Set(previous);
        if (wasStarred) next.delete(messageId);
        else next.add(messageId);
        return next;
      });
      return true;
    } catch {
      if (sessionRef.current === session) setError('Bintang pesan gagal diubah. Coba lagi.');
    } finally {
      session.busy = false;
      if (sessionRef.current === session) setPendingId(null);
    }
  }

  return {
    has: (messageId) => ready && ids.has(messageId),
    ready,
    pendingId,
    error,
    toggle,
    retry: () => setRefresh((value) => value + 1),
  };
}

export function MessageStarButton({ messageId, stars, onUnstar }) {
  const starred = Boolean(onUnstar) || stars.has(messageId);
  return (
    <button type="button" className="chat-star-button" aria-label="Bintang pesan"
      aria-pressed={starred} disabled={!stars.ready || Boolean(stars.pendingId)} onClick={async () => {
        if (await stars.toggle(messageId, starred)) onUnstar?.();
      }}>
      <span aria-hidden="true">{starred ? '★' : '☆'}</span>
    </button>
  );
}
