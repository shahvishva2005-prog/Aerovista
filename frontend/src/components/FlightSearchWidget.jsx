import React, { useState } from "react";

const AIRPORT_COORDINATES = {
  DEL: { lat: 28.5562, lon: 77.1000 },
  BOM: { lat: 19.0896, lon: 72.8656 },
  BLR: { lat: 12.9556, lon: 77.6711 },
  GOI: { lat: 15.3800, lon: 73.8314 },
  DXB: { lat: 25.2528, lon: 55.3644 },
  LHR: { lat: 51.4700, lon: -0.4543 },
  SIN: { lat: 1.3644, lon: 103.9915 },
  JFK: { lat: 40.6413, lon: -73.7781 },
  BKK: { lat: 13.6900, lon: 100.7501 }
};

export default function FlightSearchWidget({ onSearch }) {
  const [tripType, setTripType] = useState("one-way");
  const [form, setForm] = useState({ origin: "", destination: "", date: "", returnDate: "" });
  const [liveDuration, setLiveDuration] = useState("");

  const getTodayDateString = () => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  };

  const calculateLiveDuration = (fromCode, toCode) => {
    const p1 = AIRPORT_COORDINATES[fromCode.toUpperCase().trim()];
    const p2 = AIRPORT_COORDINATES[toCode.toUpperCase().trim()];
    if (!p1 || !p2) { setLiveDuration(""); return; }
    const R = 6371;
    const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
    const dLon = ((p2.lon - p1.lon) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos((p1.lat * Math.PI) / 180) * Math.cos((p2.lat * Math.PI) / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    const totalMins = Math.round((distance / 800) * 60) + 20;
    setLiveDuration(`${Math.floor(totalMins / 60)}h ${totalMins % 60}m`);
  };

  const handleFieldChange = (field, val) => {
    const nextForm = { ...form, [field]: val };
    setForm(nextForm);
    if (field === "origin" || field === "destination") {
      calculateLiveDuration(nextForm.origin, nextForm.destination);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSearch) {
      onSearch({
        origin: form.origin.trim().toUpperCase(),
        destination: form.destination.trim().toUpperCase(),
        date: form.date,
        returnDate: tripType === "round-trip" ? form.returnDate : null
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* 🔄 Navigation Option Tabs matching your layout design */}
      <div className="flex gap-2">
        {["one-way", "round-trip", "multi-city"].map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setTripType(type)}
            className={`text-xs font-bold px-4 py-2 rounded-full transition-all tracking-wide capitalize ${
              tripType === type ? "bg-yellow-500 text-slate-950" : "bg-slate-800/60 text-slate-300 hover:bg-slate-800"
            }`}
          >
            {type.replace("-", " ")}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="bg-[#111c44] border border-slate-800 p-6 rounded-xl shadow-lg space-y-4">
        <div className={`grid grid-cols-1 gap-4 items-end ${tripType === "round-trip" ? "md:grid-cols-5" : "md:grid-cols-4"}`}>
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1.5 tracking-wider">DEPARTING FROM</label>
            <input
              type="text"
              placeholder="E.G. DEL"
              maxLength={3}
              required
              value={form.origin}
              onChange={(e) => handleFieldChange("origin", e.target.value)}
              className="w-full bg-[#0b0f19] border border-slate-700 rounded-lg p-2.5 text-sm font-bold text-white uppercase placeholder-slate-600 focus:outline-none focus:border-yellow-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1.5 tracking-wider">ARRIVING AT</label>
            <input
              type="text"
              placeholder="E.G. BOM"
              maxLength={3}
              required
              value={form.destination}
              onChange={(e) => handleFieldChange("destination", e.target.value)}
              className="w-full bg-[#0b0f19] border border-slate-700 rounded-lg p-2.5 text-sm font-bold text-white uppercase placeholder-slate-600 focus:outline-none focus:border-yellow-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1.5 tracking-wider">TRAVEL DATE</label>
            <input
              type="date"
              required
              min={getTodayDateString()}
              value={form.date}
              onChange={(e) => handleFieldChange("date", e.target.value)}
              className="w-full bg-[#0b0f19] border border-slate-700 rounded-lg p-2.5 text-sm font-medium text-white focus:outline-none focus:border-yellow-500 transition-all [color-scheme:dark] cursor-pointer"
            />
          </div>

          {tripType === "round-trip" && (
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5 tracking-wider">RETURN DATE</label>
              <input
                type="date"
                required
                min={form.date || getTodayDateString()}
                value={form.returnDate}
                onChange={(e) => handleFieldChange("returnDate", e.target.value)}
                className="w-full bg-[#0b0f19] border border-slate-700 rounded-lg p-2.5 text-sm font-medium text-white focus:outline-none focus:border-yellow-500 transition-all [color-scheme:dark] cursor-pointer"
              />
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-yellow-500 hover:bg-yellow-600 text-slate-950 font-black text-sm p-3 rounded-lg shadow-md tracking-wide transition-all"
          >
            SEARCH ROUTING
          </button>
        </div>

        {liveDuration && (
          <div className="text-right text-xs font-semibold text-slate-500 tracking-wide pt-1">
            ⏱️ Estimated Flight Duration: <span className="text-yellow-500 font-bold">{liveDuration}</span>
          </div>
        )}
      </form>
    </div>
  );
}
