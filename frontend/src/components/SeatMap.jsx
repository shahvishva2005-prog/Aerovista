import React, { useMemo } from "react";

// Generate a 30-row x 6-col aircraft seat map for visual selection.
// Props: seatMap (array from API), selected (array of seat IDs), maxSelect, onChange(seatList)
export default function SeatMap({ seatMap = [], selected = [], maxSelect = 1, onChange }) {
  const rows = useMemo(() => {
    const grouped = {};
    seatMap.forEach((s) => {
      grouped[s.row] = grouped[s.row] || {};
      grouped[s.row][s.col] = s;
    });
    return Object.keys(grouped).map((r) => ({ row: Number(r), seats: grouped[r] })).sort((a, b) => a.row - b.row);
  }, [seatMap]);

  const toggle = (seat) => {
    if (seat.state === "occupied") return;
    const id = seat.seat;
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else if (selected.length < maxSelect) {
      onChange([...selected, id]);
    } else {
      // replace oldest
      onChange([...selected.slice(1), id]);
    }
  };

  const cabinColor = (type) => {
    if (type === "first") return "ring-amber-400/60";
    if (type === "business") return "ring-purple-400/40";
    if (type === "premium_economy") return "ring-emerald-400/30";
    return "";
  };

  return (
    <div className="rounded-2xl bg-gradient-to-b from-[#0F1A3A] to-[#0B132B] p-6 border border-white/5">
      <div className="flex flex-wrap gap-4 mb-5 text-xs text-white/70">
        <Legend cls="seat-available" label="Available" />
        <Legend cls="seat-selected" label="Selected" />
        <Legend cls="seat-occupied" label="Occupied" />
        <Legend cls="seat-available ring-1 ring-amber-400/60" label="First" />
        <Legend cls="seat-available ring-1 ring-purple-400/40" label="Business" />
        <Legend cls="seat-available ring-1 ring-emerald-400/30" label="Premium Eco" />
      </div>

      <div className="mx-auto max-w-md">
        <div className="h-12 bg-gradient-to-b from-white/10 to-transparent rounded-t-[100%] border-x border-t border-white/10 grid place-items-center text-white/50 text-xs">
          ✈ COCKPIT
        </div>

        <div className="border-x border-white/10 p-4 bg-[#0B132B]/40">
          {rows.map(({ row, seats }) => (
            <div key={row} className="flex items-center justify-center gap-1.5 mb-1.5">
              <div className="w-6 text-right text-[10px] text-white/40 font-mono-aero">{row}</div>
              <div className="flex gap-1.5">
                {["A", "B", "C"].map((c) => seats[c] && (
                  <SeatCell key={c} seat={seats[c]} selected={selected.includes(seats[c].seat)}
                    onClick={() => toggle(seats[c])} cabinColor={cabinColor(seats[c].type)} />
                ))}
              </div>
              <div className="w-6 text-center text-[10px] text-white/30">▪</div>
              <div className="flex gap-1.5">
                {["D", "E", "F"].map((c) => seats[c] && (
                  <SeatCell key={c} seat={seats[c]} selected={selected.includes(seats[c].seat)}
                    onClick={() => toggle(seats[c])} cabinColor={cabinColor(seats[c].type)} />
                ))}
              </div>
              <div className="w-6"></div>
            </div>
          ))}
        </div>

        <div className="h-8 bg-gradient-to-t from-white/5 to-transparent rounded-b-2xl border-x border-b border-white/10" />
      </div>

      <div className="mt-5 text-center text-sm text-white/60">
        Selected: <span className="text-amber-400 font-semibold">{selected.join(", ") || "None"}</span>
      </div>
    </div>
  );
}

function SeatCell({ seat, selected, onClick, cabinColor }) {
  let cls = "seat ";
  if (seat.state === "occupied") cls += "seat-occupied";
  else if (selected) cls += "seat-selected";
  else cls += "seat-available";
  if (cabinColor) cls += " ring-1 " + cabinColor;

  return (
    <button type="button" onClick={onClick} className={cls} data-testid={`seat-${seat.seat}`}
      title={`${seat.seat} • ${seat.type} ${seat.extra_price ? `+₹${seat.extra_price}` : ""}`}>
      {seat.col}
    </button>
  );
}

function Legend({ cls, label }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`${cls} w-4 h-4 inline-block rounded`} />
      <span>{label}</span>
    </div>
  );
}
