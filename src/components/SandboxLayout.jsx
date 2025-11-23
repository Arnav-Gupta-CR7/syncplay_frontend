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
    <div className="flex gap-3 border-b p-3 bg-base-100 shadow-sm">
      
      <button
        onClick={() => switchTab("chat")}
        className="btn btn-sm btn-outline"
      >
        Chat
      </button>

      <button
        onClick={() => switchTab("youtube")}
        className="btn btn-sm btn-outline"
      >
        YouTube Together
      </button>

    </div>

    {/* Content */}
    <div className="flex-1 p-4 overflow-y-auto bg-base-200">
      <Outlet />
    </div>

  </div>
);

}
