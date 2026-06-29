import React, { useState } from "react";

// In-memory airport coordinate catalog for real-time distance & duration calculations
const AIRPORT_COORDINATES = {
  DEL: { lat: 28.5562, lon: 77.1000, name: "Delhi" },
  BOM: { lat: 19.0896, lon: 72.8656, name: "Mumbai" },
  BLR: { lat: 12.9556, lon: 77.6711, name: "Bengaluru" },
  GOI: { lat: 15.3800, lon: 73.8314, name: "Goa" },
  DXB: { lat: 25.2528, lon: 55.3644, name: "Dubai" },
  LHR: { lat: 51.4700, lon: -0.4543, name: "London" },
  SIN: { lat: 1.3644, lon: 103.9915, name: "Singapore" },
  JFK: { lat: 40.6413, lon: -73.7781, name: "New York" },
  BKK: { lat: 13.6900, lon: 100.7501, name: "Bangkok" }
};

export default function FlightSearchWidget({ onSearch }) {
  const [tripType, setTripType] = useState("one-way");
  const [form, setForm] = useState({ origin: "", destination: "", date: "", returnDate: "" });
  const [liveMetrics, setLiveMetrics] = useState(null);

  const getTodayDateString = () => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  };

  // Live client-side calculation using the Haversine geometric formula
  const computeLiveFlightMetrics = (fromCode, toCode) => {
    const loc1 = AIRPORT_COORDINATES[fromCode.toUpperCase().trim()];
    const loc2 = AIRPORT_COORDINATES[toCode.toUpperCase().trim()];

    if (!loc1 || !loc2) {
      setLiveMetrics(null);
      return;
    }

    const R = 6371; // Earth's radius in KM
    const dLat = ((loc2.lat - loc1.lat) * Math.PI) / 180;
    const dLon = ((loc2.lon - loc1.lon) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((loc1.lat * Math.PI) / 180) *
        Math.cos((loc2.lat * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceKm = R * c;

    // Estimate commercial flight duration assuming 800 km/h average speed + 20 mins runway taxi overhead
    const totalMinutes = Math.round((distanceKm / 800) * 60) + 20;
    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;

    setLiveMetrics({
      distance: Math.round(distanceKm),
      duration: `${hrs}h ${mins}m`
    });
  };

  const handleInputChange = (field, value) => {
    const updatedForm = { ...form, [field]: value };
    setForm(updatedForm);

    if (field === "origin" || field === "destination") {
      computeLiveFlightMetrics(updatedForm.origin, updatedForm.destination);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSearch) {
      onSearch({
        tripType,
        origin: form.origin.trim().toUpperCase(),
        destination: form.destination.trim().toUpperCase(),
        date: form.date,
        returnDate: tripType === "round-trip" ? form.returnDate : null,
        estimatedDuration: liveMetrics ? liveMetrics.duration : null
      });
    }
  };

  return (
    <div className="space-y-3">
      {/* 🔄 One-Way / Round-Trip Navigation Tabs */}
      <div className="flex gap-4 border-b border-slate-800 pb-2 pl-1">
        {["one-way", "round-trip"].map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setTripType(type)}
            className={`text-xs uppercase font-bold tracking-widest pb-1 transition-all ${
              tripType === type
                ? "text-yellow-500 border-b-2 border-yellow-500"
                : "text-slate-400 hover:text-slate-200"
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
              placeholder="e.g. DEL"
              maxLength={3}
              required
              value={form.origin}
              onChange={(e) => handleInputChange("origin", e.target.value)}
              className="w-full bg-[#0b0f19] border border-slate-700 rounded-lg p-2.5 text-sm font-bold text-white uppercase placeholder-slate-600 focus:outline-none focus:border-yellow-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1.5 tracking-wider">ARRIVING AT</label>
            <input
              type="text"
              placeholder="e.g. BOM"
              maxLength={3}
              required
              value={form.destination}
              onChange={(e) => handleInputChange("destination", e.target.value)}
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
              onChange={(e) => handleInputChange("date", e.target.value)}
              className="w-full bg-[#0b0f19] border border-slate-700 rounded-lg p-2.5 text-sm font-medium text-white focus:outline-none focus:border-yellow-500 transition-all [color-scheme:dark] cursor-pointer"
              style={{ contentVisibility: "auto" }}
            />
          </div>

          {/* 📅 Conditional Return Date Input box slot */}
          {tripType === "round-trip" && (
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5 tracking-wider">RETURN DATE</label>
              <input
                type="date"
                required
                min={form.date || getTodayDateString()}
                value={form.returnDate}
                onChange={(e) => handleInputChange("returnDate", e.target.value)}
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

        {/* ✈️ Real-time Flight Path Duration Metadata Display box */}
        {liveMetrics && (
          <div className="bg-[#0b0f19]/60 border border-slate-800/80 px-4 py-2 rounded-lg flex items-center justify-between text-xs text-slate-400 animate-fadeIn">
            <span className="flex items-center gap-1.5">
              📍 Mapped Route: <strong className="text-slate-200">{form.origin.toUpperCase()}</strong> to <strong className="text-slate-200">{form.destination.toUpperCase()}</strong>
            </span>
            <div className="flex gap-4">
              <span>Great-Circle Distance: <strong className="text-yellow-500">{liveMetrics.distance} KM</strong></span>
              <span>Est. Flight Duration: <strong className="text-yellow-500">{liveMetrics.duration}</strong></span>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
