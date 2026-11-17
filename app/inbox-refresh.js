'use client';

import { useEffect, useRef, useState } from 'react';

const REFRESH_DISTANCE = 72;

export default function InboxRefresh({ active, blocked, onRefresh, children }) {
  const scrollerRef = useRef(null);
  const pendingRef = useRef(false);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState('');

  async function refresh() {
    if (blocked || pendingRef.current) return;
    pendingRef.current = true;
    setRefreshing(true);
    setStatus('Memperbarui daftar chat…');
    try {
      const result = await onRefresh();
      setStatus(result.success ? 'Daftar chat diperbarui.' : 'Gagal memperbarui daftar chat. Coba lagi.');
    } catch {
      setStatus('Gagal memperbarui daftar chat. Coba lagi.');
    } finally {
      pendingRef.current = false;
      setRefreshing(false);
    }
  }

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!active || blocked) return;
    let gesture = null;

    function reset() {
      gesture = null;
      setPull(0);
    }

    function start(event) {
      if (pendingRef.current || scroller.scrollTop > 0 || event.touches.length !== 1) {
        reset();
        return;
      }
      const touch = event.touches[0];
      gesture = { x: touch.clientX, y: touch.clientY, distance: 0, pulling: false };
    }

    function move(event) {
      if (!gesture) return;
      if (event.touches.length !== 1 || scroller.scrollTop > 0) {
        reset();
        return;
      }
      const touch = event.touches[0];
      const dy = touch.clientY - gesture.y;
      const dx = Math.abs(touch.clientX - gesture.x);
      if (!gesture.pulling) {
        if (Math.abs(dy) < 8 && dx < 8) return;
        if (dy <= dx || !event.cancelable) {
          reset();
          return;
        }
        gesture.pulling = true;
      }
      if (event.cancelable) event.preventDefault();
      gesture.distance = Math.max(0, dy);
      setPull(Math.min(120, gesture.distance));
    }

    function end(event) {
      const distance = gesture?.distance || 0;
      if (gesture?.pulling && event.cancelable) event.preventDefault();
      reset();
      if (distance >= REFRESH_DISTANCE) refresh();
    }

    scroller.addEventListener('touchstart', start, { passive: true });
    scroller.addEventListener('touchmove', move, { passive: false });
    scroller.addEventListener('touchend', end, { passive: false });
    scroller.addEventListener('touchcancel', reset);
    return () => {
      scroller.removeEventListener('touchstart', start);
      scroller.removeEventListener('touchmove', move);
      scroller.removeEventListener('touchend', end);
      scroller.removeEventListener('touchcancel', reset);
      reset();
    };
  }, [active, blocked, onRefresh]);

  return (
    <div ref={scrollerRef} className={active ? 'app-scroll-area inbox-scroll-area' : 'app-scroll-area'}
      aria-busy={active && refreshing}>
      {active && (
        <>
          {pull > 0 && (
            <div className="inbox-pull-indicator" aria-hidden="true" style={{ height: Math.min(54, pull * 0.65) }}>
              {pull >= REFRESH_DISTANCE ? 'Lepas untuk memperbarui' : 'Tarik untuk memperbarui'}
            </div>
          )}
          <div className="inbox-refresh-tools">
            <span role="status">{status}</span>
            <button type="button" className="btn btn-secondary" aria-label="Perbarui daftar chat"
              disabled={blocked || refreshing} onClick={refresh}>
              {refreshing ? 'Memperbarui…' : 'Perbarui'}
            </button>
          </div>
        </>
      )}
      {children}
    </div>
  );
}
