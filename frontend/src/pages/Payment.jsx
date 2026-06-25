import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, fmtINR } from "../lib/api";
import { CreditCard, Smartphone, Wallet, Building2, Lock } from "lucide-react";

const METHODS = [
  { v: "credit_card", l: "Credit Card", Icon: CreditCard },
  { v: "debit_card", l: "Debit Card", Icon: CreditCard },
  { v: "upi", l: "UPI", Icon: Smartphone },
  { v: "wallet", l: "Wallet", Icon: Wallet },
  { v: "net_banking", l: "Net Banking", Icon: Building2 },
];

const BANK_OFFERS = [
  { code: "HDFC10", text: "HDFC: 10% off ticket base", color: "text-amber-300" },
  { code: "ICICI200", text: "ICICI: Flat ₹200 off", color: "text-sky-300" },
  { code: "AXIS5", text: "Axis: 5% off ticket base", color: "text-emerald-300" },
  { code: "SBI500", text: "SBI: Flat ₹500 off", color: "text-rose-300" },
];

export default function Payment() {
  const { bookingId } = useParams();
  const nav = useNavigate();
  const [booking, setBooking] = useState(null);
  const [method, setMethod] = useState("credit_card");
  const [cardHolder, setCardHolder] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [bank, setBank] = useState("HDFC");
  const [upi, setUpi] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.get(`/bookings/${bookingId}`).then((r) => setBooking(r.data));
  }, [bookingId]);

  if (!booking) return <div className="pt-32 text-center text-white/70">Loading…</div>;

  const pay = async () => {
    setErr(""); setBusy(true);
    try {
      const last4 = (cardNumber || "").replace(/\s/g, "").slice(-4);
      const r = await api.post(`/bookings/${bookingId}/pay`, {
        booking_id: bookingId, method, bank,
        card_holder: cardHolder, card_number_last4: last4, upi_id: upi,
      });
      nav(`/booking/${bookingId}?paid=1&points=${r.data.points_earned}`);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Payment failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-16" data-testid="payment-page">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="mb-8">
          <div className="text-amber-400 text-xs tracking-[0.3em] uppercase mb-3">Step 4 of 4 • Payment</div>
          <h2 className="font-serif-display text-4xl text-white">Secure Payment</h2>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <section className="glass-light rounded-2xl p-6">
              <div className="text-amber-400 text-xs tracking-[0.3em] uppercase mb-4">Payment Method</div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                {METHODS.map(({ v, l, Icon }) => (
                  <button key={v} onClick={() => setMethod(v)} data-testid={`pm-${v}`}
                    className={`p-4 rounded-xl border transition ${method === v ? "border-amber-400 bg-amber-400/10" : "border-white/10 hover:border-white/30"}`}>
                    <Icon className="w-5 h-5 text-amber-400 mx-auto mb-2" />
                    <div className="text-white text-xs">{l}</div>
                  </button>
                ))}
              </div>

              {(method === "credit_card" || method === "debit_card") && (
                <div className="grid md:grid-cols-12 gap-3">
                  <Input label="Card Holder Name" col="md:col-span-12" value={cardHolder} onChange={setCardHolder} testId="card-holder" />
                  <Input label="Card Number" col="md:col-span-7" value={cardNumber} onChange={(v) => setCardNumber(v.replace(/[^0-9 ]/g, "").slice(0, 19))} placeholder="4242 4242 4242 4242" testId="card-number" />
                  <Input label="Expiry" col="md:col-span-3" placeholder="MM/YY" />
                  <Input label="CVV" col="md:col-span-2" value={cardCvv} onChange={(v) => setCardCvv(v.replace(/\D/g, "").slice(0, 4))} testId="card-cvv" type="password" />
                  <div className="md:col-span-12">
                    <label className="text-[10px] tracking-[0.2em] uppercase text-white/55 mb-1.5 block">Bank (for offers)</label>
                    <select value={bank} onChange={(e) => setBank(e.target.value)} data-testid="bank-select"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-3 text-white text-sm">
                      {["HDFC", "ICICI", "AXIS", "SBI", "OTHER"].map((b) => <option key={b} className="bg-[#1C2541]">{b}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {method === "upi" && (
                <div>
                  <Input label="UPI ID" value={upi} onChange={setUpi} placeholder="yourname@bank" testId="upi-id" />
                </div>
              )}

              {method === "wallet" && (
                <div className="text-white/70 text-sm">Pay using Paytm, PhonePe, Amazon Pay, or AeroVista Wallet.</div>
              )}

              {method === "net_banking" && (
                <div>
                  <label className="text-[10px] tracking-[0.2em] uppercase text-white/55 mb-1.5 block">Bank</label>
                  <select value={bank} onChange={(e) => setBank(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-3 text-white text-sm">
                    {["HDFC", "ICICI", "AXIS", "SBI", "KOTAK", "PNB"].map((b) => <option key={b} className="bg-[#1C2541]">{b}</option>)}
                  </select>
                </div>
              )}
            </section>

            <section className="glass-light rounded-2xl p-6">
              <div className="text-amber-400 text-xs tracking-[0.3em] uppercase mb-4">Bank Offers</div>
              <ul className="space-y-2 text-sm">
                {BANK_OFFERS.map((o) => (
                  <li key={o.code} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                    <div><span className={`font-mono-aero text-xs ${o.color} mr-2`}>{o.code}</span> {o.text}</div>
                  </li>
                ))}
              </ul>
              <div className="text-white/40 text-xs mt-3">Apply code on the Billing page to get instant discount.</div>
            </section>
          </div>

          <aside className="glass-light rounded-2xl p-6 h-fit sticky top-28">
            <div className="text-amber-400 text-xs tracking-[0.3em] uppercase mb-4">Final Amount</div>
            <div className="space-y-2 text-sm">
              <Row k="Base Fare" v={fmtINR(booking.fare.base)} />
              <Row k="Add-ons" v={fmtINR(booking.fare.addons)} />
              <Row k="Discount" v={`- ${fmtINR(booking.fare.discount)}`} />
              <Row k="Taxes" v={fmtINR(booking.fare.taxes)} />
              <Row k="Convenience" v={fmtINR(booking.fare.convenience)} />
              <div className="border-t border-white/10 pt-3 flex justify-between items-center">
                <span className="text-white">Total Payable</span>
                <span className="font-serif-display text-3xl av-text-gold-grad">{fmtINR(booking.fare.total)}</span>
              </div>
            </div>
            {err && <div className="text-red-400 text-xs mt-3">{err}</div>}
            <button onClick={pay} disabled={busy} data-testid="confirm-payment"
              className="w-full mt-6 bg-amber-400 hover:bg-amber-300 text-[#0B132B] font-semibold py-3 rounded-full inline-flex items-center justify-center gap-2 transition disabled:opacity-60">
              <Lock className="w-4 h-4" /> {busy ? "Processing…" : `Pay ${fmtINR(booking.fare.total)}`}
            </button>
            <div className="text-white/40 text-[11px] text-center mt-3">256-bit SSL secured payment</div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Input({ label, value = "", onChange = () => {}, col = "", type = "text", placeholder, testId }) {
  return (
    <div className={col}>
      <label className="text-[10px] tracking-[0.2em] uppercase text-white/55 mb-1.5 block">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} data-testid={testId}
        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:border-amber-400 outline-none" />
    </div>
  );
}

function Row({ k, v }) {
  return <div className="flex justify-between"><span className="text-white/55">{k}</span><span className="text-white">{v}</span></div>;
}
