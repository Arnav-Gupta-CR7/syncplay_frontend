import { useState, useEffect } from "react";

const themes = [
  "light", "dark", "cupcake", "bumblebee", "emerald",
  "corporate", "synthwave", "retro", "cyberpunk",
  "valentine", "halloween", "garden", "forest",
  "aqua", "lofi", "pastel", "fantasy", "wireframe",
  "black", "luxury", "dracula", "cmyk", "autumn",
  "business", "acid", "lemonade", "night", "coffee", "winter"
];

export default function Navbar({ online }) {
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "dark");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  return (
    <div className="navbar bg-base-300 shadow-md px-4">

      {/* LEFT — Logo */}
      <div className="flex-1">
        <a className="text-lg sm:text-xl font-bold">SyncPlay</a>
      </div>

      {/* RIGHT — Online + Theme */}
      <div className="flex-none flex items-center gap-4">

        {/* ONLINE USERS */}
        <div className="badge badge-success gap-2 px-3 py-2 text-sm">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
          {online} online
        </div>

        {/* THEME TOGGLE */}
        <div className="dropdown dropdown-end">
          <div
            tabIndex={0}
            role="button"
            className="btn btn-sm sm:btn-md flex gap-2 m-1"
          >
            <span className="hidden sm:inline">Theme: {theme}</span>
            <svg
              className="w-5 h-5 sm:hidden"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 3v1m0 16v1m9-9h1M4 12H3m15.364 6.364l.707.707M5.636 5.636l-.707-.707m12.728 0l.707-.707M5.636 18.364l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
          </div>

          <ul
            tabIndex={0}
            className="dropdown-content z-50 p-2 shadow bg-base-200 rounded-box w-48 max-h-64 overflow-auto"
          >
            {themes.map((t) => (
              <li key={t}>
                <button
                  onClick={() => setTheme(t)}
                  className={`w-full text-left px-2 py-1 hover:bg-base-300 rounded ${
                    t === theme ? "bg-base-300 font-semibold" : ""
                  }`}
                >
                  {t}
                </button>
              </li>
            ))}
          </ul>
        </div>

      </div>
    </div>
  );
}

