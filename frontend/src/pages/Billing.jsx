import React, { useEffect, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { api, fmtINR } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Plus, Minus, Plane, Shield, Briefcase, Utensils, Tag } from "lucide-react";

const COUNTRIES = ["India", "United Arab Emirates", "United Kingdom", "United States", "Singapore", "Australia", "Canada", "Germany", "France", "Japan"];
const MEALS = ["Standard", "Vegetarian", "Vegan", "Hindu", "Halal", "Kosher", "Gluten-Free", "Diabetic", "Child"];

export default function Billing() {
  const { flightId } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const seats = (params.get("seats") || "").split(",").filter(Boolean);
  const cabin = params.get("cabin") || "economy";
  const numPax = Number(params.get("passengers") || 1);

  const [flight, setFlight] = useState(null);
  const [passengers, setPassengers] = useState(
    Array.from({ length: numPax }, () => ({
      title: "Mr", first_name: "", last_name: "", dob: "",
      gender: "M", nationality: "Indian", passport_no: "",
      is_senior: false, is_disabled: false, is_child: false, is_infant: false,
    }))
  );
  const [meals, setMeals] = useState(Array.from({ length: numPax }, () => "Standard"));
  const [addBaggage, setAddBaggage] = useState(false);
  const [addInsurance, setAddInsurance] = useState(false);
  const [promo, setPromo] = useState("");
  const [billing, setBilling] = useState({
    contact_name: user?.name || "",
    contact_email: user?.email || "",
    contact_mobile: user?.mobile || "",
    address_line1: "", address_line2: "",
    city: "", state: "", postal_code: "", country: "India", gst_number: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get(`/flights/${flightId}`).then((r) => setFlight(r.data));
  }, [flightId]);

  if (!user) {
    nav(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    return null;
  }
  if (!flight) return <div className="pt-32 text-center text-[#0B132B]/72">Loading…</div>;

  const updatePax = (i, field, v) => {
    const next = [...passengers]; next[i] = { ...next[i], [field]: v }; setPassengers(next);
  };
  const updateMeal = (i, v) => { const n = [...meals]; n[i] = v; setMeals(n); };
  const updateBill = (f, v) => setBilling((b) => ({ ...b, [f]: v }));

  // estimate
  const baseEst = Math.round(flight.base_price * { economy: 1, premium_economy: 1.6, business: 2.8, first: 4.5 }[cabin] * numPax);
  const addonsEst = (addBaggage ? 800 * numPax : 0) + (addInsurance ? 250 * numPax : 0) + meals.filter((m) => m && m !== "Standard").length * 350;

  const submit = async () => {
    setError(""); setSubmitting(true);
    try {
      // Validate
      for (const p of passengers) {
        if (!p.first_name || !p.last_name) { throw new Error("Please enter all passenger names"); }
      }
      if (!billing.contact_name || !billing.contact_email || !billing.contact_mobile) {
        throw new Error("Please complete billing contact details");
      }
      if (!billing.address_line1 || !billing.city || !billing.state || !billing.postal_code) {
        throw new Error("Please complete billing address");
      }
      const r = await api.post("/bookings", {
        flight_id: flightId, cabin_class: cabin, passengers,
        seat_numbers: seats, meal_preferences: meals,
        add_baggage: addBaggage, add_insurance: addInsurance,
        billing, promo_code: promo,
      });
      nav(`/payment/${r.data.id}`);
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || "Failed to create booking");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-16" data-testid="billing-page">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="mb-8">
          <div className="text-amber-700 text-xs tracking-[0.3em] uppercase mb-3">Step 3 of 4 • Passenger & Billing</div>
          <h2 className="font-serif-display text-4xl text-[#0B132B]">Complete your details</h2>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* Passengers */}
            <section className="glass-light rounded-2xl p-6">
              <h3 className="font-serif-display text-2xl text-[#0B132B] mb-5">Passenger Information</h3>
              {passengers.map((p, i) => (
                <div key={i} className="border-t border-[#E5E1D6] first:border-t-0 pt-5 first:pt-0 pb-5 last:pb-0">
                  <div className="flex justify-between items-center mb-3">
                    <div className="text-amber-700 text-xs tracking-[0.2em] uppercase">Passenger {i + 1}</div>
                    {seats[i] && <div className="text-[#0B132B]/65 text-sm">Seat <span className="text-amber-700 font-mono-aero">{seats[i]}</span></div>}
                  </div>
                  <div className="grid md:grid-cols-12 gap-3">
                    <Select label="Title" col="md:col-span-2" value={p.title} options={["Mr", "Mrs", "Ms", "Mstr"]} onChange={(v) => updatePax(i, "title", v)} testId={`pax-title-${i}`} />
                    <Input label="First Name" col="md:col-span-5" value={p.first_name} onChange={(v) => updatePax(i, "first_name", v)} testId={`pax-fn-${i}`} />
                    <Input label="Last Name" col="md:col-span-5" value={p.last_name} onChange={(v) => updatePax(i, "last_name", v)} testId={`pax-ln-${i}`} />
                    <Input label="DOB" type="date" col="md:col-span-4" value={p.dob} onChange={(v) => updatePax(i, "dob", v)} testId={`pax-dob-${i}`} />
                    <Select label="Gender" col="md:col-span-2" value={p.gender} options={[["M", "Male"], ["F", "Female"], ["O", "Other"]]} onChange={(v) => updatePax(i, "gender", v)} />
                    <Input label="Nationality" col="md:col-span-3" value={p.nationality} onChange={(v) => updatePax(i, "nationality", v)} />
                    <Input label="Passport (optional)" col="md:col-span-3" value={p.passport_no} onChange={(v) => updatePax(i, "passport_no", v)} />
                    <Select label="Meal Preference" col="md:col-span-6" value={meals[i]} options={MEALS} onChange={(v) => updateMeal(i, v)} />
                    <div className="md:col-span-6 flex flex-wrap gap-3 items-end">
                      {[
                        ["is_senior", "Senior Citizen"], ["is_disabled", "Disabled"],
                        ["is_child", "Child"], ["is_infant", "Infant"],
                      ].map(([k, l]) => (
                        <label key={k} className="text-xs text-[#0B132B]/72 flex items-center gap-2 bg-[#0B132B]/5 px-3 py-2 rounded-full">
                          <input type="checkbox" checked={p[k]} onChange={(e) => updatePax(i, k, e.target.checked)} /> {l}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </section>

            {/* Billing Address */}
            <section className="glass-light rounded-2xl p-6">
              <h3 className="font-serif-display text-2xl text-[#0B132B] mb-5">Billing & Contact</h3>
              <div className="grid md:grid-cols-12 gap-3">
                <Input label="Contact Name" col="md:col-span-6" value={billing.contact_name} onChange={(v) => updateBill("contact_name", v)} testId="bill-name" />
                <Input label="Email" col="md:col-span-6" type="email" value={billing.contact_email} onChange={(v) => updateBill("contact_email", v)} testId="bill-email" />
                <Input label="Mobile" col="md:col-span-6" value={billing.contact_mobile} onChange={(v) => updateBill("contact_mobile", v)} testId="bill-mobile" />
                <Input label="GST Number (optional)" col="md:col-span-6" value={billing.gst_number} onChange={(v) => updateBill("gst_number", v)} />
                <Input label="Address Line 1" col="md:col-span-12" value={billing.address_line1} onChange={(v) => updateBill("address_line1", v)} testId="bill-addr1" />
                <Input label="Address Line 2 (optional)" col="md:col-span-12" value={billing.address_line2} onChange={(v) => updateBill("address_line2", v)} />
                <Input label="City" col="md:col-span-4" value={billing.city} onChange={(v) => updateBill("city", v)} testId="bill-city" />
                <Input label="State" col="md:col-span-4" value={billing.state} onChange={(v) => updateBill("state", v)} testId="bill-state" />
                <Input label="Postal Code" col="md:col-span-4" value={billing.postal_code} onChange={(v) => updateBill("postal_code", v)} testId="bill-zip" />
                <Select label="Country" col="md:col-span-12" value={billing.country} options={COUNTRIES} onChange={(v) => updateBill("country", v)} />
              </div>
            </section>

            {/* Add-ons */}
            <section className="glass-light rounded-2xl p-6">
              <h3 className="font-serif-display text-2xl text-[#0B132B] mb-5">Add-ons</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <label className={`p-5 rounded-xl border cursor-pointer transition ${addBaggage ? "border-amber-400 bg-amber-400/10" : "border-[#E5E1D6] hover:border-white/30"}`}>
                  <input type="checkbox" checked={addBaggage} onChange={(e) => setAddBaggage(e.target.checked)} className="hidden" />
                  <div className="flex items-start gap-3">
                    <Briefcase className="w-5 h-5 text-amber-700 mt-1" />
                    <div>
                      <div className="text-[#0B132B] font-medium">Extra Baggage 15kg</div>
                      <div className="text-[#0B132B]/60 text-xs">{fmtINR(800)} per passenger</div>
                    </div>
                  </div>
                </label>
                <label className={`p-5 rounded-xl border cursor-pointer transition ${addInsurance ? "border-amber-400 bg-amber-400/10" : "border-[#E5E1D6] hover:border-white/30"}`}>
                  <input type="checkbox" checked={addInsurance} onChange={(e) => setAddInsurance(e.target.checked)} className="hidden" />
                  <div className="flex items-start gap-3">
                    <Shield className="w-5 h-5 text-amber-700 mt-1" />
                    <div>
                      <div className="text-[#0B132B] font-medium">Travel Insurance</div>
                      <div className="text-[#0B132B]/60 text-xs">{fmtINR(250)} per passenger</div>
                    </div>
                  </div>
                </label>
              </div>
              <div className="mt-5">
                <div className="text-[#0B132B]/65 text-xs tracking-[0.2em] uppercase mb-2">Promo Code</div>
                <div className="flex gap-2">
                  <input value={promo} onChange={(e) => setPromo(e.target.value.toUpperCase())} placeholder="HDFC10, ICICI200, AXIS5, SBI500"
                    data-testid="promo-code"
                    className="flex-1 bg-[#0B132B]/5 border border-[#E5E1D6] rounded-lg px-4 py-3 text-[#0B132B] text-sm" />
                  <button className="bg-amber-400/20 text-amber-600 px-5 rounded-lg border border-amber-500/50 hover:bg-amber-400/30 transition text-sm">
                    Apply
                  </button>
                </div>
              </div>
            </section>
          </div>

          {/* Summary */}
          <aside className="glass-light rounded-2xl p-6 h-fit sticky top-28">
            <div className="text-amber-700 text-xs tracking-[0.3em] uppercase mb-3">Trip Summary</div>
            <div className="flex items-center gap-3 mb-5">
              <Plane className="w-5 h-5 text-amber-700" />
              <div>
                <div className="text-[#0B132B] font-medium text-sm">{flight.origin} → {flight.destination}</div>
                <div className="text-[#0B132B]/55 text-xs">{flight.flight_number} • {flight.departure_date}</div>
              </div>
            </div>

            <div className="space-y-2 text-sm border-t border-[#E5E1D6] pt-4">
              <Row k={`Base × ${numPax}`} v={fmtINR(baseEst)} />
              <Row k="Seats & Add-ons" v={fmtINR(addonsEst)} />
              <Row k="Taxes (est.)" v={fmtINR(Math.round((baseEst + addonsEst) * 0.05))} />
              <Row k="Convenience" v={fmtINR(50)} />
              <div className="border-t border-[#E5E1D6] pt-3 flex justify-between items-center">
                <span className="text-[#0B132B]">Estimated Total</span>
                <span className="font-serif-display text-2xl av-text-gold-grad">{fmtINR(baseEst + addonsEst + Math.round((baseEst + addonsEst) * 0.05) + 50)}</span>
              </div>
            </div>

            {error && <div className="text-red-400 text-xs mt-4">{error}</div>}
            <button onClick={submit} disabled={submitting} data-testid="proceed-to-payment"
              className="w-full mt-6 bg-amber-400 hover:bg-amber-300 text-[#0B132B] font-semibold py-3 rounded-full transition disabled:opacity-60">
              {submitting ? "Creating booking…" : "Proceed to Payment"}
            </button>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, col = "", type = "text", testId }) {
  return (
    <div className={col}>
      <label className="text-[10px] tracking-[0.2em] uppercase text-[#0B132B]/60 mb-1.5 block">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} data-testid={testId}
        className="w-full bg-[#0B132B]/5 border border-[#E5E1D6] rounded-lg px-4 py-3 text-[#0B132B] text-sm focus:border-amber-400 outline-none" />
    </div>
  );
}

function Select({ label, value, options, onChange, col = "", testId }) {
  const items = options.map((o) => Array.isArray(o) ? o : [o, o]);
  return (
    <div className={col}>
      <label className="text-[10px] tracking-[0.2em] uppercase text-[#0B132B]/60 mb-1.5 block">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} data-testid={testId}
        className="w-full bg-[#0B132B]/5 border border-[#E5E1D6] rounded-lg px-3 py-3 text-[#0B132B] text-sm focus:border-amber-400 outline-none">
        {items.map(([v, l]) => <option key={v} value={v} className="bg-[#1C2541]">{l}</option>)}
      </select>
    </div>
  );
}

function Row({ k, v }) {
  return <div className="flex justify-between"><span className="text-[#0B132B]/60">{k}</span><span className="text-[#0B132B]">{v}</span></div>;
}
