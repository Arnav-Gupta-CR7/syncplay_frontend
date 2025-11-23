// YouTubeSyncPlayer.jsx (or paste into same file)
import { useEffect, useRef } from "react";

/**
 * Props:
 *  - socketRef: ref to connected socket (socketRef.current)
 *  - matchedPeer: peer socket id
 *  - initialVideoId: optional default video id
 */
export default function YouTubeSyncPlayer({ socketRef, matchedPeer, initialVideoId = "dQw4w9WgXcQ" }) {
  const playerRef = useRef(null);
  const containerId = useRef(`yt-player-${Math.random().toString(36).slice(2)}`).current;
  const lastRemoteTimestampRef = useRef(0);


  useEffect(() => {
  if (playerRef.current && initialVideoId) {
    playerRef.current.loadVideoById(initialVideoId);
  }
}, [initialVideoId]);


  // load YT iframe API dynamically if not present
  useEffect(() => {
    if (window.YT && window.YT.Player) return;

    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);

    return () => {
      // don't remove script on unmount (it might be reused), but no-op
    };
  }, []);

  // create player when API ready
  useEffect(() => {
    let mounted = true;

    // youtube API calls this; ensure we don't overwrite global if another instance exists
    const onAPIReady = () => {
      if (!mounted) return;
      playerRef.current = new window.YT.Player(containerId, {
        height: "300",
        width: "100%",
        videoId: initialVideoId,
        playerVars: { autoplay: 0, controls: 1, rel: 0, modestbranding: 1 },
        events: {
          onReady: () => {
            // noop
          },
          onStateChange: (e) => handleStateChange(e),
        },
      });
    };

    if (window.YT && window.YT.Player) {
      onAPIReady();
    } else {
      // attach temporary handler
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (typeof prev === "function") prev();
        onAPIReady();
      };
    }

    return () => {
      mounted = false;
      // optionally destroy player
      if (playerRef.current && playerRef.current.destroy) {
        try { playerRef.current.destroy(); } catch (e) {}
        playerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // helper to emit events to peer
  function emitToPeer(data) {
    try {
      const socket = socketRef?.current;
      if (!socket || !matchedPeer) return;
      socket.emit("yt-sync", { to: matchedPeer, data });
    } catch (e) {
      console.warn("yt emit error", e);
    }
  }

  // When local player changes state (play/pause/seek), send event
  function handleStateChange(e) {
    const player = playerRef.current;
    if (!player || !matchedPeer) return;

    // If we set _ignoreSync before, consume and return (prevents loops)
    if (player._ignoreSync) {
      player._ignoreSync = false;
      return;
    }

    const state = e.data;
    const currentTime = player.getCurrentTime ? player.getCurrentTime() : 0;

    // Build message based on state
    let msg = null;
    if (state === window.YT.PlayerState.PLAYING) {
      msg = { event: "PLAY", time: currentTime, timestamp: Date.now() };
    } else if (state === window.YT.PlayerState.PAUSED) {
      msg = { event: "PAUSE", time: currentTime, timestamp: Date.now() };
    } else if (state === window.YT.PlayerState.BUFFERING) {
      // treat as a potential seek point
      msg = { event: "SEEK", time: currentTime, timestamp: Date.now() };
    } else if (state === window.YT.PlayerState.ENDED) {
      msg = { event: "ENDED", time: currentTime, timestamp: Date.now() };
    }

    if (msg) emitToPeer(msg);
  }

  // Listen for incoming yt-sync messages
  useEffect(() => {
    const socket = socketRef?.current;
    if (!socket) return;

    const handler = ({ data }) => {
      const player = playerRef.current;
      if (!player) return;

      // simple anti-replay: ignore older messages
      if (data.timestamp && data.timestamp <= (lastRemoteTimestampRef.current || 0)) return;
      if (data.timestamp) lastRemoteTimestampRef.current = data.timestamp;

      // mark to prevent local handler re-emitting
      player._ignoreSync = true;

      if (data.event === "PLAY") {
        // small correction: if difference > 1s, seek
        const localTime = player.getCurrentTime();
        if (Math.abs(localTime - data.time) > 0.8) player.seekTo(data.time, true);
        player.playVideo();
      } else if (data.event === "PAUSE") {
        // seek to same time then pause
        player.seekTo(data.time, true);
        player.pauseVideo();
      } else if (data.event === "SEEK") {
        player.seekTo(data.time, true);
      } else if (data.event === "VIDEO_CHANGE") {
        player.loadVideoById(data.videoId);
      } else if (data.event === "ENDED") {
        // optionally show UI
        player.seekTo(data.time, true);
        player.pauseVideo();
      }
    };

    socket.on("yt-sync", handler);
    return () => {
      socket.off("yt-sync", handler);
    };
  }, [socketRef, matchedPeer]);

  // helper controls exposed in UI (play/pause/seek/change video)
  function playForBoth() {
    const p = playerRef.current;
    if (!p) return;
    const t = p.getCurrentTime();
    p._ignoreSync = true;
    p.playVideo();
    emitToPeer({ event: "PLAY", time: t, timestamp: Date.now() });
  }
  function pauseForBoth() {
    const p = playerRef.current;
    if (!p) return;
    const t = p.getCurrentTime();
    p._ignoreSync = true;
    p.pauseVideo();
    emitToPeer({ event: "PAUSE", time: t, timestamp: Date.now() });
  }
  function seekForBoth(time) {
    const p = playerRef.current;
    if (!p) return;
    p._ignoreSync = true;
    p.seekTo(time, true);
    emitToPeer({ event: "SEEK", time, timestamp: Date.now() });
  }
  function changeVideoForBoth(videoId) {
    const p = playerRef.current;
    if (!p) return;
    p._ignoreSync = true;
    p.loadVideoById(videoId);
    emitToPeer({ event: "VIDEO_CHANGE", videoId, timestamp: Date.now() });
  }

  return (
  <div className="w-full">

    {/* Player */}
    <div
      id={containerId}
      className="w-full rounded-box overflow-hidden shadow mb-3"
    />

    {/* Controls */}
    <div className="flex flex-wrap gap-2 items-center">

      <button onClick={playForBoth} className="btn btn-success btn-sm">
        ▶ Play
      </button>

      <button onClick={pauseForBoth} className="btn btn-warning btn-sm">
        ⏸ Pause
      </button>

      <button
        onClick={() =>
          seekForBoth(
            Math.max(0, (playerRef.current?.getCurrentTime() || 0) - 10)
          )
        }
        className="btn btn-info btn-sm"
      >
        -10s
      </button>

      <button
        onClick={() =>
          seekForBoth((playerRef.current?.getCurrentTime() || 0) + 10)
        }
        className="btn btn-info btn-sm"
      >
        +10s
      </button>

      {/* Video ID Loader */}
      <div className="ml-4 flex items-center gap-2">
        <input
          id="yt-id-input"
          placeholder="YouTube ID"
          className="input input-bordered input-sm"
        />
        <button
          onClick={() => {
            const id = document.getElementById("yt-id-input")?.value?.trim();
            if (id) changeVideoForBoth(id);
          }}
          className="btn btn-secondary btn-sm"
        >
          Load
        </button>
      </div>
    </div>

    <p className="text-xs text-gray-500 mt-2">
      All actions sync automatically with your partner.
    </p>
  </div>
);

}
