// ChessTogether.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";

export default function ChessTogether({ socketRef, matchedPeer }) {

  const chessRef = useRef(new Chess());
  const chess = chessRef.current;

  const [fen, setFen] = useState("");
  const [myColor, setMyColor] = useState("white");
  const [turnColor, setTurnColor] = useState("white");
  const [status, setStatus] = useState("Waiting...");
  const [lastMove, setLastMove] = useState(null);

  // Setup when paired
  useEffect(() => {
    if (!socketRef?.current || !matchedPeer) return;

    const me = socketRef.current.id;
    const isWhite = me < matchedPeer;

    setMyColor(isWhite ? "white" : "black");
    setStatus(`You are ${isWhite ? "White" : "Black"}`);

    // Reset game when new user joins
    chess.reset();
    setFen(chess.fen());
    setTurnColor(chess.turn() === "w" ? "white" : "black");
    setLastMove(null);

  }, [socketRef, matchedPeer, chess]);

  // Emit move to peer
  function sendMove(move) {
    if (!socketRef?.current || !matchedPeer) return;
    socketRef.current.emit("game-move", {
      to: matchedPeer,
      game: "chess",
      payload: move,
    });
  }

  // Receive moves from peer
  useEffect(() => {
    const socket = socketRef?.current;
    if (!socket) return;

    function handleMove({ game, payload }) {
      if (game !== "chess") return;

      const { from, to, promotion } = payload;
      const move = chess.move({ from, to, promotion });

      if (move) {
        setFen(chess.fen());
        setTurnColor(chess.turn() === "w" ? "white" : "black");
        setLastMove({ from: move.from, to: move.to });
      }
    }

    function handleReset({ game }) {
      if (game !== "chess") return;

      chess.reset();
      setFen(chess.fen());
      setTurnColor("white");
      setLastMove(null);
    }

    socket.on("game-move", handleMove);
    socket.on("game-reset", handleReset);

    return () => {
      socket.off("game-move", handleMove);
      socket.off("game-reset", handleReset);
    };
  }, [socketRef, chess]);

  // Handle player dragging piece
  function handleDrop(sourceSquare, targetSquare) {
  console.log("DROP FIRED:", sourceSquare, "->", targetSquare);

  const turn = chess.turn() === "w" ? "white" : "black";
  if (turn !== myColor) {
    console.log("Incorrect turn");
    return false;
  }

  const move = chess.move({
    from: sourceSquare,
    to: targetSquare,
    promotion: "q"
  });

  if (!move) {
    console.log("Illegal move");
    return false;
  }

  setFen(chess.fen());
  setTurnColor(chess.turn() === "w" ? "white" : "black");
  setLastMove({ from: move.from, to: move.to });

  sendMove({
    from: move.from,
    to: move.to,
    promotion: move.promotion,
  });

  return true;
}


  // Reset game for both
  function resetGame() {
    chess.reset();
    setFen(chess.fen());
    setTurnColor("white");
    setLastMove(null);

    if (socketRef?.current && matchedPeer) {
      socketRef.current.emit("game-reset", {
        to: matchedPeer,
        game: "chess",
      });
    }
  }

  // Status text using v2 API
  const statusText = useMemo(() => {
    if (chess.isCheckmate()) {
      return `Checkmate — ${chess.turn() === "w" ? "Black" : "White"} wins`;
    }

    if (chess.isDraw()) {
      return "Draw";
    }

    if (chess.isCheck()) {
      return `Check — ${chess.turn() === "w" ? "White" : "Black"} to move`;
    }

    return `Turn: ${turnColor} ${
      turnColor === myColor ? "(your move)" : "(opponent)"
    }`;
  }, [fen, turnColor, myColor, chess]);

  return (
    <div className="p-4">

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-2xl font-bold">Chess</div>
          <div className="text-sm opacity-60">
            {status} • {statusText}
          </div>
        </div>

        <button className="btn btn-sm" onClick={resetGame}>
          Reset
        </button>
      </div>

      {/* Board + Sidebar */}
      <div className="flex gap-6">
      
        <Chessboard
          id="ChessBoard"
          position={fen}
          onPieceDrop={handleDrop}
          boardOrientation={myColor}
          arePiecesDraggable={true}
          animationDuration={200}
          customBoardStyle={{
            borderRadius: "8px",
            boxShadow: "0 6px 16px rgba(0,0,0,0.15)",
          }}
          customDarkSquareStyle={{ backgroundColor: "#769656" }}
          customLightSquareStyle={{ backgroundColor: "#eeeed2" }}
        />

        {/* Sidebar */}
        <div className="w-64 space-y-3">
          <div className="card p-4 bg-base-100 shadow rounded-lg">
            <div className="mb-2">
              <div className="text-sm opacity-60">You are:</div>
              <div className="text-lg font-semibold capitalize">{myColor}</div>
            </div>

            <div className="mb-2">
              <div className="text-sm opacity-60">Turn:</div>
              <div className="text-lg font-semibold capitalize">
                {turnColor}
              </div>
            </div>

            <div className="mb-2">
              <div className="text-sm opacity-60">Game status:</div>
              <div className="">{statusText}</div>
            </div>

            <button
              className="btn btn-outline btn-sm w-full mt-3"
              onClick={() => {
                navigator.clipboard.writeText(chess.fen());
                alert("FEN copied!");
              }}
            >
              Copy FEN
            </button>
          </div>

          <div className="text-xs opacity-50">
            Moves are synced automatically in real-time.
          </div>
        </div>

      </div>
    </div>
  );
}
