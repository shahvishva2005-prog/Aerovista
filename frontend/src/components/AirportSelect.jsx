import React, { useEffect, useState, useRef } from "react";
import { api } from "../lib/api";

export default function AirportSelect({ value, onChange, placeholder = "Select airport", testId }) {
  const [query, setQuery] = useState("");
  const [opts, setOpts] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => {
      api.get(`/airports`, { params: query ? { q: query } : {} }).then((r) => setOpts(r.data.slice(0, 20)));
    }, 150);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selected = opts.find((o) => o.iata === value);
  const label = selected ? `${selected.city} (${selected.iata})` : value ? value : "";

  return (
    <div className="relative" ref={ref}>
      <button type="button" data-testid={testId} onClick={() => setOpen((s) => !s)}
        className="w-full text-left bg-[#0B132B]/5 hover:bg-[#0B132B]/10 border border-[#E5E1D6] rounded-lg px-4 py-3.5 transition">
        {label ? (
          <div>
            <div className="text-[#0B132B] font-semibold">{selected ? selected.city : value}</div>
            <div className="text-[#0B132B]/55 text-xs">{selected ? `${selected.iata} • ${selected.name}` : "Airport"}</div>
          </div>
        ) : (
          <div className="text-[#0B132B]/55">{placeholder}</div>
        )}
      </button>
      {open && (
        <div className="absolute z-30 mt-2 w-full max-h-80 overflow-y-auto rounded-xl glass border border-[#E5E1D6] shadow-2xl">
          <input data-testid={`${testId}-search`}
            className="w-full bg-transparent border-b border-[#E5E1D6] px-4 py-3 text-[#0B132B] placeholder-[#0B132B]/40 outline-none"
            placeholder="Search city, airport, country..."
            value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
          <div>
            {opts.map((o) => (
              <button key={o.iata} type="button" data-testid={`airport-opt-${o.iata}`}
                onClick={() => { onChange(o.iata); setOpen(false); setQuery(""); }}
                className="w-full text-left px-4 py-3 hover:bg-[#0B132B]/5 flex items-center justify-between border-b border-[#E5E1D6]">
                <div>
                  <div className="text-[#0B132B] text-sm font-medium">{o.city}, {o.country}</div>
                  <div className="text-[#0B132B]/45 text-xs">{o.name}</div>
                </div>
                <div className="font-mono-aero text-amber-700 text-sm">{o.iata}</div>
              </button>
            ))}
            {opts.length === 0 && <div className="p-4 text-[#0B132B]/55 text-sm">No airports found</div>}
          </div>
        </div>
      )}
    </div>
  );
}
