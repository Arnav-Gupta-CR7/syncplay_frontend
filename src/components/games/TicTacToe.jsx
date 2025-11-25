// TicTacToe.jsx 
import React, { useEffect, useMemo, useState } from "react";

function calculateWinner(board) {
  const lines = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
  ];
  for (const [a,b,c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return null;
}

export default function TicTacToe({ socketRef, matchedPeer }) {
  const [board, setBoard] = useState(Array(9).fill(null));
  const [mySymbol, setMySymbol] = useState("X");
  const [turn, setTurn] = useState("X");
  const [winner, setWinner] = useState(null);

  useEffect(() => {
    if (!socketRef?.current || !matchedPeer) return;
    const me = socketRef.current.id;
    const starterIsMe = me < matchedPeer;
    setMySymbol(starterIsMe ? "X" : "O");
    setTurn("X");
  }, [socketRef, matchedPeer]);

  function sendMove(index, symbol) {
    if (!socketRef?.current || !matchedPeer) return;
    socketRef.current.emit("game-move", {
      to: matchedPeer,
      game: "tictactoe",
      payload: { index, symbol }
    });
  }

  function handleClick(i) {
    if (winner) return;
    if (turn !== mySymbol) return;
    if (board[i]) return;

    const next = board.slice();
    next[i] = mySymbol;
    setBoard(next);
    setTurn(mySymbol === "X" ? "O" : "X");
    sendMove(i, mySymbol);
  }

  useEffect(() => {
    const socket = socketRef?.current;
    if (!socket) return;

    function handler({ game, payload }) {
      if (game !== "tictactoe") return;
      const { index, symbol } = payload;
      setBoard(prev => {
        if (prev[index]) return prev;
        const next = prev.slice();
        next[index] = symbol;
        return next;
      });
      setTurn(symbol === "X" ? "O" : "X");
    }

    socket.on("game-move", handler);
    return () => socket.off("game-move", handler);
  }, [socketRef]);

  useEffect(() => {
    const w = calculateWinner(board);
    setWinner(w);
  }, [board]);

  function resetGame() {
    setBoard(Array(9).fill(null));
    setTurn("X");
    setWinner(null);
    if (socketRef?.current && matchedPeer) {
      socketRef.current.emit("game-reset", { to: matchedPeer, game: "tictactoe" });
    }
  }

  useEffect(() => {
    const socket = socketRef?.current;
    if (!socket) return;
    function onReset({ game }) {
      if (game !== "tictactoe") return;
      setBoard(Array(9).fill(null));
      setTurn("X");
      setWinner(null);
    }
    socket.on("game-reset", onReset);
    return () => socket.off("game-reset", onReset);
  }, [socketRef]);

  const cells = board.map((v, i) => (
    <button
      key={i}
      className="aspect-square w-full flex items-center justify-center 
                 text-4xl font-bold rounded-xl 
                 bg-base-200/40 backdrop-blur-sm
                 hover:bg-primary/20 transition-all duration-150
                 active:scale-95"
      onClick={() => handleClick(i)}
    >
      <span className={`${v === "X" ? "text-primary" : "text-secondary"}`}>
        {v}
      </span>
    </button>
  ));

  return (
    // Smaller version

    <div className="p-2 max-w-sm mx-auto">
    <div className="flex items-center justify-between mb-3">
        <div>
        <h2 className="card-title text-lg">Tic Tac Toe</h2>
        <div className="badge badge-outline mt-1 text-xs">
            You are: {mySymbol}
        </div>
        </div>

        <button className="btn btn-primary btn-xs" onClick={resetGame}>
        Reset
        </button>
    </div>

    <div className="grid grid-cols-3 gap-2 p-3 bg-base-300/30 rounded-xl shadow-inner">
        {board.map((v, i) => (
        <button
            key={i}
            className="aspect-square w-full flex items-center justify-center 
                    text-3xl font-bold rounded-lg
                    bg-base-200/40 backdrop-blur-sm
                    hover:bg-primary/20 transition-all duration-150
                    active:scale-95"
            onClick={() => handleClick(i)}
        >
            <span className={`${v === "X" ? "text-primary" : "text-secondary"}`}>
            {v}
            </span>
        </button>
        ))}
    </div>

    <div className="mt-3">
        {winner ? (
        <div className="alert alert-success py-1 text-sm">
            <span className="font-semibold">{winner} wins!</span>
        </div>
        ) : (
        <div className="alert alert-info py-1 text-sm">
            Turn: <span className="font-semibold ml-1">{turn}</span>
        </div>
        )}
    </div>
    </div>


  );
}
