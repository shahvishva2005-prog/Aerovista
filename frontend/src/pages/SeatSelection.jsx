import React, { useEffect, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { api, fmtINR } from "../lib/api";
import SeatMap from "../components/SeatMap";
import { Plane, Clock, ArrowRight } from "lucide-react";

export default function SeatSelection() {
  const { flightId } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const passengers = Number(params.get("passengers") || 1);
  const cabin = params.get("cabin") || "economy";
  const [flight, setFlight] = useState(null);
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    api.get(`/flights/${flightId}`).then((r) => setFlight(r.data));
  }, [flightId]);

  if (!flight) return <div className="pt-32 text-center text-[#0B132B]/72">Loading aircraft…</div>;

  const seatPrices = (flight.seat_map || []).filter((s) => selected.includes(s.seat))
    .reduce((acc, s) => acc + (s.extra_price || 0), 0);

  return (
    <div className="min-h-screen pt-24 pb-16 av-bg-booking" data-testid="seats-page">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="mb-8">
          <div className="text-amber-700 text-xs tracking-[0.3em] uppercase mb-3">Step 2 of 4 • Select Seats</div>
          <h2 className="font-serif-display text-4xl text-[#0B132B]">Choose your seats</h2>
          <p className="text-[#0B132B]/60 text-sm mt-2">{flight.origin} → {flight.destination} • {flight.flight_number} • {flight.aircraft}</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <SeatMap seatMap={flight.seat_map} selected={selected} maxSelect={passengers} onChange={setSelected} />
          </div>

          <aside className="glass-light rounded-2xl p-6 h-fit sticky top-28">
            <div className="text-amber-700 text-xs tracking-[0.3em] uppercase mb-3">Itinerary</div>
            <div className="flex items-center gap-3 mb-5">
              <Plane className="w-5 h-5 text-amber-700" />
              <div>
                <div className="text-[#0B132B] font-medium text-sm">{flight.origin_city} → {flight.destination_city}</div>
                <div className="text-[#0B132B]/55 text-xs">{flight.departure_date} • {flight.departure_time} - {flight.arrival_time}</div>
              </div>
            </div>
            <div className="space-y-2 text-sm border-t border-[#E5E1D6] pt-4">
              <Row k="Flight" v={flight.flight_number} />
              <Row k="Aircraft" v={flight.aircraft} />
              <Row k="Duration" v={flight.duration} />
              <Row k="Terminal" v={flight.terminal} />
              <Row k="Cabin" v={cabin.replace("_", " ").toUpperCase()} />
              <Row k="Passengers" v={passengers} />
              <Row k="Seats" v={selected.join(", ") || "—"} />
              <Row k="Seat Add-on" v={fmtINR(seatPrices)} />
            </div>
            <button data-testid="seats-continue"
              disabled={selected.length !== passengers}
              onClick={() => {
                const seatList = selected.join(",");
                nav(`/billing/${flightId}?passengers=${passengers}&cabin=${cabin}&seats=${seatList}`);
              }}
              className="w-full mt-6 bg-amber-400 hover:bg-amber-300 text-[#0B132B] font-semibold py-3 rounded-full inline-flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed">
              Continue to Billing <ArrowRight className="w-4 h-4" />
            </button>
            {selected.length !== passengers && (
              <div className="text-[#0B132B]/55 text-xs mt-3 text-center">
                Please select {passengers} seat(s) to continue.
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-[#0B132B]/60">{k}</span>
      <span className="text-[#0B132B] font-medium">{v}</span>
    </div>
  );
}
