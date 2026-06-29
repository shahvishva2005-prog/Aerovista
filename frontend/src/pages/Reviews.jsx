import React, { useEffect, useState } from "react";
import PageShell from "../components/PageShell";
import { api } from "../lib/api";
import { Star, Send } from "lucide-react";

export default function Reviews() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({
    name: "", email: "", rating: 5, flight_number: "", pnr: "", title: "", review: "",
  });
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState("");
  const [err, setErr] = useState("");

  const load = () => api.get("/reviews?limit=24").then((r) => setItems(r.data));
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setOk(""); setErr("");
    try {
      await api.post("/reviews", form);
      setOk("Thank you! Your review has been submitted. We've emailed you a confirmation.");
      setForm({ name: "", email: "", rating: 5, flight_number: "", pnr: "", title: "", review: "" });
      await load();
    } catch (e) {
      setErr(e?.response?.data?.detail || "Could not submit review");
    } finally { setBusy(false); }
  };

  return (
    <PageShell title="Customer Reviews"
      subtitle="Honest stories from travellers who flew above and beyond with AeroVista."
      testId="reviews-page"
      bgUrl="https://images.unsplash.com/photo-1542296332-2e4473faf563?w=1920&q=85">
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Form */}
        <form onSubmit={submit} className="glass-light rounded-2xl p-6 h-fit" data-testid="review-form">
          <div className="text-amber-700 text-[10px] tracking-[0.3em] uppercase mb-3">Share your experience</div>
          <h3 className="font-serif-display text-2xl text-[#0B132B] mb-5">Write a Review</h3>
          <div className="space-y-3">
            <Field label="Your Name *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} testId="rv-name" required />
            <Field label="Email *" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} testId="rv-email" required />
            <div>
              <div className="text-[10px] tracking-[0.2em] uppercase text-[#0B132B]/60 mb-1.5">Rating *</div>
              <div className="flex gap-1" data-testid="rv-rating">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" onClick={() => setForm({ ...form, rating: n })}
                    data-testid={`rv-star-${n}`}
                    className={`p-1 transition ${n <= form.rating ? "text-amber-500" : "text-[#0B132B]/25"}`}>
                    <Star className="w-6 h-6 fill-current" />
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Flight # (optional)" value={form.flight_number}
                onChange={(v) => setForm({ ...form, flight_number: v.toUpperCase() })} testId="rv-flight" />
              <Field label="PNR (optional)" value={form.pnr}
                onChange={(v) => setForm({ ...form, pnr: v.toUpperCase() })} testId="rv-pnr" />
            </div>
            <Field label="Title *" value={form.title} onChange={(v) => setForm({ ...form, title: v })} testId="rv-title" required />
            <div>
              <div className="text-[10px] tracking-[0.2em] uppercase text-[#0B132B]/60 mb-1.5">Your Review *</div>
              <textarea required rows={5} value={form.review} onChange={(e) => setForm({ ...form, review: e.target.value })}
                data-testid="rv-text"
                className="w-full bg-[#0B132B]/5 border border-[#E5E1D6] rounded-lg px-4 py-3 text-[#0B132B] text-sm focus:border-amber-400 outline-none" />
            </div>
            {err && <div className="text-red-600 text-xs">{err}</div>}
            {ok && <div className="text-emerald-700 text-xs">{ok}</div>}
            <button type="submit" disabled={busy} data-testid="rv-submit"
              className="w-full bg-amber-400 hover:bg-amber-300 text-[#0B132B] font-semibold py-3 rounded-full inline-flex items-center justify-center gap-2 transition disabled:opacity-60">
              <Send className="w-4 h-4" /> {busy ? "Submitting…" : "Post Review"}
            </button>
          </div>
        </form>

        {/* List */}
        <div className="lg:col-span-2 space-y-3" data-testid="reviews-list">
          {items.length === 0 && (
            <div className="text-[#0B132B]/55 glass-light rounded-2xl p-8 text-center">No reviews yet. Be the first to share.</div>
          )}
          {items.map((r) => (
            <div key={r.id} className="glass-light rounded-2xl p-5" data-testid={`review-${r.id}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[#0B132B] font-medium">{r.name}</div>
                  <div className="text-[#0B132B]/55 text-xs">{r.created_at?.slice(0, 10)}{r.flight_number ? ` • ${r.flight_number}` : ""}</div>
                </div>
                <div className="flex">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={`w-4 h-4 ${i < r.rating ? "text-amber-500 fill-current" : "text-[#0B132B]/20"}`} />
                  ))}
                </div>
              </div>
              <div className="font-serif-display text-xl text-[#0B132B] mt-2">{r.title}</div>
              <p className="text-[#0B132B]/75 text-sm mt-1 leading-relaxed">{r.review}</p>
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  );
}

function Field({ label, value, onChange, type = "text", required, testId }) {
  return (
    <label className="block">
      <span className="text-[10px] tracking-[0.2em] uppercase text-[#0B132B]/60 mb-1.5 block">{label}</span>
      <input type={type} value={value} required={required}
        onChange={(e) => onChange(e.target.value)} data-testid={testId}
        className="w-full bg-[#0B132B]/5 border border-[#E5E1D6] rounded-lg px-4 py-3 text-[#0B132B] text-sm focus:border-amber-400 outline-none" />
    </label>
  );
}
