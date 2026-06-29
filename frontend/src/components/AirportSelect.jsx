import React, { useEffect, useState, useRef } from "react";
import { api } from "../lib/api";

export default function AirportSelect({ value, onChange, placeholder = "Select airport", testId }) {
  const [query, setQuery] = useState("");
  const [opts, setOpts] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => {
      api.get(`/airports`, { params: query ? { q: query } : {} })
        .then((r) => {
          // Fallback array validation during data assignment wrapper stage
          const incomingData = r.data || [];
          setOpts(Array.isArray(incomingData) ? incomingData.slice(0, 20) : incomingData);
        })
        .catch((err) => {
          console.error("Airport fetch failed cleanly handled:", err);
          setOpts([]);
        });
    }, 150);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const handler = (e) => { 
      if (ref.current && !ref.current.contains(e.target)) setOpen(false); 
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // 🛡️ Structural Guardrail: Forces opts into a clean array format before find/map executions
  const optsArray = Array.isArray(opts) 
    ? opts 
    : opts && typeof opts === 'object' && Array.isArray(opts.airports)
      ? opts.airports 
      : opts && typeof opts === 'object'
        ? Object.values(opts)
        : [];

  const selected = optsArray.find((o) => o?.iata === value);
  const label = selected ? `${selected.city} (${selected.iata})` : value ? value : "";

  return (
    <div className="relative w-full" ref={ref}>
      <button 
        type="button" 
        data-testid={testId} 
        onClick={() => setOpen((s) => !s)}
        className="w-full text-left bg-white/80 hover:bg-white border border-[#6D7E9E] rounded-xl px-4 py-3.5 transition shadow-sm"
      >
        {label ? (
          <div>
            <div className="text-[#0B132B] font-bold text-base">{selected ? selected.city : value}</div>
            <div className="text-slate-500 font-medium text-xs mt-0.5">
              {selected ? `${selected.iata} • ${selected.name}` : "Airport"}
            </div>
          </div>
        ) : (
          <div className="text-slate-400 font-medium">{placeholder}</div>
        )}
      </button>

      {open && (
        <div className="absolute z-50 mt-2 w-full max-h-80 overflow-y-auto rounded-xl bg-white border border-[#6D7E9E] shadow-2xl">
          <input 
            data-testid={`${testId}-search`}
            className="w-full bg-slate-50 border-b border-[#6D7E9E] px-4 py-3 text-[#0B132B] font-semibold placeholder-slate-400 outline-none sticky top-0 z-10"
            placeholder="Search city, airport, country..."
            value={query} 
            onChange={(e) => setQuery(e.target.value)} 
            autoFocus 
          />
          <div className="divide-y divide-slate-100">
            {/* ✅ FIX: Mapping cleanly over verified safe array stream */}
            {optsArray.map((o) => (
              <button 
                key={o?.iata || Math.random()} 
                type="button" 
                data-testid={`airport-opt-${o?.iata}`}
                onClick={() => { onChange(o?.iata); setOpen(false); setQuery(""); }}
                className="w-full text-left px-4 py-3 bg-white hover:bg-slate-50 flex items-center justify-between transition-all"
              >
                <div className="pr-2">
                  <div className="text-[#0B132B] text-sm font-bold">{o?.city || "Unknown Location"}{o?.country ? `, ${o.country}` : ""}</div>
                  <div className="text-slate-400 text-xs mt-0.5 font-medium truncate max-w-xs sm:max-w-md">{o?.name || "Terminal Hub"}</div>
                </div>
                <div className="font-mono font-bold text-[#D4AF37] bg-[#0B132B]/5 border border-[#0B132B]/10 px-2.5 py-1 rounded-md text-sm">
                  {o?.iata || "N/A"}
                </div>
              </button>
            ))}
            
            {optsArray.length === 0 && (
              <div className="p-5 text-center text-slate-400 font-semibold text-sm bg-white">
                No airports found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
