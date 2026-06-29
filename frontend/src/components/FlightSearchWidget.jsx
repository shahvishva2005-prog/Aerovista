import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import AirportSelect from "./AirportSelect";
import { ArrowLeftRight, Calendar, Users, Search } from "lucide-react";

export default function FlightSearchWidget({ variant = "hero" }) {
  const nav = useNavigate();
  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
  const [tripType, setTripType] = useState("one_way");
  const [origin, setOrigin] = useState("DEL");
  const [destination, setDestination] = useState("BOM");
  const [departureDate, setDepartureDate] = useState(tomorrow);
  const [returnDate, setReturnDate] = useState("");
  const [passengers, setPassengers] = useState(1);
  const [cabinClass, setCabinClass] = useState("economy");

  const swap = () => { setOrigin(destination); setDestination(origin); };

  const search = () => {
    const q = new URLSearchParams({
      origin, destination, departure_date: departureDate,
      return_date: returnDate || "", trip_type: tripType,
      passengers: String(passengers), cabin_class: cabinClass,
    });
    nav(`/search?${q.toString()}`);
  };

  return (
    <div className={`glass rounded-2xl p-6 md:p-8 ${variant === "hero" ? "shadow-2xl" : ""}`}>
      <div className="flex flex-wrap gap-2 mb-6">
        {[
          { v: "one_way", label: "One Way" },
          { v: "round_trip", label: "Round Trip" },
          { v: "multi_city", label: "Multi City" },
        ].map((o) => (
          <button key={o.v} data-testid={`trip-${o.v}`}
            onClick={() => setTripType(o.v)}
            className={`px-5 py-2 rounded-full text-sm font-medium transition ${
              tripType === o.v ? "bg-amber-400 text-[#0B132B]" : "bg-[#0B132B]/5 text-[#0B132B]/80 hover:bg-[#0B132B]/10"}`}>
            {o.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
        <div className="md:col-span-3">
          <label className="text-[10px] tracking-[0.2em] uppercase text-amber-700/90 mb-2 block">From</label>
          <AirportSelect testId="from-airport" value={origin} onChange={setOrigin} placeholder="Origin" />
        </div>

        <div className="md:col-span-1 flex justify-center pb-3">
          <button onClick={swap} data-testid="swap-airports"
            className="w-10 h-10 rounded-full glass-light hover:av-bg-gold hover:text-[#0B132B] transition grid place-items-center">
            <ArrowLeftRight className="w-4 h-4" />
          </button>
        </div>

        <div className="md:col-span-3">
          <label className="text-[10px] tracking-[0.2em] uppercase text-amber-700/90 mb-2 block">To</label>
          <AirportSelect testId="to-airport" value={destination} onChange={setDestination} placeholder="Destination" />
        </div>

        <div className="md:col-span-2">
          <label className="text-[10px] tracking-[0.2em] uppercase text-amber-700/90 mb-2 block">Departure</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-700" />
            <input type="date" data-testid="departure-date" min={today}
              value={departureDate} onChange={(e) => setDepartureDate(e.target.value)}
              className="w-full bg-[#0B132B]/5 border border-[#E5E1D6] rounded-lg pl-9 pr-3 py-3.5 text-[#0B132B] text-sm" />
          </div>
        </div>

        <div className="md:col-span-2">
          <label className="text-[10px] tracking-[0.2em] uppercase text-amber-700/90 mb-2 block">Return</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-700" />
            <input type="date" data-testid="return-date"
              disabled={tripType === "one_way"} min={departureDate}
              value={returnDate} onChange={(e) => setReturnDate(e.target.value)}
              className="w-full bg-[#0B132B]/5 border border-[#E5E1D6] rounded-lg pl-9 pr-3 py-3.5 text-[#0B132B] text-sm disabled:opacity-40" />
          </div>
        </div>

        <div className="md:col-span-1">
          <label className="text-[10px] tracking-[0.2em] uppercase text-amber-700/90 mb-2 block">Pax</label>
          <div className="relative">
            <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-700" />
            <input type="number" min="1" max="9" data-testid="passengers"
              value={passengers} onChange={(e) => setPassengers(Math.max(1, +e.target.value))}
              className="w-full bg-[#0B132B]/5 border border-[#E5E1D6] rounded-lg pl-9 pr-2 py-3.5 text-[#0B132B] text-sm" />
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-2 flex-wrap">
          {["economy", "premium_economy", "business", "first"].map((c) => (
            <button key={c} data-testid={`class-${c}`}
              onClick={() => setCabinClass(c)}
              className={`text-xs px-3 py-1.5 rounded-full transition ${
                cabinClass === c ? "bg-amber-400/20 text-amber-600 border border-amber-500/50" : "text-[#0B132B]/65 hover:text-[#0B132B] border border-[#E5E1D6]"}`}>
              {c.replace("_", " ").toUpperCase()}
            </button>
          ))}
        </div>
        <button onClick={search} data-testid="search-flights-btn"
          className="bg-amber-400 hover:bg-amber-300 text-[#0B132B] font-semibold px-7 py-3.5 rounded-full inline-flex items-center gap-2 transition">
          <Search className="w-4 h-4" /> Search Flights
        </button>
      </div>
    </div>
  );
}
