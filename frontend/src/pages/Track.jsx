import React, { useEffect, useState } from "react";
import { api, fmtDate } from "../lib/api";
import PageShell from "../components/PageShell";
import { Plane, Search } from "lucide-react";

function FlightCountdown({ departureIso }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const dep = new Date(departureIso);
  const diff = dep - now;
  if (diff <= 0) {
    return <span className="text-emerald-700 font-medium">Departed / In progress</span>;
  }
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return (
    <span className="font-mono-aero text-amber-700" data-testid="flight-countdown">
      {d > 0 && `${d}d `}{String(h).padStart(2, "0")}h {String(m).padStart(2, "0")}m {String(s).padStart(2, "0")}s
    </span>
  );
}

export default function Track() {
  const [tab, setTab] = useState("pnr");
  const [pnr, setPnr] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    setBusy(true); setErr(""); setResults([]);
    try {
      const r = await api.post("/track", {
        pnr: tab === "pnr" ? pnr : "",
        email: tab === "email" ? email : "",
        mobile: tab === "mobile" ? mobile : "",
      });
      setResults(r.data);
      if (r.data.length === 0) setErr("No bookings found.");
    } catch (e) {
      setErr(e?.response?.data?.detail || "Search failed");
    } finally { setBusy(false); }
  };

  return (
    <PageShell title="Track Flight" subtitle="Real-time booking status and flight updates." testId="track-page"
      bgUrl="https://images.unsplash.com/photo-1542296332-2e4473faf563?w=1920&q=85">
      <div className="max-w-3xl mx-auto">
        <div className="glass-light rounded-2xl p-6">
          <div className="flex gap-2 mb-5">
            {[["pnr", "By PNR"], ["email", "By Email"], ["mobile", "By Mobile"]].map(([v, l]) => (
              <button key={v} onClick={() => setTab(v)} data-testid={`track-tab-${v}`}
                className={`px-4 py-2 rounded-full text-sm transition ${tab === v ? "bg-amber-400 text-[#0B132B]" : "bg-[#0B132B]/5 text-[#0B132B]/72 hover:bg-[#0B132B]/10"}`}>{l}</button>
            ))}
          </div>
          <div className="grid md:grid-cols-12 gap-3">
            <div className="md:col-span-9">
              {tab === "pnr" && <Input placeholder="Enter PNR (e.g., AV3X9Y2)" value={pnr} onChange={setPnr} testId="track-pnr" />}
              {tab === "email" && <Input placeholder="Enter registered email" value={email} onChange={setEmail} testId="track-email" type="email" />}
              {tab === "mobile" && <Input placeholder="Enter mobile" value={mobile} onChange={setMobile} testId="track-mobile" />}
            </div>
            <button onClick={submit} disabled={busy} data-testid="track-submit"
              className="md:col-span-3 bg-amber-400 hover:bg-amber-300 text-[#0B132B] font-semibold rounded-lg inline-flex items-center justify-center gap-2 disabled:opacity-60">
              <Search className="w-4 h-4" /> {busy ? "Searching…" : "Track"}
            </button>
          </div>
          {err && <div className="text-red-400 text-sm mt-3">{err}</div>}
        </div>

        <div className="mt-6 space-y-3">
          {results.map((b) => (
            <div key={b.id} className="glass-light rounded-2xl p-5" data-testid={`result-${b.pnr}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <Plane className="w-5 h-5 text-amber-700" />
                  <div className="font-mono-aero text-amber-700">{b.pnr}</div>
                </div>
                <span className="text-xs px-3 py-1 rounded-full bg-amber-400/15 text-amber-600 uppercase">{b.status}</span>
              </div>
              <div className="grid grid-cols-3 items-center">
                <div>
                  <div className="font-serif-display text-2xl text-[#0B132B]">{b.flight_snapshot.departure_time}</div>
                  <div className="text-[#0B132B]/60 text-xs">{b.flight_snapshot.origin} • {fmtDate(b.flight_snapshot.departure_date)}</div>
                </div>
                <div className="text-center text-[#0B132B]/60 text-xs">{b.flight_snapshot.flight_number}</div>
                <div className="text-right">
                  <div className="font-serif-display text-2xl text-[#0B132B]">{b.flight_snapshot.arrival_time}</div>
                  <div className="text-[#0B132B]/60 text-xs">{b.flight_snapshot.destination}</div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-[#E5E1D6] flex items-center justify-between text-sm">
                <div className="text-[#0B132B]/65">Time to departure:</div>
                <FlightCountdown departureIso={b.flight_snapshot.departure_iso} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  );
}

function Input({ value, onChange, placeholder, type = "text", testId }) {
  return (
    <input value={value} onChange={(e) => onChange(e.target.value)} type={type} placeholder={placeholder} data-testid={testId}
      className="w-full bg-[#0B132B]/5 border border-[#E5E1D6] rounded-lg px-4 py-3.5 text-[#0B132B] text-sm focus:border-amber-400 outline-none" />
  );
}
