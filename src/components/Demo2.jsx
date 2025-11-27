import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import YouTubeTogether from './YouTubeTogether';
import GameTogether from './GameTogether';
import MusicTogether from './MusicTogether';

import { Routes, Route } from "react-router-dom";
import SandboxLayout from "./SandboxLayout";
import ChatUI from "./ChatUI";
import Navbar from './mini_coponents/Navbar';



const SERVER_URL = 'https://syncplay-backend-s14p.onrender.com'; // change if backend elsewhere

export default function Demo2({ navigate }) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);
  const socketRef = useRef(null);
  const localStreamRef = useRef(null);

  const [status, setStatus] = useState('Idle');
  const [matchedPeer, setMatchedPeer] = useState(null);
  const [iceServers, setIceServers] = useState([{ urls: 'stun:global.stun.twilio.com:3478' }]);
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState([]);

  const [remoteGlow, setRemoteGlow] = useState(false);

  



  useEffect(() => {
    // connect socket
    socketRef.current = io(SERVER_URL);

    socketRef.current.on("chat-message", ({ from, message }) => {
      setMessages(prev => [...prev, { sender: "peer", text: message }]);
    });

    socketRef.current.on('connect', () => {
      console.log('socket connected', socketRef.current.id);
    });

    socketRef.current.on('waiting', () => {
      setStatus('Waiting for partner...');
    });

    socketRef.current.on("tab-change", ({ tab }) => {
      navigate(tab);
    });


    socketRef.current.on('matched', async ({ peerId }) => {
      setStatus('Matched with ' + peerId);
      setMatchedPeer(peerId);

      // TRIGGER GLOW
      setRemoteGlow(true);
      setTimeout(() => setRemoteGlow(false), 2000);

      // fetch ICE servers...
      try {
        const res = await fetch(SERVER_URL + '/ice-servers');
        const json = await res.json();
        if (json && json.iceServers) setIceServers(json.iceServers);
      } catch (e) {
        console.warn('could not load ice servers', e);
      }

      await preparePeerConnection(peerId);
      const isCaller = socketRef.current.id < peerId;
      if (isCaller) {
        await createAndSendOffer();
      } else {
        setStatus('Waiting for offer...');
      }
    });


    socketRef.current.on('signal', async ({ from, type, data }) => {
      if (!pcRef.current) {
        await preparePeerConnection(from);
      }
      if (type === 'offer') {
        setStatus('Received offer — creating answer...');
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(data));
        const answer = await pcRef.current.createAnswer();
        await pcRef.current.setLocalDescription(answer);
        socketRef.current.emit('signal', { type: 'answer', data: answer });
      } else if (type === 'answer') {
        setStatus('Received answer — finishing...');
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(data));
      } else if (type === 'ice') {
        try {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(data));
        } catch (e) {
          console.warn('Error adding remote ICE candidate', e);
        }
      }
    });

    socketRef.current.on('peer-left', () => {
      setStatus('Peer left');
      cleanup();
    });

    return () => {
      cleanup();
      socketRef.current?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps


  }, []);
  

  function sendMessage() {
    if (!matchedPeer || !chatInput.trim()) return;

    socketRef.current.emit("chat-message", {
      to: matchedPeer,
      message: chatInput
    });

    // show your own message locally
    setMessages(prev => [...prev, { sender: "me", text: chatInput }]);
    setChatInput("");
  }


  async function getLocalMedia() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      return stream;
    } catch (e) {
      alert('Camera/mic required: ' + e.message);
      throw e;
    }
  }

  async function preparePeerConnection(peerId) {
    if (pcRef.current) return;
    setStatus('Preparing peer connection...');
    // use the ice servers fetched earlier
    const pc = new RTCPeerConnection({ iceServers });
    pcRef.current = pc;

    // send any new ICE candidates to peer via signaling
    pc.onicecandidate = (evt) => {
      if (evt.candidate) {
        socketRef.current.emit('signal', { type: 'ice', data: evt.candidate });
      }
    };

    // when remote track arrives
    pc.ontrack = (evt) => {
      // prefer stream if present
      if (evt.streams && evt.streams[0]) {
        remoteVideoRef.current.srcObject = evt.streams[0];
      } else {
        const ms = new MediaStream();
        ms.addTrack(evt.track);
        remoteVideoRef.current.srcObject = ms;
      }
    };

    // add local tracks
    if (!localStreamRef.current) await getLocalMedia();
    localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current));

    pc.onconnectionstatechange = () => {
      console.log('PC connectionState:', pc.connectionState);
      if (pc.connectionState === 'connected') setStatus('Connected!');
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        setStatus('Connection closed');
        cleanup();
      }
    };
  }

  async function createAndSendOffer() {
    setStatus('Creating offer...');
    const pc = pcRef.current;
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socketRef.current.emit('signal', { type: 'offer', data: offer });
  }

  function findPartner() {
    setStatus('Searching...');
    socketRef.current.emit('find');
  }

  function leave() {
    socketRef.current.emit('leave');
    cleanup();
    setStatus('Left');
    findPartner();
  }

  function cleanup() {
    // close RTCPeerConnection
    if (pcRef.current) {
      try { pcRef.current.close(); } catch (e) {}
      pcRef.current = null;
    }
    // stop remote tracks
    if (remoteVideoRef.current && remoteVideoRef.current.srcObject) {
      const s = remoteVideoRef.current.srcObject;
      if (s.getTracks) s.getTracks().forEach(t => t.stop());
      remoteVideoRef.current.srcObject = null;
    }
    // keep local stream running to avoid repeated permission prompts
    setMatchedPeer(null);
  }

  return (
  <div className="w-full min-h-screen flex flex-col">
    <Navbar />

    <div className="flex-1 w-full flex items-center justify-center p-2">
      <div className="w-full h-full max-w-7xl p-4 flex flex-col lg:flex-row gap-4">

        {/* LEFT SIDE */}
        <div className="w-full lg:w-1/3 flex flex-col gap-4">
          <VideoSection
            localVideoRef={localVideoRef}
            remoteVideoRef={remoteVideoRef}
            remoteGlow={remoteGlow}
          />

          <div className="flex gap-3">
            <button onClick={findPartner} className="btn btn-success flex-1">
              Start
            </button>

            <button onClick={leave} className="btn btn-error flex-1">
              Leave
            </button>
          </div>
        </div>

        {/* RIGHT SIDE */}
        <div className="flex-1 bg-base-300 rounded-xl shadow-inner p-2 overflow-hidden">
          <Routes>
            <Route
              path="/"
              element={<SandboxLayout socketRef={socketRef} matchedPeer={matchedPeer} />}
            >
              <Route
                path="chat"
                element={
                  <ChatUI
                    socketRef={socketRef}
                    matchedPeer={matchedPeer}
                    messages={messages}
                    chatInput={chatInput}
                    setChatInput={setChatInput}
                    sendMessage={sendMessage}
                    status={status}
                  />
                }
              />

              <Route
                path="youtube"
                element={
                  <YouTubeTogether socketRef={socketRef} matchedPeer={matchedPeer} />
                }
              />

              <Route
                path="game/*"
                element={
                  <GameTogether socketRef={socketRef} matchedPeer={matchedPeer} />
                }
              />

              <Route
                path="music"
                element={
                  <MusicTogether socketRef={socketRef} matchedPeer={matchedPeer} />
                }
              />
            </Route>
          </Routes>
        </div>

      </div>
    </div>
  </div>
);




}



























function VideoSection({ localVideoRef, remoteVideoRef, remoteGlow }) {
  return (
    <div className="w-full flex flex-col gap-4">

      {/* LOCAL */}
      <div className="card bg-base-100 shadow-md p-3">
        <div className="mb-1 text-sm opacity-70">Local</div>

        <div className="w-full h-48 bg-black rounded-box overflow-hidden">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />
        </div>
      </div>

      {/* REMOTE */}
      <div className="card bg-base-100 shadow-md p-3">
        <div className="mb-1 text-sm opacity-70">Remote</div>

        <div
          className={`
            w-full h-48 bg-black rounded-box overflow-hidden transition-all
            ${remoteGlow ? "neon-glow" : ""}
          `}
        >
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        </div>
      </div>

    </div>
  );
}











