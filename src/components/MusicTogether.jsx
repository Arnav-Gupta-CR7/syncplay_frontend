import React, { useEffect, useRef, useState } from "react";

/**
 * MusicTogether
 *
 * Props:
 *  - socketRef: ref to connected socket (socketRef.current)
 *  - matchedPeer: peer socket id
 *  - serverUrl: your backend URL (default: https://192.168.1.5:4000)
 *
 * Uses a free YouTube-audio endpoint for audio streaming:
 *  src = `https://yt-api.up.railway.app/audio?id=${videoId}`
 *
 * Replace SERVER_URL if your backend is at a different address.
 */
export default function MusicTogether({
  socketRef,
  matchedPeer,
  serverUrl = "https://192.168.1.6:4000",
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentSong, setCurrentSong] = useState(null); // videoId
  const [meta, setMeta] = useState(null); // { title, channel, thumbnail }
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.9);

  const audioRef = useRef(null);
  const ignoreLocalRef = useRef(false); // prevents feedback loop when applying remote events
  const rttRef = useRef(null); // round-trip time estimate in ms

  // Helper: fetch server-side youtube search
  async function fetchYTSearch(q) {
    const res = await fetch(`${serverUrl}/youtube/search?q=${encodeURIComponent(q)}`);
    if (!res.ok) throw new Error("search failed");
    return res.json();
  }

  // Search action (initiator triggers; optionally you can broadcast the query)
  async function searchMusic(q) {
    if (!q) return;
    setLoading(true);
    try {
      const json = await fetchYTSearch(q);
      setResults(json.items || []);
      // Optionally notify peer of query (so they can see the same results)
      // if (socketRef?.current && matchedPeer) socketRef.current.emit('music-search', { to: matchedPeer, q });
    } catch (e) {
      console.warn("Music search error:", e);
    } finally {
      setLoading(false);
    }
  }

  // Select a song (play for both)
  function selectSong(song) {
    // song = { videoId, title, channelTitle, thumbnails }
    setCurrentSong(song.videoId);
    setMeta({
      title: song.title,
      channel: song.channelTitle,
      thumbnail: song.thumbnails?.default?.url || "",
    });

    // notify peer
    if (socketRef?.current && matchedPeer) {
      socketRef.current.emit("music-select", { to: matchedPeer, videoId: song.videoId, meta: {
        title: song.title,
        channel: song.channelTitle,
        thumbnail: song.thumbnails?.default?.url || "",
      } });
    }
  }

  // Emit music events to peer
  function emitMusicEvent(event, time = 0) {
    if (!socketRef?.current || !matchedPeer) return;
    const payload = { to: matchedPeer, event, time, ts: Date.now() };
    socketRef.current.emit("music-event", payload);
  }

  // Local audio event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    function onPlay() {
      if (ignoreLocalRef.current) {
        ignoreLocalRef.current = false;
        return;
      }
      setIsPlaying(true);
      // emit play with currentTime (and compensate by estimated half RTT on receiver)
      emitMusicEvent("PLAY", audio.currentTime);
    }
    function onPause() {
      if (ignoreLocalRef.current) {
        ignoreLocalRef.current = false;
        return;
      }
      setIsPlaying(false);
      emitMusicEvent("PAUSE", audio.currentTime);
    }
    function onSeeked() {
      if (ignoreLocalRef.current) {
        ignoreLocalRef.current = false;
        return;
      }
      emitMusicEvent("SEEK", audio.currentTime);
    }

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("seeked", onSeeked);

    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("seeked", onSeeked);
    };
  }, [audioRef.current, matchedPeer, socketRef]);

  // Listen for socket events: selection and music events + ping/pong
  useEffect(() => {
    const socket = socketRef?.current;
    if (!socket) return;

    // peer selected a new song
    function onSelect({ from, videoId, meta: remoteMeta }) {
      // update current song and metadata
      setCurrentSong(videoId);
      if (remoteMeta) setMeta(remoteMeta);
      // optionally auto-play (we'll not auto-play if the remote just paused)
      // apply ignore flag so local handlers don't re-emit
      ignoreLocalRef.current = true;
      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = 0;
        audio.pause();
        setIsPlaying(false);
      }
    }

    // peer sent play/pause/seek
    function onMusicEvent({ from, event, time, ts }) {
      const audio = audioRef.current;
      if (!audio) return;

      // simple anti-replay: ignore if ts is undefined or older than last seen
      // (for robustness you can track last ts; omitted for brevity)

      // Compute a small compensation using RTT/2
      const rtt = rttRef.current || 0;
      const compensate = rtt > 0 ? rtt / 2000 : 0; // seconds ~ (rtt/2)/1000 => divided by 1000; multiply by 1? we want seconds: rtt/2/1000 => rtt/2000

      ignoreLocalRef.current = true;
      if (event === "PLAY") {
        const target = Math.max(0, (time || 0) + compensate);
        // if drift > 0.8s, seek; otherwise just play
        if (Math.abs(audio.currentTime - target) > 0.8) audio.currentTime = target;
        audio.play().catch(() => {});
        setIsPlaying(true);
      } else if (event === "PAUSE") {
        const target = Math.max(0, (time || 0));
        audio.currentTime = target;
        audio.pause();
        setIsPlaying(false);
      } else if (event === "SEEK") {
        const target = Math.max(0, (time || 0) + compensate);
        audio.currentTime = target;
      }
    }

    // RTT ping/pong to estimate latency to peer
    function onPing({ from, t }) {
      // reply immediately
      socket.emit("music-pong", { to: from, t });
    }
    function onPong({ from, t }) {
      const now = Date.now();
      const rtt = now - (t || now);
      rttRef.current = rtt;
    }

    socket.on("music-select", onSelect);
    socket.on("music-event", onMusicEvent);
    socket.on("music-ping", onPing);
    socket.on("music-pong", onPong);

    return () => {
      socket.off("music-select", onSelect);
      socket.off("music-event", onMusicEvent);
      socket.off("music-ping", onPing);
      socket.off("music-pong", onPong);
    };
  }, [socketRef, matchedPeer]);

  // When a new currentSong is set, update audio src and metadata
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!currentSong) {
      audio.pause();
      setIsPlaying(false);
      setMeta(null);
      audio.removeAttribute("src");
      audio.load();
      return;
    }
    // load audio (free public audio proxy)
    const src = `${serverUrl}/music/audio?id=${currentSong}`;
    ignoreLocalRef.current = true; // prevent immediate feedback after load
    audio.src = src;
    audio.crossOrigin = "anonymous";
    audio.currentTime = 0;
    audio.pause();
    setIsPlaying(false);
    // small autoplay attempt (won't work without user gesture often)
    // audio.play().catch(()=>{});
  }, [currentSong]);

  // measure RTT periodically while paired
  useEffect(() => {
    let tId;
    function schedulePing() {
      const socket = socketRef?.current;
      if (!socket || !matchedPeer) return;
      const t = Date.now();
      socket.emit("music-ping", { to: matchedPeer, t });
      tId = setTimeout(schedulePing, 5000);
    }
    schedulePing();
    return () => clearTimeout(tId);
  }, [socketRef, matchedPeer]);

  return (
    <div className="flex flex-col gap-4 h-full w-full p-3">
      {/* Header */}
      <div className="flex items-center gap-3">
        <input
          className="input input-bordered input-sm flex-1"
          placeholder="Search music (YouTube)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && searchMusic(query)}
        />
        <button className="btn btn-sm btn-primary" onClick={() => searchMusic(query)}>
          Search
        </button>
        <div className="text-xs opacity-70">{matchedPeer ? "Paired" : "Not paired"}</div>
      </div>

      {/* Results and Player area */}
      <div className="flex gap-4 h-full">
        {/* Results */}
        <div className="w-1/3 bg-base-200 p-2 rounded-lg overflow-auto">
          {loading && <div className="loading loading-spinner"></div>}
          {!loading && results.length === 0 && <div className="text-sm opacity-50 p-2">No results</div>}
          {results.map((r) => (
            <div
              key={r.videoId}
              className="flex items-center gap-3 p-2 rounded hover:bg-base-300 cursor-pointer transition"
              onClick={() => selectSong(r)}
            >
              <img src={r.thumbnails?.default?.url} alt="" className="w-16 h-12 rounded" />
              <div className="flex-1">
                <div className="text-sm font-medium">{r.title}</div>
                <div className="text-xs opacity-60">{r.channelTitle}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Player */}
        <div className="flex-1 bg-base-100 p-4 rounded-lg shadow flex flex-col">
          <div className="flex gap-4 items-center">
            <div className="w-28 h-28 bg-neutral rounded overflow-hidden flex-shrink-0">
              {meta?.thumbnail ? (
                <img src={meta.thumbnail} alt="thumb" className="w-full h-full object-cover" />
              ) : (
                <div className="flex items-center justify-center h-full text-sm opacity-50">No song</div>
              )}
            </div>

            <div className="flex-1">
              <div className="text-lg font-semibold">{meta?.title || "Nothing selected"}</div>
              <div className="text-sm opacity-60">{meta?.channel || "—"}</div>

              <div className="flex items-center gap-2 mt-3">
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={() => {
                    const audio = audioRef.current;
                    if (!audio) return;
                    // go back 10s
                    const t = Math.max(0, audio.currentTime - 10);
                    ignoreLocalRef.current = true;
                    audio.currentTime = t;
                    emitMusicEvent("SEEK", t);
                  }}
                >
                  -10s
                </button>

                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => {
                    const audio = audioRef.current;
                    if (!audio) return;
                    ignoreLocalRef.current = true;
                    audio.play().catch(() => {});
                    setIsPlaying(true);
                    emitMusicEvent("PLAY", audio.currentTime);
                  }}
                >
                  ▶
                </button>

                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => {
                    const audio = audioRef.current;
                    if (!audio) return;
                    ignoreLocalRef.current = true;
                    audio.pause();
                    setIsPlaying(false);
                    emitMusicEvent("PAUSE", audio.currentTime);
                  }}
                >
                  ⏸
                </button>

                <button
                  className="btn btn-sm btn-ghost"
                  onClick={() => {
                    const audio = audioRef.current;
                    if (!audio) return;
                    const t = audio.currentTime + 10;
                    ignoreLocalRef.current = true;
                    audio.currentTime = t;
                    emitMusicEvent("SEEK", t);
                  }}
                >
                  +10s
                </button>

                <div className="ml-4 text-xs opacity-60">Volume</div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setVolume(v);
                    if (audioRef.current) audioRef.current.volume = v;
                  }}
                />
              </div>

              <div className="text-xs opacity-60 mt-2">
                {matchedPeer ? "Synced with partner" : "Local only"}
                {rttRef.current ? ` • RTT ~ ${Math.round(rttRef.current)} ms` : ""}
              </div>
            </div>
          </div>

          {/* Hidden audio element */}
          <div className="mt-4">
            <audio ref={audioRef} controls className="w-full" preload="auto" />
          </div>
        </div>
      </div>
    </div>
  );
}
