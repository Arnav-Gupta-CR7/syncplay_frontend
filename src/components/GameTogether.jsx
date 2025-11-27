// GameTogether.jsx
import React, { useEffect } from "react";
import { Routes, Route, useNavigate, Outlet } from "react-router-dom";
import TicTacToe from "./games/TicTacToe"; // example game component (below)
import ChessTogether from "./games/ChessTogether";

export default function GameTogether({ socketRef, matchedPeer }) {
  const navigate = useNavigate();

  // Open a game locally and notify peer
  function openGame(route) {
    // navigate to nested route (relative to /game/*)
    navigate(route);

    // notify peer
    if (socketRef?.current && matchedPeer) {
      socketRef.current.emit("game-open", { to: matchedPeer, game: route });
    }
  }

  // Listen to peer opening a game
  useEffect(() => {
    const socket = socketRef?.current;
    if (!socket) return;

    const handler = ({ game }) => {
      // peer asked to open a specific nested route (like "tictactoe")
      // navigate receives route relative to /game/*
      navigate(game);
    };

    socket.on("game-open", handler);
    return () => socket.off("game-open", handler);
  }, [socketRef, matchedPeer, navigate]);

  return (
    <div className="p-6">

      <Routes>
        {/* index: show the lobby grid */}
        <Route
          index
          element={
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {/* Tic Tac Toe */}
              <div
                className="p-4 bg-base-100 rounded-xl shadow hover:bg-base-200 cursor-pointer transition flex flex-col items-center"
                onClick={() => openGame("tictactoe")}
              >
                <svg width="40" height="40" stroke="currentColor" fill="none" className="mb-2">
                  <rect x="5" y="5" width="30" height="30" rx="4" strokeWidth="2"/>
                  <line x1="5" y1="18" x2="35" y2="18" strokeWidth="2"/>
                  <line x1="18" y1="5" x2="18" y2="35" strokeWidth="2"/>
                </svg>
                <span className="font-medium">Tic Tac Toe</span>
              </div>

              {/* Chess (placeholder) */}
              <div
                className="p-4 bg-base-100 rounded-xl shadow hover:bg-base-200 cursor-pointer transition flex flex-col items-center"
                onClick={() => openGame("chess")}
              >
                <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor" className="mb-2">
  <path d="M12 2l3 4-3 4-3-4 3-4zm-3 10h6l1 3-1 5H10l-1-5 1-3zm-2 10h10v2H7v-2z"/>
</svg>


                <span className="font-medium">Chess</span>
              </div>

              {/* Trivia (placeholder) */}
              <div
                className="p-4 bg-base-100 rounded-xl shadow hover:bg-base-200 cursor-pointer transition flex flex-col items-center"
                onClick={() => openGame("trivia")}
              >
                <svg width="40" height="40" fill="none" stroke="currentColor" strokeWidth="2" className="mb-2">
                  <circle cx="20" cy="20" r="18" />
                  <path d="M20 28v-6" />
                  <circle cx="20" cy="14" r="1.5" fill="currentColor" />
                </svg>
                <span className="font-medium">Trivia (coming)</span>
              </div>
            </div>
          }
        />

        {/* nested game routes */}
        <Route path="tictactoe" element={<TicTacToe socketRef={socketRef} matchedPeer={matchedPeer} />} />
        <Route path="chess" element={<ChessTogether socketRef={socketRef} matchedPeer={matchedPeer} />} />
        <Route path="trivia" element={<div className="p-6">Trivia coming soon</div>} />
      </Routes>

      {/* Outlet (optional if you prefer to place nested Routes elsewhere) */}
      <Outlet />
    </div>
  );
}
