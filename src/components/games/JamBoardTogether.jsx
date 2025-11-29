import React, { useEffect, useRef, useState } from "react";

export default function JamBoardTogether({ socketRef, matchedPeer }) {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const drawing = useRef(null);

  const [color, setColor] = useState("#000000");
  const [size, setSize] = useState(3);
  const [rainbowMode, setRainbowMode] = useState(false);
  const [scrollLocked, setScrollLocked] = useState(false);
  const [showColorTooltip, setShowColorTooltip] = useState(false);

  const hueRef = useRef(0);

  // Scroll lock
  useEffect(() => {
    document.body.style.overflow = scrollLocked ? "hidden" : "auto";
    return () => (document.body.style.overflow = "auto");
  }, [scrollLocked]);

  // Draw function
  function drawLine(x1, y1, x2, y2, color, size, emit = true) {
    const ctx = ctxRef.current;
    if (!ctx) return;

    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.lineCap = "round";

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.closePath();

    if (emit && socketRef?.current && matchedPeer) {
      socketRef.current.emit("jam-draw", {
        to: matchedPeer,
        data: { x1, y1, x2, y2, color, size },
      });
    }
  }

  // Clear board
  function clearBoard(broadcast = true) {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (broadcast && socketRef?.current && matchedPeer) {
      socketRef.current.emit("jam-clear", { to: matchedPeer });
    }
  }

  // Canvas setup + Resize fix
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      canvas.width = rect.width;
      canvas.height = rect.height;

      const ctx = canvas.getContext("2d");
      ctx.lineCap = "round";
      ctxRef.current = ctx;

      clearBoard(false);
    };

    // ensure layout finished
    setTimeout(resize, 0);

    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // Mouse Events
  function handleMouseDown(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    drawing.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handleMouseMove(e) {
    if (!drawing.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const newX = e.clientX - rect.left;
    const newY = e.clientY - rect.top;

    let strokeColor = rainbowMode
      ? `hsl(${(hueRef.current += 3) % 360}, 100%, 50%)`
      : color;

    drawLine(drawing.current.x, drawing.current.y, newX, newY, strokeColor, size);
    drawing.current = { x: newX, y: newY };
  }

  function handleMouseUp() {
    drawing.current = null;
  }

  // Touch Events (mobile)
  function handleTouch(e) {
    e.preventDefault(); // IMPORTANT
    const t = e.touches[0];
    const rect = canvasRef.current.getBoundingClientRect();
    const x = t.clientX - rect.left;
    const y = t.clientY - rect.top;

    if (!drawing.current) {
      drawing.current = { x, y };
      return;
    }

    let strokeColor = rainbowMode
      ? `hsl(${(hueRef.current += 3) % 360}, 100%, 50%)`
      : color;

    drawLine(drawing.current.x, drawing.current.y, x, y, strokeColor, size);
    drawing.current = { x, y };
  }

  function handleTouchEnd(e) {
    e.preventDefault();
    drawing.current = null;
  }

  // Socket listeners
  useEffect(() => {
    const socket = socketRef?.current;
    if (!socket) return;

    socket.on("jam-draw", ({ data }) => {
      drawLine(data.x1, data.y1, data.x2, data.y2, data.color, data.size, false);
    });

    socket.on("jam-clear", () => clearBoard(false));

    return () => {
      socket.off("jam-draw");
      socket.off("jam-clear");
    };
  }, [socketRef, matchedPeer]);

  return (
    <div className="w-full h-full flex flex-col p-2 md:p-4 gap-4">

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">

       {/* COLOR PICKER WITH CLICK-ONLY TOOLTIP */}
        <div className="relative inline-block">
          <label
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => {
              if (rainbowMode) {
                setShowColorTooltip(true);
                setTimeout(() => setShowColorTooltip(false), 2000);
              }
            }}
          >
            {/* Visible Color Swatch */}
            <div
              className={`w-10 h-10 rounded-lg border-2 border-base-300 shadow-md ${
                rainbowMode ? "opacity-40" : ""
              }`}
              style={{ backgroundColor: color }}
            ></div>

            {/* Hidden Color Input */}
            <input
              type="color"
              value={color}
              disabled={rainbowMode}
              className="w-0 h-0 opacity-0 absolute"
              onChange={(e) => setColor(e.target.value)}
            />

            <span className="text-sm opacity-80">Color</span>
          </label>

          {/* Custom Tooltip */}
          {showColorTooltip && rainbowMode && (
            <div className="absolute left-1/2 -translate-x-1/2 mt-2 bg-neutral text-neutral-content text-xs px-3 py-1 rounded shadow-lg z-50 whitespace-nowrap">
              Disable Rainbow Mode
            </div>
          )}
        </div>




        <input
          type="range"
          min="1"
          max="20"
          value={size}
          className="range range-xs w-28"
          onChange={(e) => setSize(Number(e.target.value))}
        />

        <button
          className={`btn btn-sm ${rainbowMode ? "btn-primary" : "btn-outline"}`}
          onClick={() => setRainbowMode(!rainbowMode)}
        >
          🌈 Rainbow
        </button>

        <button
          className={`btn btn-sm ${scrollLocked ? "btn-primary" : "btn-outline"}`}
          onClick={() => setScrollLocked(!scrollLocked)}
        >
          🔒 Scroll Lock
        </button>

        <button className="btn btn-sm btn-error" onClick={() => clearBoard(true)}>
          Clear
        </button>
      </div>

     {/* Canvas Wrapper */}
  <div className="relative rounded-xl bg-base-100 shadow-lg overflow-hidden min-h-[55vh] md:min-h-[60vh]">

    {/* Phone Preview (desktop only) */}
    <div
  className="
    hidden            
    md:flex           
    flex-col items-center
    absolute left-4 top-1/2
    -translate-y-1/2
    border border-primary
    rounded-4xl
    z-20
    bg-transparent
    pointer-events-none select-none
    p-2
  "
  /* Responsive inline sizes for md and lg screens */
  style={{
    width: "200px",   // default for md
    height: "400px",
  }}
>
  <span className="text-primary text-xs mt-2 opacity-70">
    Mobile Drawing Area Preview
  </span>
</div>


 


  



  {/* Canvas */}
  <canvas
    ref={canvasRef}
    className="absolute inset-0 w-full h-full cursor-crosshair z-10"
    style={{ touchAction: "none" }}
    onMouseDown={handleMouseDown}
    onMouseMove={handleMouseMove}
    onMouseUp={handleMouseUp}
    onMouseLeave={handleMouseUp}
    onTouchStart={handleTouch}
    onTouchMove={handleTouch}
    onTouchEnd={handleTouchEnd}
  />
</div>

    </div>
  );
}
