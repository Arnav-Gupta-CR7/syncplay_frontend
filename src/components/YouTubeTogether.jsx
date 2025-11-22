import React, { useEffect, useRef, useState } from 'react';
import YouTubeSyncPlayer from './YouTubeSyncPlayer'; // the player you already added (or use the one you used earlier)


const SERVER_URL = "https://192.168.1.5:4000"; // same as your signaling server

async function fetchYTSearch(q) {
  const res = await fetch(`${SERVER_URL}/youtube/search?q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error('search failed');
  return res.json();
}


export default function YouTubeTogether({ socketRef, matchedPeer, initialVideoId = 'dQw4w9WgXcQ' }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(initialVideoId);

  // Cursors
  const localCursorRef = useRef(null);
  const remoteCursorRef = useRef(null);
  const containerRef = useRef(null);

  // throttle cursor emits to ~30fps
  const lastEmitRef = useRef(0);
  function emitCursor(x, y) {
    const now = performance.now();
    if (now - lastEmitRef.current < 33) return;
    lastEmitRef.current = now;
    const socket = socketRef?.current;
    if (!socket || !matchedPeer) return;
    socket.emit('cursor', { to: matchedPeer, data: { x, y } });
  }

  // local mouse handler relative to container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    function onMove(e) {
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      // render local tiny cursor
      if (localCursorRef.current) {
        localCursorRef.current.style.left = `${x * 100}%`;
        localCursorRef.current.style.top = `${y * 100}%`;
      }
      emitCursor(x, y);
    }
    el.addEventListener('mousemove', onMove);
    el.addEventListener('touchmove', (ev) => {
      const t = ev.touches[0];
      if (!t) return;
      const rect = el.getBoundingClientRect();
      const x = (t.clientX - rect.left) / rect.width;
      const y = (t.clientY - rect.top) / rect.height;
      if (localCursorRef.current) {
        localCursorRef.current.style.left = `${x * 100}%`;
        localCursorRef.current.style.top = `${y * 100}%`;
      }
      emitCursor(x, y);
    }, { passive: true });

    return () => {
      el.removeEventListener('mousemove', onMove);
    };
  }, [containerRef.current, socketRef, matchedPeer]);

  // listen for remote cursor
  useEffect(() => {
    const socket = socketRef?.current;
    if (!socket) return;
    function handler({ data }) {
      if (!remoteCursorRef.current) return;
      // position using percent (clamp)
      const px = Math.min(1, Math.max(0, data.x || 0));
      const py = Math.min(1, Math.max(0, data.y || 0));
      remoteCursorRef.current.style.left = `${px * 100}%`;
      remoteCursorRef.current.style.top = `${py * 100}%`;

    }
    socket.on('cursor', handler);
    return () => socket.off('cursor', handler);
  }, [socketRef, matchedPeer]);

  // search (local) and broadcast query to peer so they see the same results if you want
  async function doSearch(q) {
    if (!q) return;
    setLoading(true);
    try {
      const body = await fetchYTSearch(q);
      setResults(body.items || []);
      // optionally broadcast query to peer (so both see same results)
      
    } catch (e) {
      console.warn('search failed', e);
    } finally {
      setLoading(false);
    }
  }

  // handle inbound search queries from peer
  useEffect(() => {
    const socket = socketRef?.current;
    if (!socket) return;
    const handler = async ({ q }) => {
      // perform the same search locally so UI matches
      await doSearch(q);
    };
    socket.on('yt-search', handler);
    return () => socket.off('yt-search', handler);
  }, [socketRef, matchedPeer]);

  // handle incoming video selection from peer
  useEffect(() => {
    const socket = socketRef?.current;
    if (!socket) return;
    const handler = ({ videoId }) => {
      setSelected(videoId);
    };
    socket.on('yt-select', handler);
    return () => socket.off('yt-select', handler);
  }, [socketRef, matchedPeer]);

  function selectVideo(videoId, broadcast = true) {
    setSelected(videoId);
    // broadcast selection to peer so they load the same
    if (broadcast) {
      const socket = socketRef?.current;
      if (socket && matchedPeer) socket.emit('yt-select', { to: matchedPeer, videoId });
    }
  }

  return (
    <div className="p-3 bg-white rounded shadow" ref={containerRef} style={{ position: 'relative', width: "100%", height: "100%"  }}>
      <div style={{ position: 'absolute', pointerEvents: 'none', inset: 0 }}>
        <div ref={localCursorRef} style={{
          position: 'absolute',
          width: 12, height: 12, borderRadius: 6, background: 'rgba(0,128,255,0.9)', top: "0%",left: "0%",transform: 'translate(-50%,-50%)', display: 'block', zIndex: 40
        }} />
        <div ref={remoteCursorRef} style={{
          position: 'absolute',
          width: 12, height: 12, borderRadius: 6, background: 'rgba(255,80,80,0.95)',  top: "0%",left: "0%",transform: 'translate(-50%,-50%)', display: 'block', zIndex: 40
        }} />
      </div>

      <div className="flex gap-4">
        <div style={{ flex: 1, minWidth: 320 }}>
          <div className="flex gap-2 mb-2">
            <input
              className="flex-1 px-3 py-2 border rounded"
              placeholder="Search YouTube for videos..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') doSearch(query); }}
            />
            <button className="px-3 py-2 bg-blue-600 text-white rounded" onClick={() => doSearch(query)}>Search</button>
          </div>

          <div className="space-y-2 max-h-96 overflow-auto">
            {loading && <div>Searching…</div>}
            {results.map(it => (
              <div key={it.videoId} className="flex gap-2 items-start p-2 rounded hover:bg-gray-50 cursor-pointer"
                   onClick={() => selectVideo(it.videoId, true)}>
                <img src={it.thumbnails?.default?.url || ''} alt="" className="w-24 h-16 object-cover rounded" />
                <div>
                  <div className="font-semibold text-sm">{it.title}</div>
                  <div className="text-xs text-gray-500">{it.channelTitle}</div>
                </div>
              </div>
            ))}
            {!loading && results.length === 0 && <div className="text-xs text-gray-400">No results yet.</div>}
          </div>
        </div>

        <div style={{ width: 640 }}>
          <div className="mb-2 text-sm font-medium">Watching together</div>
          <YouTubeSyncPlayer
            socketRef={socketRef}
            matchedPeer={matchedPeer}
            initialVideoId={selected}
          />
        </div>
      </div>
    </div>
  );
}
