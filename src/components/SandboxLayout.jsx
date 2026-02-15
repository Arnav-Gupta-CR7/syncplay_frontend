import { useNavigate, Outlet, useLocation } from "react-router-dom";
import { useEffect } from "react";

export default function SandboxLayout({ socketRef, matchedPeer }) {
  const navigate = useNavigate();
  const location = useLocation();

  // Active tab comes from the URL itself
  const activeTab = location.pathname.split("/").pop() || "chat";

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

  // Listen for peer switching tab
  useEffect(() => {
    if (!socketRef.current) return;

    const handler = ({ tab }) => navigate(tab);

    socketRef.current.on("tab-change", handler);
    return () => socketRef.current.off("tab-change", handler);
  }, [socketRef, navigate]);

  return (
    <div className="flex flex-col w-full h-full">
      {/* HEADER */}
      <div className="border-b p-2 bg-base-100 shadow-sm">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => switchTab("chat")}
            className={`btn btn-sm whitespace-nowrap ${
              activeTab === "chat" ? "btn-primary" : "btn-outline"
            }`}
          >
            Chat
          </button>

          <button
            onClick={() => switchTab("youtube")}
            className={`btn btn-sm whitespace-nowrap ${
              activeTab === "youtube" ? "btn-primary" : "btn-outline"
            }`}
          >
            YouTube
          </button>

          <button
            onClick={() => switchTab("game")}
            className={`btn btn-sm whitespace-nowrap ${
              activeTab === "game" ? "btn-primary" : "btn-outline"
            }`}
          >
            Game
          </button>

          {/* <button
            onClick={() => switchTab("music")}
            className={`btn btn-sm whitespace-nowrap ${
              activeTab === "music" ? "btn-primary" : "btn-outline"
            }`}
          >
            Music
          </button> */}
        </div>
      </div>

      {/* CONTENT */}
      <div className="flex-1 p-4 overflow-y-auto bg-base-200">
        <Outlet />
      </div>
    </div>
  );
}
