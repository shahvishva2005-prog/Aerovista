import React, { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { api, fmtINR } from "../lib/api";
import FlightSearchWidget from "../components/FlightSearchWidget";
import { Plane, Clock, ArrowRight, Info } from "lucide-react";

export default function FlightSearch() {
  const [params] = useSearchParams();
  const [flights, setFlights] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filterStops, setFilterStops] = useState("any");
  const [sortBy, setSortBy] = useState("price");

  const cabinClass = params.get("cabin_class") || "economy";
  const passengers = Number(params.get("passengers") || 1);

  useEffect(() => {
    const origin = params.get("origin");
    const destination = params.get("destination");
    const dep = params.get("departure_date");
    if (!origin || !destination || !dep) return;
    setLoading(true); setError("");
    api.post("/flights/search", {
      origin, destination, departure_date: dep,
      trip_type: params.get("trip_type") || "one_way",
      passengers, cabin_class: cabinClass,
    }).then((r) => setFlights(r.data.outbound || []))
      .catch((e) => setError(e?.response?.data?.detail || "Search failed"))
      .finally(() => setLoading(false));
  }, [params]); // eslint-disable-line

  const sorted = [...flights].sort((a, b) => {
    if (sortBy === "price") return a.price - b.price;
    if (sortBy === "duration") return a.duration_mins - b.duration_mins;
    if (sortBy === "departure") return a.departure_time.localeCompare(b.departure_time);
    return 0;
  });

  return (
    <div className="min-h-screen pt-24 pb-16" data-testid="search-page">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="mb-8">
          <FlightSearchWidget variant="compact" />
        </div>

        <div className="grid lg:grid-cols-4 gap-6">
          <aside className="lg:col-span-1 glass-light rounded-2xl p-6 h-fit sticky top-28" data-testid="filters">
            <div className="text-amber-700 text-xs tracking-[0.3em] uppercase mb-4">Filters</div>
            <div className="mb-6">
              <div className="text-[#0B132B]/72 text-sm mb-2">Sort By</div>
              {[
                ["price", "Price (Low to High)"],
                ["duration", "Duration"],
                ["departure", "Departure Time"],
              ].map(([v, l]) => (
                <label key={v} className="flex items-center gap-2 text-[#0B132B]/82 text-sm py-1.5 cursor-pointer">
                  <input type="radio" value={v} checked={sortBy === v} onChange={() => setSortBy(v)} data-testid={`sort-${v}`} />
                  {l}
                </label>
              ))}
            </div>
            <div>
              <div className="text-[#0B132B]/72 text-sm mb-2">Stops</div>
              {["any", "nonstop", "1stop"].map((v) => (
                <label key={v} className="flex items-center gap-2 text-[#0B132B]/82 text-sm py-1.5 cursor-pointer">
                  <input type="radio" value={v} checked={filterStops === v} onChange={() => setFilterStops(v)} />
                  {v === "any" ? "Any" : v === "nonstop" ? "Non-stop" : "1 Stop"}
                </label>
              ))}
            </div>
          </aside>

          <section className="lg:col-span-3">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-serif-display text-3xl text-[#0B132B]">
                  {params.get("origin")} → {params.get("destination")}
                </h2>
                <p className="text-[#0B132B]/60 text-sm mt-1">{params.get("departure_date")} • {passengers} passenger(s) • {cabinClass.replace("_", " ")}</p>
              </div>
              <div className="text-amber-700 text-sm">{flights.length} flights</div>
            </div>

            {error && <div className="text-red-400 text-sm mb-4">{error}</div>}
            {loading && <div className="text-[#0B132B]/72 py-12 text-center">Searching luxurious skyways…</div>}
            {!loading && sorted.length === 0 && !error && (
              <div className="glass-light rounded-2xl p-12 text-center">
                <Plane className="w-10 h-10 text-amber-700 mx-auto mb-3" />
                <div className="text-[#0B132B]">No flights found for this route on selected date.</div>
                <div className="text-[#0B132B]/55 text-sm mt-2">Try different dates or destinations.</div>
              </div>
            )}

            <div className="space-y-3">
              {sorted.map((f) => (
                <div key={f.id} className="glass-light rounded-2xl p-5 md:p-6 hover:border-amber-500/50 border border-[#E5E1D6] transition" data-testid={`flight-${f.flight_number}`}>
                  <div className="grid md:grid-cols-12 gap-4 items-center">
                    <div className="md:col-span-2 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full av-bg-gold grid place-items-center">
                        <Plane className="w-4 h-4 text-[#0B132B]" />
                      </div>
                      <div>
                        <div className="text-[#0B132B] font-semibold text-sm">AeroVista</div>
                        <div className="font-mono-aero text-amber-700 text-xs">{f.flight_number}</div>
                      </div>
                    </div>

                    <div className="md:col-span-5 grid grid-cols-3 items-center">
                      <div>
                        <div className="font-serif-display text-2xl text-[#0B132B]">{f.departure_time}</div>
                        <div className="text-[#0B132B]/60 text-xs">{f.origin}</div>
                      </div>
                      <div className="text-center px-2">
                        <div className="text-amber-700 text-xs flex items-center justify-center gap-2">
                          <Clock className="w-3 h-3" /> {f.duration}
                        </div>
                        <div className="border-t border-dashed border-[#E5E1D6] my-1.5 relative">
                          <Plane className="absolute left-1/2 -translate-x-1/2 -top-2 w-3 h-3 text-amber-700" />
                        </div>
                        {f.stops === 1 && f.layover ? (
                          <div className="text-[10px] uppercase font-medium text-amber-700 mt-0.5">
                            1 stop • {f.layover.city} ({f.layover.airport})
                            <div className="text-[9px] text-[#0B132B]/55 normal-case font-normal mt-0.5">
                              Layover {f.layover.layover_str}
                            </div>
                          </div>
                        ) : (
                          <div className="text-[#0B132B]/45 text-[10px] uppercase">Non-stop</div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="font-serif-display text-2xl text-[#0B132B]">{f.arrival_time}</div>
                        <div className="text-[#0B132B]/60 text-xs">{f.destination}</div>
                      </div>
                    </div>

                    <div className="md:col-span-2 text-[#0B132B]/55 text-xs">
                      <div>{f.aircraft}</div>
                      <div className="mt-1">T {f.terminal} • G {f.gate}</div>
                    </div>

                    <div className="md:col-span-3 flex flex-col items-end gap-2">
                      <div className="text-right">
                        <div className="font-serif-display text-3xl av-text-gold-grad">{fmtINR(f.price)}</div>
                        <div className="text-[#0B132B]/50 text-[11px]">per passenger</div>
                      </div>
                      <Link to={`/seats/${f.id}?passengers=${passengers}&cabin=${cabinClass}`}
                        data-testid={`select-${f.flight_number}`}
                        className="bg-amber-400 hover:bg-amber-300 text-[#0B132B] font-semibold px-5 py-2.5 rounded-full text-sm inline-flex items-center gap-2 transition">
                        Select <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>

                  {f.price_reasons?.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-[#E5E1D6] flex gap-2 flex-wrap text-xs">
                      <Info className="w-3.5 h-3.5 text-amber-700" />
                      {f.price_reasons.map((r, i) => (
                        <span key={i} className="text-[#0B132B]/60">
                          {r.label} <span className="text-amber-700">{r.factor}</span>
                          {i < f.price_reasons.length - 1 && " •"}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
