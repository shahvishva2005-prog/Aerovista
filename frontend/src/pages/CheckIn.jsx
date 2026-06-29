import React, { useState } from "react";
import { api, API } from "../lib/api";
import PageShell from "../components/PageShell";
import { Plane, CheckCircle2, Download } from "lucide-react";

export default function CheckIn() {
  const [pnr, setPnr] = useState("");
  const [lastName, setLastName] = useState("");
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true); setErr(""); setResult(null);
    try {
      const r = await api.post("/checkin", { pnr: pnr.toUpperCase(), last_name: lastName });
      setResult(r.data);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Check-in failed");
    } finally { setBusy(false); }
  };

  const downloadBP = async (i) => {
    const token = localStorage.getItem("av_token");
    const res = await fetch(`${API}/bookings/${result.booking_id}/boarding-pass.pdf?passenger_idx=${i}`,
      { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `boarding-${result.pnr}-${i+1}.pdf`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <PageShell title="Web Check-In" subtitle="Open 24 hours before departure. Closes 60 minutes prior." testId="checkin-page"
      bgUrl="https://images.unsplash.com/photo-1583416750470-965b2707b355?w=1920&q=85">
      <div className="max-w-3xl mx-auto">
        <div className="glass-light rounded-2xl p-6">
          <div className="grid md:grid-cols-12 gap-3">
            <div className="md:col-span-5">
              <label className="text-[10px] tracking-[0.2em] uppercase text-[#0B132B]/60 mb-1.5 block">PNR</label>
              <input value={pnr} onChange={(e) => setPnr(e.target.value)} data-testid="checkin-pnr"
                className="w-full bg-[#0B132B]/5 border border-[#E5E1D6] rounded-lg px-4 py-3.5 text-[#0B132B] text-sm focus:border-amber-400 outline-none" />
            </div>
            <div className="md:col-span-5">
              <label className="text-[10px] tracking-[0.2em] uppercase text-[#0B132B]/60 mb-1.5 block">Last Name</label>
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} data-testid="checkin-lastname"
                className="w-full bg-[#0B132B]/5 border border-[#E5E1D6] rounded-lg px-4 py-3.5 text-[#0B132B] text-sm focus:border-amber-400 outline-none" />
            </div>
            <button onClick={submit} disabled={busy} data-testid="checkin-submit"
              className="md:col-span-2 bg-amber-400 hover:bg-amber-300 text-[#0B132B] font-semibold rounded-lg inline-flex items-center justify-center disabled:opacity-60">
              {busy ? "…" : "Check-In"}
            </button>
          </div>
          {err && <div className="text-red-400 text-sm mt-3">{err}</div>}
        </div>

        {result && (
          <div className="mt-6 glass-light rounded-2xl p-6 border border-emerald-400/30" data-testid="checkin-result">
            <div className="flex items-center gap-3 mb-5">
              <CheckCircle2 className="w-7 h-7 text-emerald-400" />
              <div>
                <div className="text-emerald-300 text-xs tracking-[0.3em] uppercase">Checked-in</div>
                <h3 className="font-serif-display text-2xl text-[#0B132B]">PNR {result.pnr}</h3>
              </div>
            </div>
            <div className="space-y-2">
              {result.passengers.map((p, i) => (
                <div key={i} className="flex items-center justify-between bg-[#0B132B]/5 p-3 rounded-lg">
                  <div>
                    <div className="text-[#0B132B] text-sm">{p.title} {p.first_name} {p.last_name}</div>
                    <div className="text-[#0B132B]/60 text-xs">Seat <span className="text-amber-700 font-mono-aero">{result.seats[i] || "TBA"}</span></div>
                  </div>
                  <button onClick={() => downloadBP(i)} data-testid={`download-bp-${i}`}
                    className="bg-amber-400 hover:bg-amber-300 text-[#0B132B] font-medium px-4 py-2 rounded-full text-xs inline-flex items-center gap-2">
                    <Download className="w-3.5 h-3.5" /> Boarding Pass
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}
