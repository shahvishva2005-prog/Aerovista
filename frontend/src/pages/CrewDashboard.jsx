import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Users, Star, AlertCircle, Baby, Heart } from "lucide-react";

export default function CrewDashboard() {
  const [flights, setFlights] = useState([]);
  const [selected, setSelected] = useState(null);
  const [manifest, setManifest] = useState(null);

  useEffect(() => { api.get("/crew/flights").then((r) => setFlights(r.data)); }, []);

  const load = async (id) => {
    setSelected(id);
    const r = await api.get(`/crew/manifest/${id}`);
    setManifest(r.data);
  };

  return (
    <div className="min-h-screen pt-24 pb-16" data-testid="crew-page">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="mb-8">
          <div className="text-amber-400 text-xs tracking-[0.3em] uppercase mb-3">Cabin Crew Portal</div>
          <h2 className="font-serif-display text-4xl text-white">Passenger Manifest</h2>
        </div>

        <div className="grid lg:grid-cols-4 gap-6">
          <aside className="lg:col-span-1 glass-light rounded-2xl p-4 max-h-[80vh] overflow-y-auto">
            <div className="text-amber-400 text-xs tracking-[0.3em] uppercase mb-3 px-2">Today's Flights</div>
            <div className="space-y-1">
              {flights.slice(0, 30).map((f) => (
                <button key={f.id} onClick={() => load(f.id)} data-testid={`crew-flight-${f.flight_number}`}
                  className={`w-full text-left p-3 rounded-lg transition ${selected === f.id ? "bg-amber-400/20 border border-amber-400/40" : "hover:bg-white/5"}`}>
                  <div className="font-mono-aero text-amber-400 text-sm">{f.flight_number}</div>
                  <div className="text-white text-xs">{f.origin} → {f.destination}</div>
                  <div className="text-white/45 text-[11px]">{f.departure_date} • {f.departure_time}</div>
                </button>
              ))}
            </div>
          </aside>

          <main className="lg:col-span-3">
            {!manifest ? (
              <div className="glass-light rounded-2xl p-12 text-center text-white/55">
                Select a flight from the left to view passenger manifest.
              </div>
            ) : (
              <>
                <div className="glass-light rounded-2xl p-5 mb-5">
                  <div className="grid md:grid-cols-4 gap-4">
                    <Pill Icon={Users} label="Total Passengers" v={manifest.total} />
                    <Pill Icon={Star} label="VIP / Premium" v={manifest.passengers.filter((p) => p.cabin_class !== "economy").length} />
                    <Pill Icon={Baby} label="Children / Infants" v={manifest.passengers.filter((p) => p.is_child || p.is_infant).length} />
                    <Pill Icon={Heart} label="Special Care" v={manifest.passengers.filter((p) => p.is_senior || p.is_disabled).length} />
                  </div>
                </div>

                <div className="glass-light rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-white/5">
                        <tr>
                          {["PNR", "Passenger", "Seat", "Class", "Meal", "Flags"].map((h) => (
                            <th key={h} className="text-left p-3 text-amber-400 text-xs uppercase tracking-widest">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {manifest.passengers.map((p, i) => (
                          <tr key={i} className="border-t border-white/5">
                            <td className="p-3 font-mono-aero text-amber-400">{p.pnr}</td>
                            <td className="p-3 text-white">{p.title} {p.first_name} {p.last_name}</td>
                            <td className="p-3 font-mono-aero text-white/80">{p.seat || "—"}</td>
                            <td className="p-3 text-white/70 capitalize">{p.cabin_class.replace("_", " ")}</td>
                            <td className="p-3 text-white/70">{p.meal}</td>
                            <td className="p-3">
                              <div className="flex gap-1 flex-wrap">
                                {p.is_senior && <Tag>Senior</Tag>}
                                {p.is_disabled && <Tag color="rose">Disabled</Tag>}
                                {p.is_child && <Tag color="sky">Child</Tag>}
                                {p.is_infant && <Tag color="purple">Infant</Tag>}
                              </div>
                            </td>
                          </tr>
                        ))}
                        {manifest.passengers.length === 0 && (
                          <tr><td colSpan="6" className="p-8 text-center text-white/55">No paid bookings for this flight yet.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

function Pill({ Icon, label, v }) {
  return (
    <div className="bg-white/5 rounded-xl p-4">
      <Icon className="w-4 h-4 text-amber-400 mb-2" />
      <div className="font-serif-display text-2xl text-white">{v}</div>
      <div className="text-white/55 text-[10px] uppercase tracking-widest">{label}</div>
    </div>
  );
}

function Tag({ children, color = "amber" }) {
  const map = {
    amber: "bg-amber-400/15 text-amber-300",
    rose: "bg-rose-500/15 text-rose-300",
    sky: "bg-sky-500/15 text-sky-300",
    purple: "bg-purple-500/15 text-purple-300",
  };
  return <span className={`px-2 py-0.5 text-[10px] rounded-full ${map[color]}`}>{children}</span>;
}
