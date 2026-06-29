import React, { useState } from "react";
import FlightSearchWidget from "../components/FlightSearchWidget";
import { api, fmtINR } from "../lib/api";
import { Plane, Clock, Calendar } from "lucide-react";

export default function FlightSearchPage() {
  const [flights, setFlights] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [routeLabel, setRouteLabel] = useState("");

  const handleSearchExecution = async (criteria) => {
    setLoading(true);
    setSearched(true);
    setRouteLabel(`${criteria.origin} ➔ ${criteria.destination}`);
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
    <div className="min-h-screen bg-[#0b0f19] text-white py-10 px-4 flex flex-col justify-between">
      <div className="max-w-7xl mx-auto w-full space-y-8 flex-grow">
        
        {/* Render Form Widget */}
        <FlightSearchWidget onSearch={handleSearchExecution} />

        {/* Split Filtering/Results Column */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start pt-2">
          
          {/* Left Filter Sidebar */}
          <div className="bg-[#111c44] border border-slate-800 p-5 rounded-2xl space-y-6 shadow-xl">
            <h3 className="text-xs font-black text-yellow-500 tracking-widest uppercase border-b border-slate-800 pb-2">FILTERS</h3>
            <div className="space-y-2.5">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">Sort By</label>
              {["Price (Low to High)", "Duration", "Departure Time"].map((f, i) => (
                <label key={f} className="flex items-center gap-2.5 text-sm text-slate-300 cursor-pointer font-medium hover:text-white transition-all">
                  <input type="radio" name="sort" defaultChecked={i===0} className="text-yellow-500 focus:ring-0 bg-[#0b0f19] border-slate-700" /> {f}
                </label>
              ))}
            </div>
            <div className="space-y-2.5 border-t border-slate-800/80 pt-4">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">Stops</label>
              {["Any", "Non-stop", "1 Stop"].map((f, i) => (
                <label key={f} className="flex items-center gap-2.5 text-sm text-slate-300 cursor-pointer font-medium hover:text-white transition-all">
                  <input type="radio" name="stops" defaultChecked={i===0} className="text-yellow-500 focus:ring-0 bg-[#0b0f19] border-slate-700" /> {f}
                </label>
              ))}
            </div>
          </div>

          {/* Right Results Grid Panel Column */}
          <div className="md:col-span-3 space-y-4 min-h-[450px]">
            {loading && (
              <div className="text-center py-20 bg-[#111c44]/30 border border-slate-800 rounded-2xl">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-yellow-500 mx-auto mb-4"></div>
                <p className="text-slate-400 text-sm font-semibold">Scanning real-time carrier flight schedules...</p>
              </div>
            )}

            {!loading && !searched && (
              <div className="bg-[#111c44]/20 border border-dashed border-slate-800/80 rounded-2xl p-12 text-center py-24 flex flex-col justify-center items-center">
                <p className="font-bold text-slate-400 text-base mb-1">Ready for Search</p>
                <p className="text-xs text-slate-500 max-w-sm">Specify your departure codes and calendar dates to initialize live flight tracking.</p>
              </div>
            )}

            {!loading && flights.length > 0 && (
              <div className="space-y-4 animate-fadeIn">
                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <h2 className="text-2xl font-black tracking-tight text-slate-200">{routeLabel}</h2>
                  <span className="text-xs font-bold text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 px-2.5 py-1 rounded-md">{flights.length} flights tracked</span>
                </div>

                {flights.map((flight) => (
                  <div key={flight.id} className="bg-[#111c44] border border-slate-800/70 rounded-2xl p-6 flex flex-col md:flex-row justify-between items-center gap-4 transition-all hover:border-yellow-500/20 shadow-lg">
                    <div className="flex items-center gap-4 w-full md:w-auto">
                      <div className="bg-yellow-500/10 p-3.5 rounded-xl text-yellow-500 hidden sm:block"><Plane className="w-5 h-5 -rotate-45" /></div>
                      <div className="w-full">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-yellow-500 tracking-wide">{flight.flight_number}</span>
                          <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded uppercase font-bold tracking-wider">{flight.aircraft}</span>
                        </div>
                        <h4 className="text-xl font-black text-white mt-1">{flight.origin} ➔ {flight.destination}</h4>
                        <div className="flex gap-5 text-xs text-slate-400 mt-2 font-medium">
                          <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-slate-500" /> {flight.departure_time} - {flight.arrival_time}</span>
                          <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-slate-500" /> Term {flight.terminal || "3"} • Gate {flight.gate || "A1"}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-center md:text-right border-t md:border-t-0 pt-4 md:pt-0 border-slate-800/80 flex md:flex-col justify-between md:justify-center items-center md:items-end gap-2 w-full md:w-auto">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block tracking-widest uppercase">Per Passenger</span>
                        <span className="text-2xl font-black text-white tracking-tight">{fmtINR(flight.base_price)}</span>
                      </div>
                      <button className="bg-yellow-500 hover:bg-yellow-600 text-slate-950 font-black text-xs px-5 py-3 rounded-xl tracking-wider uppercase transition-all shadow-md">Select ➔</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!loading && searched && flights.length === 0 && (
              <div className="bg-[#111c44] border border-slate-800 rounded-2xl p-16 text-center text-slate-400 shadow-xl flex flex-col justify-center items-center">
                <div className="text-yellow-500/80 mb-4"><Plane className="w-10 h-10" /></div>
                <p className="font-bold text-white text-lg mb-1">No flights found for this route on selected date.</p>
                <p className="text-xs text-slate-500 max-w-sm">Try alternate dates, cross-check code inputs, or clear filter tags.</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
