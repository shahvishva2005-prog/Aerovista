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
  const [cabinClass, setCabinClass] = useState("economy");
  const [form, setForm] = useState({ origin: "", destination: "", date: "", returnDate: "", passengers: 1 });
  const [showOriginDropdown, setShowOriginDropdown] = useState(false);
  const [showDestDropdown, setShowDestDropdown] = useState(false);
  const [liveDuration, setLiveDuration] = useState("");

  const getTodayDateString = () => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  };

  const calculateDuration = (from, to) => {
    const p1 = AIRPORT_COORDINATES[from.toUpperCase()];
    const p2 = AIRPORT_COORDINATES[to.toUpperCase()];
    if (!p1 || !p2) return "";
    const R = 6371;
    const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
    const dLon = ((p2.lon - p1.lon) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos((p1.lat * Math.PI) / 180) * Math.cos((p2.lat * Math.PI) / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const totalMins = Math.round(((R * c) / 800) * 60) + 20;
    return `${Math.floor(totalMins / 60)}h ${totalMins % 60}m`;
  };

  const handleSelectAirport = (field, code) => {
    const updatedForm = { ...form, [field]: code };
    setForm(updatedForm);
    setShowOriginDropdown(false);
    setShowDestDropdown(false);
    if (updatedForm.origin && updatedForm.destination) {
      setLiveDuration(calculateDuration(updatedForm.origin, updatedForm.destination));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSearch) {
      onSearch({
        origin: form.origin,
        destination: form.destination,
        date: form.date,
        returnDate: tripType === "round-trip" ? form.returnDate : null,
        tripType,
        cabinClass,
        passengers: form.passengers,
        duration: liveDuration
      });
    }
  };

  return (
    <div className="bg-[#0f1631] border border-slate-800/80 p-6 rounded-2xl shadow-xl space-y-6">
      {/* Trip Mode Buttons */}
      <div className="flex gap-2">
        {["one-way", "round-trip", "multi-city"].map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setTripType(mode)}
            className={`text-xs font-bold px-5 py-2.5 rounded-full uppercase tracking-wider transition-all ${
              tripType === mode ? "bg-yellow-500 text-slate-950 shadow-md" : "bg-slate-800/50 text-slate-300 hover:bg-slate-800"
            }`}
          >
            {mode.replace("-", " ")}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          {/* FROM INPUT */}
          <div className="md:col-span-3 relative">
            <label className="block text-[11px] font-bold text-slate-400 tracking-wider mb-2 uppercase">FROM</label>
            <div className="bg-[#1a234a] border border-slate-700/60 rounded-xl p-3 cursor-pointer hover:border-slate-500 transition-all" onClick={() => setShowOriginDropdown(!showOriginDropdown)}>
              <div className="text-sm font-bold text-white">{form.origin ? `${form.origin} Airport` : "Select Departure"}</div>
              <div className="text-xs text-slate-400">{form.origin || "e.g. Delhi (DEL)"}</div>
            </div>
            {showOriginDropdown && (
              <div className="absolute z-50 w-full mt-2 bg-[#111c44] border border-slate-700 rounded-xl shadow-2xl max-h-48 overflow-y-auto">
                {Object.keys(AIRPORT_COORDINATES).map(code => (
                  <div key={code} onClick={() => handleSelectAirport("origin", code)} className="p-3 text-sm text-slate-200 font-semibold hover:bg-indigo-900/40 cursor-pointer transition-all border-b border-slate-800/50 last:border-0">{code} Terminal Hub</div>
                ))}
              </div>
            )}
          </div>

          {/* SWAP ICON PLACEMENT */}
          <div className="hidden md:flex md:col-span-1 justify-center items-center pb-3">
            <div className="bg-[#1a234a] border border-slate-700 p-2 rounded-full cursor-pointer text-yellow-500 hover:bg-slate-800 transition-all">➔</div>
          </div>

          {/* TO INPUT */}
          <div className="md:col-span-3 relative">
            <label className="block text-[11px] font-bold text-slate-400 tracking-wider mb-2 uppercase">TO</label>
            <div className="bg-[#1a234a] border border-slate-700/60 rounded-xl p-3 cursor-pointer hover:border-slate-500 transition-all" onClick={() => setShowDestDropdown(!showDestDropdown)}>
              <div className="text-sm font-bold text-white">{form.destination ? `${form.destination} Airport` : "Select Destination"}</div>
              <div className="text-xs text-slate-400">{form.destination || "e.g. Goa (GOI)"}</div>
            </div>
            {showDestDropdown && (
              <div className="absolute z-50 w-full mt-2 bg-[#111c44] border border-slate-700 rounded-xl shadow-2xl max-h-48 overflow-y-auto">
                {Object.keys(AIRPORT_COORDINATES).map(code => (
                  <div key={code} onClick={() => handleSelectAirport("destination", code)} className="p-3 text-sm text-slate-200 font-semibold hover:bg-indigo-900/40 cursor-pointer transition-all border-b border-slate-800/50 last:border-0">{code} Destination</div>
                ))}
              </div>
            )}
          </div>

          {/* DEPARTURE DATE */}
          <div className="md:col-span-2">
            <label className="block text-[11px] font-bold text-slate-400 tracking-wider mb-2 uppercase">DEPARTURE</label>
            <input
              type="date"
              required
              min={getTodayDateString()}
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="w-full bg-[#1a234a] border border-slate-700/60 rounded-xl p-3 text-sm font-bold text-white focus:outline-none focus:border-yellow-500 transition-all [color-scheme:dark] cursor-pointer"
            />
          </div>

          {/* RETURN DATE FIELD */}
          <div className="md:col-span-2">
            <label className="block text-[11px] font-bold text-slate-400 tracking-wider mb-2 uppercase">RETURN</label>
            <input
              type="date"
              disabled={tripType === "one-way"}
              min={form.date || getTodayDateString()}
              value={form.returnDate}
              onChange={(e) => setForm({ ...form, returnDate: e.target.value })}
              className="w-full bg-[#1a234a] border border-slate-700/60 rounded-xl p-3 text-sm font-bold text-white focus:outline-none focus:border-yellow-500 disabled:opacity-30 transition-all [color-scheme:dark] cursor-pointer"
            />
          </div>

          {/* PAX CONFIGURATOR */}
          <div className="md:col-span-1">
            <label className="block text-[11px] font-bold text-slate-400 tracking-wider mb-2 uppercase">PAX</label>
            <input
              type="number"
              min={1}
              max={9}
              value={form.passengers}
              onChange={(e) => setForm({ ...form, passengers: parseInt(e.target.value) || 1 })}
              className="w-full bg-[#1a234a] border border-slate-700/60 rounded-xl p-3 text-sm font-bold text-white text-center focus:outline-none focus:border-yellow-500 transition-all"
            />
          </div>
        </div>

        {/* CABIN CLASS SELECTORS & EXECUTE BUTTON */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-2 border-t border-slate-800/60">
          <div className="flex gap-2">
            {["economy", "premium economy", "business", "first"].map((cls) => (
              <button
                key={cls}
                type="button"
                onClick={() => setCabinClass(cls)}
                className={`text-[10px] font-bold px-4 py-2 rounded-lg uppercase tracking-wider transition-all ${
                  cabinClass === cls ? "bg-yellow-500/10 border border-yellow-500/40 text-yellow-500" : "bg-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                {cls}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4 w-full sm:w-auto">
            {liveDuration && (
              <div className="text-xs font-semibold text-slate-400 tracking-wide bg-[#1a234a]/60 px-3 py-1.5 rounded-lg border border-slate-800">
                ⏱️ Est. Duration: <span className="text-yellow-500 font-bold">{liveDuration}</span>
              </div>
            )}
            <button type="submit" className="w-full sm:w-auto bg-yellow-500 hover:bg-yellow-600 text-slate-950 font-black text-xs px-8 py-4 rounded-xl tracking-widest uppercase transition-all shadow-lg flex items-center justify-center gap-2">
              🔍 Search Flights
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
