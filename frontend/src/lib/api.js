import axios from "axios";



const BASE_URL = import.meta.env.VITE_API_URL || "https://aerovista.onrender.com";
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("av_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {
      localStorage.removeItem("av_token");
      localStorage.removeItem("av_user");
    }
    return Promise.reject(err);
  }
);

export function fmtINR(n) {
  if (n == null || isNaN(n)) return "₹ 0";
  return "₹ " + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

export function fmtDate(d) {
  if (!d) return "";
  try { return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return d; }
}
