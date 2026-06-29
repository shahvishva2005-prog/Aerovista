import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import PageShell from "../components/PageShell";
import { Search } from "lucide-react";

export default function Destinations() {
  const [airports, setAirports] = useState([]);
  const [q, setQ] = useState("");
  useEffect(() => { api.get("/airports").then((r) => setAirports(r.data)); }, []);

  const filtered = airports.filter((a) => {
    const s = q.toLowerCase();
    return !q || a.city.toLowerCase().includes(s) || a.country.toLowerCase().includes(s) || a.iata.toLowerCase().includes(s);
  });

  return (
    <PageShell title="Destinations" subtitle="120+ destinations across 6 continents." testId="destinations-page"
      bgUrl="https://images.pexels.com/photos/18280158/pexels-photo-18280158.jpeg?auto=compress&cs=tinysrgb&w=1920">
      <div className="relative max-w-md mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-700" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search city, country, IATA…"
          data-testid="dest-search"
          className="w-full bg-[#0B132B]/5 border border-[#E5E1D6] rounded-full pl-11 pr-4 py-3 text-[#0B132B] text-sm focus:border-amber-400 outline-none" />
      </div>

      <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {filtered.map((a) => (
          <div key={a.iata} className="glass-light rounded-xl p-4 hover:border-amber-500/50 border border-[#E5E1D6] transition" data-testid={`dest-list-${a.iata}`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[#0B132B] font-medium">{a.city}</div>
                <div className="text-[#0B132B]/60 text-xs">{a.country}</div>
              </div>
              <div className="font-mono-aero text-amber-700 text-sm">{a.iata}</div>
            </div>
            <div className="text-[#0B132B]/45 text-xs mt-2 truncate">{a.name}</div>
          </div>
        ))}
      </div>
    </PageShell>
  );
}
