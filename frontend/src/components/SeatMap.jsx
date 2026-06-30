import React, { useMemo } from "react";

// Generate a 30-row x 6-col aircraft seat map with clear, thick color borders.
export default function SeatMap({ seatMap = [], selected = [], maxSelect = 1, onChange }) {
  const rows = useMemo(() => {
    const grouped = {};
    seatMap.forEach((s) => {
      grouped[s.row] = grouped[s.row] || {};
      grouped[s.row][s.col] = s;
    });
    return Object.keys(grouped)
      .map((r) => ({ row: Number(r), seats: grouped[r] }))
      .sort((a, b) => a.row - b.row);
  }, [seatMap]);

  const toggle = (seat) => {
    if (seat.state === "occupied") return;
    const id = seat.seat;
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else if (selected.length < maxSelect) {
      onChange([...selected, id]);
    } else {
      onChange([...selected.slice(1), id]); // Replace oldest selection
    }
  };

  return (
    <div className="rounded-2xl bg-gradient-to-b from-[#0F1A3A] to-[#0B132B] p-6 border border-white/5 shadow-2xl">
      {/* Legend with matching border badges */}
      <div className="flex flex-wrap gap-4 mb-6 text-xs text-white/70 bg-[#0B132B]/50 p-4 rounded-xl border border-white/5">
        <Legend cls="bg-slate-700 border border-slate-600" label="Available" />
        <Legend cls="bg-amber-400 border border-amber-300" label="Selected" />
        <Legend cls="bg-white/10 border border-white/5 opacity-40 line-through" label="Occupied" />
        <Legend cls="bg-transparent border-2 border-blue-500" label="First (Blue)" />
        <Legend cls="bg-transparent border-2 border-green-500" label="Business (Green)" />
        <Legend cls="bg-transparent border-2 border-orange-500" label="Premium Eco (Orange)" />
        <Legend cls="bg-transparent border-2 border-pink-500" label="Economy (Pink)" />
      </div>

      <div className="mx-auto max-w-md">
        <div className="h-12 bg-gradient-to-b from-white/10 to-transparent rounded-t-[100%] border-x border-t border-white/10 grid place-items-center text-white/50 text-xs font-semibold tracking-widest">
          ✈ COCKPIT
        </div>

        <div className="border-x border-white/10 p-4 bg-[#0B132B]/40 max-h-[600px] overflow-y-auto av-scrollbar">
          {rows.map(({ row, seats }) => (
            <div key={row} className="flex items-center justify-center gap-1.5 mb-2">
              <div className="w-6 text-right text-[10px] text-white/40 font-mono font-bold mr-1">{row}</div>
              
              {/* Left Side: A, B, C */}
              <div className="flex gap-2">
                {["A", "B", "C"].map((c) => seats[c] && (
                  <SeatCell 
                    key={c} 
                    seat={seats[c]} 
                    selected={selected.includes(seats[c].seat)}
                    onClick={() => toggle(seats[c])} 
                  />
                ))}
              </div>
              
              {/* Aisle Indicator */}
              <div className="w-6 text-center text-[10px] text-white/20 font-bold">▪</div>
              
              {/* Right Side: D, E, F */}
              <div className="flex gap-2">
                {["D", "E", "F"].map((c) => seats[c] && (
                  <SeatCell 
                    key={c} 
                    seat={seats[c]} 
                    selected={selected.includes(seats[c].seat)}
                    onClick={() => toggle(seats[c])} 
                  />
                ))}
              </div>
              <div className="w-4"></div>
            </div>
          ))}
        </div>

        <div className="h-8 bg-gradient-to-t from-white/5 to-transparent rounded-b-2xl border-x border-b border-white/10" />
      </div>

      <div className="mt-5 text-center text-sm text-white/60">
        Selected: <span className="text-amber-400 font-bold tracking-wide">{selected.join(", ") || "None"}</span>
      </div>
    </div>
  );
}

function SeatCell({ seat, selected, onClick }) {
  const isOccupied = seat.state === "occupied";
  
  // Dynamic Thick Border Mapping Dictionary
  const classBorders = {
    first: "border-blue-500 text-blue-400 hover:bg-blue-500/10",
    business: "border-green-500 text-green-400 hover:bg-green-500/10",
    premium_economy: "border-orange-500 text-orange-400 hover:bg-orange-500/10",
    economy: "border-pink-500 text-pink-400 hover:bg-pink-500/10"
  };

  // Base setup styles
  let cls = "w-8 h-8 rounded-lg text-xs font-bold transition-all flex items-center justify-center border-2 shadow-sm focus:outline-none ";

  if (isOccupied) {
    cls += "bg-white/5 border-white/10 text-white/20 cursor-not-allowed opacity-30 line-through";
  } else if (selected) {
    cls += "bg-amber-400 border-amber-300 text-[#0B132B] scale-95 shadow-inner shadow-black/20";
  } else {
    cls += `bg-transparent ${classBorders[seat.type] || "border-slate-500 text-slate-300"}`;
  }

  return (
    <button 
      type="button" 
      onClick={onClick} 
      disabled={isOccupied}
      className={cls} 
      data-testid={`seat-${seat.seat}`}
      title={`${seat.seat} • ${seat.type.replace("_", " ")} ${seat.extra_price ? `+₹${seat.extra_price}` : ""}`}
    >
      {seat.col}
    </button>
  );
}

function Legend({ cls, label }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`${cls} w-4 h-4 inline-block rounded font-bold`} />
      <span className="font-medium">{label}</span>
    </div>
  );
}
