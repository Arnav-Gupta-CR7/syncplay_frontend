import React, { useEffect, useRef, useState } from 'react';
import YouTubeSyncPlayer from './YouTubeSyncPlayer'; // the player you already added (or use the one you used earlier)


const SERVER_URL = "https://syncplay-backend-s14p.onrender.com"; // same as your signaling server

async function fetchYTSearch(q) {
  const res = await fetch(`${SERVER_URL}/youtube/search?q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error('search failed');
  return res.json();
}


export default function YouTubeTogether({ socketRef, matchedPeer, initialVideoId = 'KflMqooMzF8' }) {
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
  <div className="flex flex-col lg:flex-row gap-6">

  {/* LEFT SIDE — Player */}
  <div className="w-full lg:w-[640px]">
    <div className="text-sm font-semibold mb-2">Watching Together</div>

    <div className="w-full rounded-box overflow-hidden">
      <YouTubeSyncPlayer
        socketRef={socketRef}
        matchedPeer={matchedPeer}
        initialVideoId={selected}
      />
    </div>
  </div>

  {/* RIGHT SIDE — Search + Results */}
  <div className="flex-1 min-w-full lg:min-w-[320px]">

    {/* SEARCH BAR */}
    <div className="flex gap-2 mb-3">
      <input
        className="input input-bordered w-full"
        placeholder="Search YouTube..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && doSearch(query)}
      />
      <button className="btn btn-primary" onClick={() => doSearch(query)}>
        Search
      </button>
    </div>

    {/* RESULTS */}
    <div className="max-h-[50vh] lg:max-h-96 overflow-auto space-y-2">

      {loading && (
        <div className="text-center py-3">
          <span className="loading loading-spinner loading-md"></span>
        </div>
      )}

      {!loading && results.length === 0 && (
        <div className="text-xs text-gray-400 text-center">
          No results yet.
        </div>
      )}

      {results.map((it) => (
        <div
          key={it.videoId}
          className="card card-side bg-base-100 shadow hover:bg-base-300 cursor-pointer transition"
          onClick={() => selectVideo(it.videoId, true)}
        >
          <figure>
            <img
              src={it.thumbnails?.default?.url || ""}
              className="w-24 h-16 object-cover"
            />
          </figure>
          <div className="card-body p-3">
            <h2 className="card-title text-sm line-clamp-2">
              {it.title}
            </h2>
            <p className="text-xs opacity-60">{it.channelTitle}</p>
          </div>
        </div>
      ))}
    </div>
  </div>

</div>

);

}
