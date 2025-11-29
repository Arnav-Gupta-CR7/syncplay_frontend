// ChessTogether.jsx
import { useEffect, useMemo, useState, useRef } from "react";
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
  const [highlightSquares, setHighlightSquares] = useState({});

  const [selectedSquare, setSelectedSquare] = useState(null);


  function handleSquareClick(square) {
    const turn = chess.turn() === "w" ? "white" : "black";

    // Not your turn
    if (turn !== myColor) {
      setSelectedSquare(null);
      setHighlightSquares({});
      return;
    }

    const piece = chess.get(square); // <- read piece on clicked square

    // 🟡 No selected square yet → first click
    if (!selectedSquare) {
      if (!piece || piece.color !== (myColor[0])) {
        // clicked empty square or opponent piece
        return;
      }

      // highlight legal moves
      const moves = chess.moves({ square, verbose: true });
      const highlights = {};

      moves.forEach(m => {
        highlights[m.to] = {
          background: "rgba(0,255,130,0.3)",
          borderRadius: "50%",
          boxShadow: "0 0 12px rgba(0,255,130,0.5)",
        };
      });

      highlights[square] = {
        background: "rgba(255,255,0,0.5)"
      };

      setSelectedSquare(square);
      setHighlightSquares(highlights);
      return;
    }

    // 🟢 If user clicked another one of THEIR pieces → switch selection
    if (piece && piece.color === myColor[0]) {
      const moves = chess.moves({ square, verbose: true });
      const highlights = {};

      moves.forEach(m => {
        highlights[m.to] = {
          background: "rgba(0,255,130,0.3)",
          borderRadius: "50%",
          boxShadow: "0 0 12px rgba(0,255,130,0.5)",
        };
      });

      highlights[square] = {
        background: "rgba(255,255,0,0.5)"
      };

      setSelectedSquare(square);
      setHighlightSquares(highlights);
      return;
    }

    // 🟣 Otherwise → attempt move
    const move = chess.move({
      from: selectedSquare,
      to: square,
      promotion: "q"
    });

    if (!move) {
      // illegal move → reset
      setSelectedSquare(null);
      setHighlightSquares({});
      return;
    }

    // Valid move → update game
    setFen(chess.fen());
    setTurnColor(chess.turn() === "w" ? "white" : "black");
    setLastMove({ from: move.from, to: move.to });

    sendMove({
      from: move.from,
      to: move.to,
      promotion: move.promotion,
    });

    setSelectedSquare(null);
    setHighlightSquares({});
  }



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
  <div className="px-4">

    {/* Header */}
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-5 gap-3">
      <div>
        <h1 className="text-3xl font-extrabold">Chess</h1>
        <p className="text-sm opacity-60 mt-1">
          {status} • {statusText}
        </p>
      </div>

      <button className="btn btn-primary btn-sm self-start sm:self-auto" onClick={resetGame}>
        Reset Game
      </button>
    </div>

    {/* Layout */}
    <div className="flex flex-col lg:flex-row gap-8 items-center lg:items-start">

      {/* Chessboard */}
      <div className="w-full max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg">
        <Chessboard
          id="ChessBoard"
          customSquareStyles={highlightSquares}
          
          position={fen}
          onSquareClick={handleSquareClick}
          
          boardOrientation={myColor}
          arePiecesDraggable={false}
          animationDuration={200}
          customBoardStyle={{
            borderRadius: "12px",
            boxShadow: "0 8px 22px rgba(0,0,0,0.18)",
          }}
          customDarkSquareStyle={{ backgroundColor: "#38b381" }}  
          customLightSquareStyle={{ backgroundColor: "#e8f7ef" }}
        />
      </div>

      {/* Sidebar */}
      <div className="w-full lg:w-64 space-y-4">

        {/* Status Card */}
        <div className="card bg-base-100 shadow-md rounded-xl border border-base-200">
          <div className="card-body p-5">
            
            <h2 className="card-title text-lg">Game Info</h2>
            <div className="divider my-2"></div>

            <div className="flex justify-between text-sm opacity-70">
              <span>You are:</span>
              <span className="font-semibold capitalize opacity-100">{myColor}</span>
            </div>

            <div className="flex justify-between text-sm opacity-70">
              <span>Turn:</span>
              <span className="font-semibold capitalize opacity-100">{turnColor}</span>
            </div>

            <div className="flex justify-between text-sm opacity-70">
              <span>Status:</span>
              <span className="font-medium opacity-100">{statusText}</span>
            </div>

            <button
              className="btn btn-outline btn-sm w-full mt-4"
              onClick={() => {
                navigator.clipboard.writeText(chess.fen());
                alert("FEN copied!");
              }}
            >
              Copy FEN
            </button>
          </div>
        </div>

        {/* Notes */}
        <div className="text-xs opacity-60 text-center lg:text-left">
          Moves sync automatically in real-time.
        </div>

      </div>
    </div>
  </div>
);


}
