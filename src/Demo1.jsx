import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const SERVER_URL = 'https://10.225.77.98:4000'; // change if backend elsewhere

export default function Demo1() {
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

    socketRef.current.on('matched', async ({ peerId }) => {
      setStatus('Matched with ' + peerId);
      setMatchedPeer(peerId);
      // fetch ICE servers (STUN/TURN) from backend
      try {
        const res = await fetch(SERVER_URL + '/ice-servers');
        const json = await res.json();
        if (json && json.iceServers) setIceServers(json.iceServers);
      } catch (e) {
        console.warn('could not load ice servers', e);
      }
      // prepare connection
      await preparePeerConnection(peerId);
      // deterministic offer rule: smaller socket id makes the offer
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
  <div className="min-h-screen flex items-center justify-center p-6 bg-gray-100">
    <div className="w-full max-w-5xl bg-white rounded-xl shadow-lg p-6 flex gap-6">

      {/* LEFT: Videos (stacked vertically) */}
      <div className="w-1/3 flex flex-col gap-4">
        <div>
          <div className="mb-1 font-medium text-sm text-gray-700">Local</div>
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full aspect-video bg-black rounded-lg shadow"
          />
        </div>

        <div>
          <div className="mb-1 font-medium text-sm text-gray-700">Remote</div>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full aspect-video bg-black rounded-lg shadow"
          />
        </div>
      </div>

      {/* RIGHT: Controls + Status */}
      <div className="flex-1 flex flex-col justify-between">
        





      <div className="flex flex-col h-full">
  <div className="flex-1 bg-gray-100 rounded-lg p-3 overflow-y-auto shadow-inner">
    {messages.map((msg, i) => (
      <div
        key={i}
        className={`mb-2 flex ${
          msg.sender === "me" ? "justify-end" : "justify-start"
        }`}
      >
        <div
          className={`px-3 py-2 rounded-lg max-w-xs text-sm ${
            msg.sender === "me"
              ? "bg-blue-500 text-white"
              : "bg-gray-300 text-gray-900"
          }`}
        >
          {msg.text}
        </div>
      </div>
    ))}
  </div>

  <div className="mt-3 flex gap-2">
    <input
      value={chatInput}
      onChange={(e) => setChatInput(e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && sendMessage()}
      className="flex-1 px-3 py-2 rounded-lg border border-gray-300"
      placeholder="Type a message..."
    />
    <button
      onClick={sendMessage}
      className="px-4 py-2 bg-blue-600 text-white rounded-lg"
    >
      Send
    </button>
  </div>
</div>













        <div>
          <h1 className="text-2xl font-semibold mb-4">Simple Omegle Clone</h1>

          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={findPartner}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition"
            >
              Find Partner
            </button>

            <button
              onClick={leave}
              className="px-4 py-2 bg-red-500 text-white rounded-lg shadow hover:bg-red-600 transition"
            >
              Leave
            </button>
          </div>

          <div className="text-sm text-gray-600 mb-2">
            Status: <span className="font-medium">{status}</span>
          </div>

          <div className="text-xs text-gray-500">
            Notes: open two tabs or devices to test. Replace TURN creds on server for
            reliable results.
          </div>
        </div>
      </div>
    </div>
  </div>
);

}
