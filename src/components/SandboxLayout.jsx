import { useNavigate, Outlet } from "react-router-dom";
import { useEffect } from "react";

export default function SandboxLayout({ socketRef, matchedPeer }) {
  const navigate = useNavigate();

  function switchTab(tab) {
    navigate(tab);

    // notify peer
    if (matchedPeer) {
      socketRef.current.emit("tab-change", {
        to: matchedPeer,
        tab,
      });
    }
  }

  return (
    <div className="flex flex-col w-full h-full">

      {/* Header */}
      <div className="flex gap-4 border-b p-3 bg-white">
        
        <button
          onClick={() => switchTab("chat")}
          className="px-4 py-2 rounded-lg bg-gray-100"
        >
          Chat
        </button>

        <button
          onClick={() => switchTab("youtube")}
          className="px-4 py-2 rounded-lg bg-gray-100"
        >
          YouTube Together
        </button>

      </div>

      <div className="flex-1 p-4 overflow-y-auto">
        <Outlet />
      </div>

    </div>
  );
}
