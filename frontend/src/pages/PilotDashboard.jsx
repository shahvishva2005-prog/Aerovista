import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Plane, Clock, MapPin, Users } from "lucide-react";

export default function PilotDashboard() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("flights");

  useEffect(() => { api.get("/pilot/flights").then((r) => setData(r.data)); }, []);

  if (!data) return <div className="pt-32 text-center text-[#0B132B]/72">Loading…</div>;

  const roster = data.cabin_crew_roster || [];

  return (
    <div className="min-h-screen pt-24 pb-16" data-testid="pilot-page">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="mb-8">
          <div className="text-amber-700 text-xs tracking-[0.3em] uppercase mb-3">Pilot Portal</div>
          <h2 className="font-serif-display text-4xl text-[#0B132B]">{data.pilot?.name || "Captain"}</h2>
          {data.pilot && (
            <div className="text-[#0B132B]/60 text-sm mt-2 flex flex-wrap gap-x-6 gap-y-1">
              <span>Employee ID: <span className="text-amber-700 font-mono-aero">{data.pilot.employee_id}</span></span>
              <span>Rank: {data.pilot.rank}</span>
              <span>Flight Hours: <span className="text-amber-700">{data.pilot.flight_hours.toLocaleString()}</span></span>
              <span>Base: {data.pilot.base}</span>
            </div>
          )}
        </div>

        <div className="flex gap-2 mb-6">
          {[
            ["flights", `Assigned Flights (${data.flights.length})`],
            ["roster", `Cabin Crew Roster (${roster.length})`],
          ].map(([v, l]) => (
            <button key={v} onClick={() => setTab(v)} data-testid={`pilot-tab-${v}`}
              className={`px-5 py-2 rounded-full text-sm transition ${tab === v ? "bg-amber-400 text-[#0B132B]" : "glass-light text-[#0B132B]/80"}`}>{l}</button>
          ))}
        </div>

        {tab === "flights" && (
          <div className="space-y-3">
            {data.flights.map((f) => (
              <div key={f.id} className="glass-light rounded-2xl p-5" data-testid={`pilot-flight-${f.flight_number}`}>
                <div className="grid md:grid-cols-12 gap-4 items-center">
                  <div className="md:col-span-3">
                    <div className="font-mono-aero text-amber-700">{f.flight_number}</div>
                    <div className="text-[#0B132B]/60 text-xs">{f.aircraft}</div>
                  </div>
                  <div className="md:col-span-5 grid grid-cols-3 items-center">
                    <div>
                      <div className="font-serif-display text-xl text-[#0B132B]">{f.departure_time}</div>
                      <div className="text-[#0B132B]/60 text-xs">{f.origin} • {f.departure_date}</div>
                    </div>
                    <div className="text-center text-[#0B132B]/60 text-xs flex items-center justify-center gap-1">
                      <Clock className="w-3 h-3 text-amber-700" /> {f.duration}
                    </div>
                    <div className="text-right">
                      <div className="font-serif-display text-xl text-[#0B132B]">{f.arrival_time}</div>
                      <div className="text-[#0B132B]/60 text-xs">{f.destination}</div>
                    </div>
                  </div>
                  <div className="md:col-span-2 text-[#0B132B]/60 text-xs">
                    <MapPin className="w-3 h-3 inline text-amber-700" /> T {f.terminal} / G {f.gate}
                  </div>
                  <div className="md:col-span-2 text-right">
                    <span className="px-3 py-1 text-[10px] rounded-full bg-amber-400/15 text-amber-600 uppercase">{f.status}</span>
                  </div>
                </div>

                {f.crew && f.crew.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-[#E5E1D6]">
                    <div className="text-[10px] uppercase tracking-widest text-amber-700 mb-2 flex items-center gap-2">
                      <Users className="w-3 h-3" /> Cabin Crew Assigned ({f.crew.length})
                    </div>
                    <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-2">
                      {f.crew.map((c) => (
                        <div key={c.id} className="p-2 rounded-lg bg-amber-50 border border-amber-200">
                          <div className="text-sm text-[#0B132B] font-medium">{c.name}</div>
                          <div className="text-[10px] text-[#0B132B]/60">{c.role} • {c.employee_id}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {data.flights.length === 0 && <div className="text-center py-16 text-[#0B132B]/60 glass-light rounded-2xl">No flights assigned.</div>}
          </div>
        )}

        {tab === "roster" && (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3" data-testid="crew-roster">
            {roster.map((c) => (
              <div key={c.id} className="glass-light rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full av-bg-gold grid place-items-center text-[#0B132B] font-semibold">
                    {c.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm text-[#0B132B] font-medium truncate">{c.name}</div>
                    <div className="text-[10px] text-[#0B132B]/60">{c.employee_id}</div>
                  </div>
                </div>
                <div className="text-[11px] text-[#0B132B]/70 mt-2">
                  <div>{c.role}</div>
                  <div className="text-[10px] text-[#0B132B]/55 mt-1">{(c.languages || []).join(" • ")}</div>
                  <div className="text-[10px] text-amber-700 mt-1">Base {c.base}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
