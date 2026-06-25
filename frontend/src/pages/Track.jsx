import React, { useState } from "react";
import { api, fmtDate } from "../lib/api";
import PageShell from "../components/PageShell";
import { Plane, Search } from "lucide-react";

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
                className={`px-4 py-2 rounded-full text-sm transition ${tab === v ? "bg-amber-400 text-[#0B132B]" : "bg-white/5 text-white/70 hover:bg-white/10"}`}>{l}</button>
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
                  <Plane className="w-5 h-5 text-amber-400" />
                  <div className="font-mono-aero text-amber-400">{b.pnr}</div>
                </div>
                <span className="text-xs px-3 py-1 rounded-full bg-amber-400/15 text-amber-300 uppercase">{b.status}</span>
              </div>
              <div className="grid grid-cols-3 items-center">
                <div>
                  <div className="font-serif-display text-2xl text-white">{b.flight_snapshot.departure_time}</div>
                  <div className="text-white/55 text-xs">{b.flight_snapshot.origin} • {fmtDate(b.flight_snapshot.departure_date)}</div>
                </div>
                <div className="text-center text-white/55 text-xs">{b.flight_snapshot.flight_number}</div>
                <div className="text-right">
                  <div className="font-serif-display text-2xl text-white">{b.flight_snapshot.arrival_time}</div>
                  <div className="text-white/55 text-xs">{b.flight_snapshot.destination}</div>
                </div>
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
      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3.5 text-white text-sm focus:border-amber-400 outline-none" />
  );
}
