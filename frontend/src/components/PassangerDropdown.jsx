import React, { useState, useRef, useEffect } from "react";

export default function PassengerDropdown({ value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Initialize counts based on the incoming passenger array map layout
  const counts = {
    adult: value.filter((p) => p.type === "adult" || !p.type).length || 1,
    senior: value.filter((p) => p.type === "senior").length || 0,
    child: value.filter((p) => p.type === "child").length || 0,
    infant: value.filter((p) => p.type === "infant").length || 0,
  };

  const totalPassengers = counts.adult + counts.senior + counts.child + counts.infant;

  // Handle outside click to close the dropdown frame smoothly
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const updateCount = (type, operation) => {
    const currentCounts = { ...counts };
    
    if (operation === "inc") {
      if (totalPassengers >= 9) return; // Standard airline safety limit cap
      currentCounts[type] += 1;
    } else {
      if (type === "adult" && currentCounts[type] <= 1) return; // Enforce minimum 1 adult
      if (currentCounts[type] <= 0) return;
      currentCounts[type] -= 1;
    }

    // Convert flat numbers back into a structured array of passenger objects for backend routing
    const newPassengerArray = [];
    Object.keys(currentCounts).forEach((key) => {
      for (let i = 0; i < currentCounts[key]; i++) {
        newPassengerArray.push({
          first_name: "",
          last_name: "",
          type: key, // 'adult', 'senior', 'child', 'infant'
          is_medical: false,
          is_armed_forces: false,
        });
      }
    });

    onChange(newPassengerArray);
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
        Travellers
      </label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-left bg-white border border-[#CBD5E1] rounded-xl px-4 py-3.5 transition shadow-sm hover:border-[#94A3B8] flex justify-between items-center"
      >
        <div>
          <span className="text-[#0B132B] font-bold text-base">
            {totalPassengers} {totalPassengers === 1 ? "Traveller" : "Travellers"}
          </span>
          <div className="text-slate-500 font-medium text-xs mt-0.5">
            {counts.adult} Ad{counts.senior > 0 && ` • ${counts.senior} Sr`}{counts.child > 0 && ` • ${counts.child} Ch`}{counts.infant > 0 && ` • ${counts.infant} Inf`}
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-80 bg-white border border-[#CBD5E1] rounded-xl shadow-2xl p-4 divide-y divide-slate-100">
          {/* Passenger Type Row Generator Counter Layout */}
          {[
            { key: "adult", label: "Adult", desc: "12 years onwards" },
            { key: "senior", label: "Senior Citizen", desc: "> 60 years" },
            { key: "child", label: "Children", desc: "2 to 12 years" },
            { key: "infant", label: "Infant", desc: "3 days to 2 years" },
          ].map((row) => (
            <div key={row.key} className="flex items-center justify-between py-3.5 first:pt-1 last:pb-1">
              <div>
                <div className="text-[#0B132B] font-bold text-sm">{row.label}</div>
                <div className="text-slate-400 text-xs font-medium">{row.desc}</div>
              </div>
              <div className="flex items-center space-x-3.5">
                <button
                  type="button"
                  onClick={() => updateCount(row.key, "dec")}
                  disabled={row.key === "adult" ? counts[row.key] <= 1 : counts[row.key] <= 0}
                  className="w-8 h-8 rounded-full border border-[#CBD5E1] flex items-center justify-center text-slate-600 hover:bg-slate-50 font-bold transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  —
                </button>
                <span className="text-[#0B132B] font-mono font-bold text-base w-4 text-center">
                  {counts[row.key]}
                </span>
                <button
                  type="button"
                  onClick={() => updateCount(row.key, "inc")}
                  disabled={totalPassengers >= 9}
                  className="w-8 h-8 rounded-full border border-[#CBD5E1] flex items-center justify-center text-slate-600 hover:bg-slate-50 font-bold transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  +
                </button>
              </div>
            </div>
          ))}
          <div className="pt-3 text-right">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="bg-[#0B132B] hover:bg-[#1C2541] text-white text-xs font-bold px-4 py-2 rounded-lg transition"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
