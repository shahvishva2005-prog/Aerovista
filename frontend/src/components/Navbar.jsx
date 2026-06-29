import React, { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Plane, Menu, X, LogOut, LayoutDashboard } from "lucide-react";

const links = [
  { to: "/", label: "Home" },
  { to: "/search", label: "Book Flight" },
  { to: "/track", label: "Track Flight" },
  { to: "/checkin", label: "Web Check-In" },
  { to: "/offers", label: "Offers" },
  { to: "/destinations", label: "Destinations" },
  { to: "/fleet", label: "Fleet" },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const nav = useNavigate();

  const dashHref =
    user?.role === "admin" ? "/admin"
    : user?.role === "pilot" ? "/pilot"
    : user?.role === "crew" ? "/crew"
    : "/account";

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-[#0B132B] border-b border-amber-400/30 shadow-md">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12 h-20 flex items-center justify-between">
        <Link to="/" data-testid="brand-link" className="flex items-center gap-3 group">
          <div className="w-11 h-11 rounded-full border-2 border-amber-400 flex items-center justify-center bg-transparent group-hover:bg-amber-400/10 transition">
            <Plane className="w-5 h-5 text-amber-400 -rotate-45" />
          </div>
          <div>
            <div className="font-serif-display text-2xl tracking-wide leading-none text-white">AeroVista</div>
            <div className="text-[10px] tracking-[0.25em] uppercase text-amber-300/85">Airlines</div>
          </div>
        </Link>

        <nav className="hidden lg:flex items-center gap-7">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to}
              data-testid={`nav-${l.label.toLowerCase().replace(/\s+/g, "-")}`}
              className={({ isActive }) =>
                `text-sm font-medium tracking-wide transition-colors relative after:absolute after:left-0 after:-bottom-1 after:h-px after:bg-amber-400 after:transition-all ${
                  isActive
                    ? "text-amber-300 after:w-full"
                    : "text-white/85 hover:text-amber-300 after:w-0 hover:after:w-full"
                }`}>
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden lg:flex items-center gap-3">
          {!user ? (
            <>
              <Link to="/login" data-testid="nav-login"
                className="text-sm text-white/90 hover:text-amber-300 px-4 py-2 transition">Sign In</Link>
              <Link to="/register" data-testid="nav-register"
                className="text-sm font-semibold bg-amber-400 hover:bg-amber-300 text-[#0B132B] px-5 py-2.5 rounded-full transition shadow-md hover:shadow-lg">
                Join SkyChip
              </Link>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link to={dashHref} data-testid="nav-dashboard"
                className="text-sm text-white/90 hover:text-amber-300 px-3 py-2 inline-flex items-center gap-2 transition">
                <LayoutDashboard className="w-4 h-4" /> Dashboard
              </Link>
              <button onClick={() => { logout(); nav("/"); }} data-testid="nav-logout"
                className="text-sm bg-white/10 hover:bg-amber-400 hover:text-[#0B132B] text-white px-4 py-2 rounded-full inline-flex items-center gap-2 transition">
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            </div>
          )}
        </div>

        <button data-testid="mobile-menu-btn" className="lg:hidden p-2 text-white" onClick={() => setOpen((s) => !s)}>
          {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {open && (
        <div className="lg:hidden border-t border-amber-400/20 bg-[#0B132B]">
          <div className="flex flex-col px-6 py-4 gap-3">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} onClick={() => setOpen(false)}
                className={({ isActive }) => `py-2 transition ${isActive ? "text-amber-300" : "text-white/85"}`}>
                {l.label}
              </NavLink>
            ))}
            {!user ? (
              <div className="flex gap-2 pt-2">
                <Link to="/login" onClick={() => setOpen(false)} className="flex-1 text-center py-2 border border-white/20 rounded-full text-white">Sign In</Link>
                <Link to="/register" onClick={() => setOpen(false)} className="flex-1 text-center bg-amber-400 text-[#0B132B] py-2 rounded-full font-semibold">Join</Link>
              </div>
            ) : (
              <div className="flex gap-2 pt-2">
                <Link to={dashHref} onClick={() => setOpen(false)} className="flex-1 text-center py-2 border border-white/20 rounded-full text-white">Dashboard</Link>
                <button onClick={() => { logout(); setOpen(false); nav("/"); }} className="flex-1 bg-white/10 text-white py-2 rounded-full">Sign Out</button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
