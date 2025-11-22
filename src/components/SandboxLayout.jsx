import { NavLink, Outlet } from "react-router-dom";

export default function SandboxLayout() {
  return (
    <div className="flex flex-col w-full h-full">

      {/* Header */}
      <div className="flex gap-4 border-b p-3 bg-white">
        <NavLink
          to="chat"
          className={({ isActive }) =>
            `px-4 py-2 rounded-lg text-sm font-medium ${
              isActive ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700"
            }`
          }
        >
          Chat
        </NavLink>

        <NavLink
          to="youtube"
          className={({ isActive }) =>
            `px-4 py-2 rounded-lg text-sm font-medium ${
              isActive ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700"
            }`
          }
        >
          YouTube Together
        </NavLink>
      </div>

      {/* Routed Content */}
      <div className="flex-1 p-4 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
}
