import axios from "axios";

// Absolute path assignment map to avoid CDN relative path loops
const BASE_BACKEND_URL = "https://aerovista-backend.onrender.com";

export const API = `${BASE_BACKEND_URL}/api`;

export const api = axios.create({ 
    baseURL: API 
});

// Authentication and token binding interceptor
api.interceptors.request.use((config) => {
    const token = localStorage.getItem("av_token");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Automatic session clearing interceptor for 401 statuses
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

// Currency formatting utility
export function fmtINR(n) {
    if (n == null || isNaN(n)) return "₹0";
    return "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

// Date localized layout transformation tool
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
