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
  serverUrl = "https://syncplay-backend-s14p.onrender.com",
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
  <div className="flex flex-col h-full w-full p-4 bg-base-200 rounded-xl">

    {/* Search Bar */}
    <div className="flex gap-2 items-center mb-4">
      <input
        className="input input-bordered w-full input-sm"
        placeholder="Search songs…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && searchMusic(query)}
      />

      <button
        className="btn btn-primary btn-sm"
        onClick={() => searchMusic(query)}
      >
        Search
      </button>
    </div>

    <div className="grid grid-cols-3 gap-4 h-full">

      {/* LEFT — Search Results */}
      <div className="col-span-1 bg-base-100 rounded-lg shadow p-3 overflow-y-auto">

        <h3 className="text-sm opacity-70 mb-2">Search Results</h3>

        {loading && (
          <div className="flex justify-center p-4">
            <span className="loading loading-spinner"></span>
          </div>
        )}

        {results.length === 0 && !loading && (
          <div className="text-xs opacity-50 p-2">No results</div>
        )}

        <div className="space-y-2">
          {results.map((song) => (
            <div
              key={song.videoId}
              className="flex gap-3 p-2 rounded-lg hover:bg-base-200 cursor-pointer transition"
              onClick={() => selectSong(song)}
            >
              <img
                src={song.thumbnails?.default?.url}
                className="w-14 h-10 rounded object-cover"
                alt=""
              />

              <div className="flex flex-col justify-center">
                <div className="text-sm font-medium line-clamp-1">{song.title}</div>
                <div className="text-xs opacity-60 line-clamp-1">{song.channelTitle}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MIDDLE — Player */}
      <div className="col-span-2 bg-base-100 rounded-lg shadow p-5 flex flex-col">

        {/* Now Playing Header */}
        <div className="flex items-center gap-4 mb-4">
          <div className="w-20 h-20 rounded-xl bg-neutral overflow-hidden">
            {meta?.thumbnail ? (
              <img src={meta.thumbnail} className="w-full h-full object-cover" />
            ) : (
              <div className="flex items-center justify-center h-full text-xs opacity-40">
                No Song
              </div>
            )}
          </div>

          <div className="flex flex-col">
            <div className="text-lg font-semibold">{meta?.title || "Nothing Playing"}</div>
            <div className="text-sm opacity-60">{meta?.channel || ""}</div>
            <div className="text-xs opacity-50 mt-1">
              {matchedPeer ? "Synced with partner" : "Not synced"}
            </div>
          </div>
        </div>

        {/* Audio Element */}
        <audio ref={audioRef} controls className="w-full mb-4" />

        {/* Controls Row */}
        <div className="flex items-center gap-3">

          <button
            className="btn btn-circle btn-outline btn-sm"
            onClick={() => {
              const audio = audioRef.current;
              if (!audio) return;
              const t = Math.max(0, audio.currentTime - 10);
              ignoreLocalRef.current = true;
              audio.currentTime = t;
              emitMusicEvent("SEEK", t);
            }}
          >
            -10
          </button>

          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              const audio = audioRef.current;
              ignoreLocalRef.current = true;
              audio.play();
              emitMusicEvent("PLAY", audio.currentTime);
            }}
          >
            ▶ Play
          </button>

          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              const audio = audioRef.current;
              ignoreLocalRef.current = true;
              audio.pause();
              emitMusicEvent("PAUSE", audio.currentTime);
            }}
          >
            ⏸ Pause
          </button>

          <button
            className="btn btn-circle btn-outline btn-sm"
            onClick={() => {
              const audio = audioRef.current;
              const t = audio.currentTime + 10;
              ignoreLocalRef.current = true;
              audio.currentTime = t;
              emitMusicEvent("SEEK", t);
            }}
          >
            +10
          </button>

          <div className="ml-4 flex items-center gap-2">
            <span className="text-xs opacity-60">Vol</span>

            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              className="range range-xs"
              onChange={(e) => {
                const v = Number(e.target.value);
                setVolume(v);
                if (audioRef.current) audioRef.current.volume = v;
              }}
            />
          </div>

        </div>

      </div>
    </div>

  </div>
);

}
