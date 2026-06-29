import React, { useState } from "react";
import FlightSearchWidget from "../components/FlightSearchWidget";
import { api, fmtINR } from "../lib/api";
import { Plane, Clock, Calendar } from "lucide-react";

export default function FlightSearchPage() {
  const [flights, setFlights] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [currentRouteLabel, setCurrentRouteLabel] = useState("");

  const handleSearch = async (criteria) => {
    setLoading(true);
    setSearched(true);
    setCurrentRouteLabel(`${criteria.origin} ➔ ${criteria.destination}`);
    
    try {
      const res = await api.get("/flights/search", { params: criteria });
      setFlights(res.data);
    } catch (err) {
      console.error(err);
      setFlights([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-white py-12 px-4 flex flex-col justify-between">
      <div className="max-w-6xl mx-auto w-full space-y-8 flex-grow mb-12">
        
        <FlightSearchWidget onSearch={handleSearch} />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start pt-4">
          
          {/* Sidebar Section */}
          <div className="bg-[#111c44] border border-slate-800 p-5 rounded-xl space-y-6">
            <h3 className="text-xs font-bold text-yellow-500 tracking-wider uppercase">FILTERS</h3>
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-400">Sort By</label>
              {["Price (Low to High)", "Duration", "Departure Time"].map((f, i) => (
                <label key={f} className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                  <input type="radio" name="sort" defaultChecked={i===0} className="text-yellow-500 focus:ring-0 bg-[#0b0f19]" /> {f}
                </label>
              ))}
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-400">Stops</label>
              {["Any", "Non-stop", "1 Stop"].map((f, i) => (
                <label key={f} className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                  <input type="radio" name="stops" defaultChecked={i===0} className="text-yellow-500 focus:ring-0 bg-[#0b0f19]" /> {f}
                </label>
              ))}
            </div>
          </div>

          {/* Results Main Section Panel Grid Area */}
          <div className="md:col-span-3 space-y-4 min-h-[400px]">
            {loading && (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-yellow-500 mx-auto mb-4"></div>
                <p className="text-slate-400 text-sm">Querying active flight rosters...</p>
              </div>
            )}

            {!loading && !searched && (
              <div className="bg-[#111c44]/40 border border-dashed border-slate-800 rounded-xl p-12 text-center py-24">
                <p className="font-semibold text-slate-400 mb-1">Ready for Search</p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">Enter your departures and destinations to render the daily flight matrices.</p>
              </div>
            )}

            {!loading && flights.length > 0 && (
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <h2 className="text-xl font-bold tracking-tight uppercase font-black text-slate-200">{currentRouteLabel}</h2>
                  <span className="text-xs font-bold text-yellow-500">{flights.length} flights tracked</span>
                </div>

                {flights.map((flight) => (
                  <div key={flight.id} className="bg-[#111c44] border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row justify-between items-center gap-4 transition-all hover:border-yellow-500/30">
                    <div className="flex items-center gap-4">
                      <div className="bg-yellow-500/10 p-3 rounded-lg text-yellow-500"><Plane className="w-5 h-5 -rotate-45" /></div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-yellow-500">{flight.flight_number}</span>
                          <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded uppercase font-semibold">{flight.aircraft}</span>
                        </div>
                        <h4 className="text-base font-bold mt-1">{flight.origin} ➔ {flight.destination}</h4>
                        <div className="flex gap-4 text-xs text-slate-400 mt-1">
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {flight.departure_time} - {flight.arrival_time}</span>
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Term {flight.terminal || "3"} • Gate {flight.gate || "A1"}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-center md:text-right border-t md:border-t-0 pt-3 md:pt-0 border-slate-800 flex md:flex-col justify-between md:justify-center items-center md:items-end gap-1 w-full md:w-auto">
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 block tracking-wider uppercase">Per Passenger</span>
                        <span className="text-xl font-black text-white">{fmtINR(flight.base_price)}</span>
                      </div>
                      <button className="bg-yellow-500 hover:bg-yellow-600 text-slate-950 font-bold text-xs px-4 py-2 rounded-md transition-all shadow-sm">Select ➔</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!loading && searched && flights.length === 0 && (
              <div className="bg-[#111c44] border border-slate-800 rounded-xl p-12 text-center text-slate-400">
                <div className="text-yellow-500 mb-3"><Plane className="w-8 h-8" /></div>
                <p className="font-semibold text-white mb-1">No flights found for this route on selected date.</p>
                <p className="text-xs text-slate-500">Try different dates, alternate airport segments, or expand filter tags.</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
