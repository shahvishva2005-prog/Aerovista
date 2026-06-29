import React, { useState } from 'react';
import FlightSearchWidget from './FlightSearchWidget';

export default function FlightSearchPage() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [metaInfo, setMetaInfo] = useState(null);

  const performSearchExecution = async (searchCriteria) => {
    setLoading(true);
    setResults([]);
    setMetaInfo(searchCriteria);

    try {
      // Fires target criteria structure direct up to render backend routing matrix
      const response = await fetch("https://aerovista.onrender.com/api/flights/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(searchCriteria)
      });
      const data = await response.json();
      setResults(data.flights || []);
    } catch (err) {
      console.error("API Fetch operational exception trace:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 text-slate-900">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">AeroVista Outbound Search Hub</h1>
          <p className="text-slate-500 text-xs">Real-time schedule indexing over cloud API paths</p>
        </div>

        {/* Embedded input search handler engine */}
        <FlightSearchWidget onSearchInitiated={performSearchExecution} />

        {/* Live Interface Display Logic */}
        <div className="mt-8">
          {loading && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-3"></div>
              <p className="text-sm font-medium text-slate-500">Querying live airline flight manifests...</p>
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-400 tracking-wider">AVAILABLE SCHEDULE MANIFESTS ({results.length})</h3>
              {results.map((flight) => (
                <div key={flight.id || flight.flight_number} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4 transition-all hover:border-slate-300">
                  <div>
                    <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">{flight.flight_number}</span>
                    <h4 className="text-lg font-bold text-slate-900 mt-2">{flight.origin} → {flight.destination}</h4>
                    <p className="text-xs text-slate-400 font-medium">{flight.aircraft} • Gate {flight.gate || 'TBD'}</p>
                  </div>
                  <div className="text-center md:text-right">
                    <span className="text-xs font-bold text-slate-400 block mb-1">ESTIMATED FARE</span>
                    <span className="text-xl font-black text-slate-900">₹{flight.base_price}</span>
                    <button className="block mt-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2 px-4 rounded transition-all">Select Fare</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && metaInfo && results.length === 0 && (
            <div className="bg-white border border-slate-200 rounded-xl text-center py-12 p-6 shadow-sm">
              <p className="text-sm text-slate-500 font-semibold">No operational flights mapped for the selected routes or dates.</p>
              <p className="text-xs text-slate-400 mt-1">Try modifying your search criteria or choosing general category options.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
