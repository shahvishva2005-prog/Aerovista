import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Plane, Clock, MapPin } from "lucide-react";

export default function PilotDashboard() {
  const [data, setData] = useState(null);
  useEffect(() => { api.get("/pilot/flights").then((r) => setData(r.data)); }, []);

  if (!data) return <div className="pt-32 text-center text-white/70">Loading…</div>;

  return (
    <div className="min-h-screen pt-24 pb-16" data-testid="pilot-page">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="mb-8">
          <div className="text-amber-400 text-xs tracking-[0.3em] uppercase mb-3">Pilot Portal</div>
          <h2 className="font-serif-display text-4xl text-white">{data.pilot?.name || "Captain"}</h2>
          {data.pilot && (
            <div className="text-white/55 text-sm mt-2 flex flex-wrap gap-x-6 gap-y-1">
              <span>Employee ID: <span className="text-amber-400 font-mono-aero">{data.pilot.employee_id}</span></span>
              <span>Rank: {data.pilot.rank}</span>
              <span>Flight Hours: <span className="text-amber-400">{data.pilot.flight_hours.toLocaleString()}</span></span>
              <span>Base: {data.pilot.base}</span>
            </div>
          )}
        </div>

        <h3 className="font-serif-display text-2xl text-white mb-4">Assigned Flights ({data.flights.length})</h3>
        <div className="space-y-3">
          {data.flights.map((f) => (
            <div key={f.id} className="glass-light rounded-2xl p-5">
              <div className="grid md:grid-cols-12 gap-4 items-center">
                <div className="md:col-span-3">
                  <div className="font-mono-aero text-amber-400">{f.flight_number}</div>
                  <div className="text-white/55 text-xs">{f.aircraft}</div>
                </div>
                <div className="md:col-span-5 grid grid-cols-3 items-center">
                  <div>
                    <div className="font-serif-display text-xl text-white">{f.departure_time}</div>
                    <div className="text-white/55 text-xs">{f.origin} • {f.departure_date}</div>
                  </div>
                  <div className="text-center text-white/55 text-xs flex items-center justify-center gap-1">
                    <Clock className="w-3 h-3 text-amber-400" /> {f.duration}
                  </div>
                  <div className="text-right">
                    <div className="font-serif-display text-xl text-white">{f.arrival_time}</div>
                    <div className="text-white/55 text-xs">{f.destination}</div>
                  </div>
                </div>
                <div className="md:col-span-2 text-white/55 text-xs">
                  <MapPin className="w-3 h-3 inline text-amber-400" /> T {f.terminal} / G {f.gate}
                </div>
                <div className="md:col-span-2 text-right">
                  <span className="px-3 py-1 text-[10px] rounded-full bg-amber-400/15 text-amber-300 uppercase">{f.status}</span>
                </div>
              </div>
            </div>
          ))}
          {data.flights.length === 0 && <div className="text-center py-16 text-white/55 glass-light rounded-2xl">No flights assigned.</div>}
        </div>
      </div>
    </div>
  );
}
