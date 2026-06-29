import axios from "axios";

// 🌟 THE CORRECTION: Pointing explicitly to your true, live primary backend hostname URL
const BASE_BACKEND_URL = "https://aerovista.onrender.com";

export const API = `${BASE_BACKEND_URL}/api`;

export const api = axios.create({ 
    baseURL: API 
});

// Authentication request interceptor
api.interceptors.request.use((config) => {
    const token = localStorage.getItem("av_token");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Automatic session expiry handler
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error?.response?.status === 401) {
            localStorage.removeItem("av_token");
            localStorage.removeItem("av_user");
            if (typeof window !== "undefined") {
                window.location.href = "/login";
            }
        }
        return Promise.reject(error);
    }
);

// Unified Currency Formatter Component Utility
export function fmtINR(n) {
    if (n == null || isNaN(n)) return "₹0";
    return "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

// Global Localized Date Transform Parser Utility Node 
export function fmtDate(d) {
    if (!d) return "";
    try { 
        return new Date(d).toLocaleDateString("en-IN", { 
            day: "2-digit", 
            month: "short", 
            year: "numeric" 
        }); 
    } catch (err) { 
        return d; 
    }
}
