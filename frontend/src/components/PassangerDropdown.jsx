import React, { useState, useRef, useEffect } from "react";

export default function PassengerDropdown({ value = [], onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const passengersList = Array.isArray(value) ? value : [];

  const counts = {
    adult: passengersList.filter((p) => p.type === "adult" || !p.type).length || 1,
    senior: passengersList.filter((p) => p.type === "senior").length || 0,
    child: passengersList.filter((p) => p.type === "child").length || 0,
    infant: passengersList.filter((p) => p.type === "infant").length || 0,
  };

  const totalPassengers = counts.adult + counts.senior + counts.child + counts.infant;

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
      if (totalPassengers >= 9) return; 
      currentCounts[type] += 1;
    } else {
      if (type === "adult" && currentCounts[type] <= 1) return; 
      if (currentCounts[type] <= 0) return;
      currentCounts[type] -= 1;
    }

    const newPassengerArray = [];
    Object.keys(currentCounts).forEach((key) => {
      for (let i = 0; i < currentCounts[key]; i++) {
        newPassengerArray.push({
          first_name: "",
          last_name: "",
          type: key, 
          is_medical: false,
          is_armed_forces: false,
        });
      }
    });

    if (onChange) onChange(newPassengerArray);
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
        Travellers
      </label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-left bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 transition shadow-sm hover:border-white/20 flex justify-between items-center"
      >
        <div>
          <span className="text-white font-bold text-base">
            {totalPassengers} {totalPassengers === 1 ? "Traveller" : "Travellers"}
          </span>
          <div className="text-white/50 font-medium text-xs mt-0.5">
            {counts.adult} Ad{counts.senior > 0 && ` • ${counts.senior} Sr`}{counts.child > 0 && ` • ${counts.child} Ch`}{counts.infant > 0 && ` • ${counts.infant} Inf`}
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-white/40 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute left-0 z-50 mt-2 w-80 bg-[#0F1A3A] border border-white/10 rounded-xl shadow-2xl p-4 divide-y divide-white/5 text-white">
          {[
            { key: "adult", label: "Adult", desc: "12 years onwards" },
            { key: "senior", label: "Senior Citizen", desc: "> 60 years" },
            { key: "child", label: "Children", desc: "2 to 12 years" },
            { key: "infant", label: "Infant", desc: "3 days to 2 years" },
          ].map((row) => (
            <div key={row.key} className="flex items-center justify-between py-3.5 first:pt-1 last:pb-1">
              <div>
                <div className="text-white font-bold text-sm">{row.label}</div>
                <div className="text-white/40 text-xs font-medium">{row.desc}</div>
              </div>
              <div className="flex items-center space-x-3.5">
                <button
                  type="button"
                  onClick={() => updateCount(row.key, "dec")}
                  disabled={row.key === "adult" ? counts[row.key] <= 1 : counts[row.key] <= 0}
                  className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center text-white/80 hover:bg-white/5 font-bold transition disabled:opacity-25"
                >
                  —
                </button>
                <span className="text-amber-400 font-mono font-bold text-base w-4 text-center">
                  {counts[row.key]}
                </span>
                <button
                  type="button"
                  onClick={() => updateCount(row.key, "inc")}
                  disabled={totalPassengers >= 9}
                  className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center text-white/80 hover:bg-white/5 font-bold transition disabled:opacity-25"
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
              className="bg-amber-400 hover:bg-amber-300 text-[#0B132B] text-xs font-bold px-4 py-2 rounded-lg transition"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
