import React, { useState } from "react";

export default function FlightSearchWidget({ onSearch }) {
  const [form, setForm] = useState({ origin: "", destination: "", date: "" });

  // Dynamically calculate today's date in YYYY-MM-DD format based on local time
  const getTodayDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSearch) {
      onSearch({
        origin: form.origin.trim().toUpperCase(),
        destination: form.destination.trim().toUpperCase(),
        date: form.date
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-[#111c44] border border-slate-800 p-6 rounded-xl shadow-lg grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
      <div>
        <label className="block text-xs font-bold text-slate-400 mb-1.5 tracking-wider">DEPARTING FROM</label>
        <input
          type="text"
          placeholder="e.g. DEL"
          maxLength={3}
          required
          value={form.origin}
          onChange={(e) => setForm({ ...form, origin: e.target.value })}
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
          onChange={(e) => setForm({ ...form, destination: e.target.value })}
          className="w-full bg-[#0b0f19] border border-slate-700 rounded-lg p-2.5 text-sm font-bold text-white uppercase placeholder-slate-600 focus:outline-none focus:border-yellow-500 transition-all"
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-400 mb-1.5 tracking-wider">TRAVEL DATE</label>
        <input
          type="date"
          required
          min={getTodayDateString()} // Restricts user selection to today or future dates only
          value={form.date}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
          className="w-full bg-[#0b0f19] border border-slate-700 rounded-lg p-2.5 text-sm font-medium text-white focus:outline-none focus:border-yellow-500 transition-all [color-scheme:dark]"
        />
      </div>

      <button
        type="submit"
        className="w-full bg-yellow-500 hover:bg-yellow-600 text-slate-950 font-black text-sm p-3 rounded-lg shadow-md tracking-wide transition-all"
      >
        SEARCH ROUTING
      </button>
    </form>
  );
}
