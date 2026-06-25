import React, { createContext, useContext, useState, useEffect } from "react";
import { api } from "./api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("av_user") || "null"); } catch { return null; }
  });

  useEffect(() => {
    const t = localStorage.getItem("av_token");
    if (t && !user) {
      api.get("/auth/me").then((r) => {
        setUser(r.data);
        localStorage.setItem("av_user", JSON.stringify(r.data));
      }).catch(() => {});
    }
  }, []); // eslint-disable-line

  const login = async (email, password) => {
    const r = await api.post("/auth/login", { email, password });
    localStorage.setItem("av_token", r.data.access_token);
    localStorage.setItem("av_user", JSON.stringify(r.data.user));
    setUser(r.data.user);
    return r.data.user;
  };

  const register = async (payload) => {
    const r = await api.post("/auth/register", payload);
    localStorage.setItem("av_token", r.data.access_token);
    localStorage.setItem("av_user", JSON.stringify(r.data.user));
    setUser(r.data.user);
    return r.data.user;
  };

  const logout = () => {
    localStorage.removeItem("av_token");
    localStorage.removeItem("av_user");
    setUser(null);
  };

  return <AuthCtx.Provider value={{ user, login, register, logout }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
