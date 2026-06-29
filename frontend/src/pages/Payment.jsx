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

export default function Payment() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [method, setMethod] = useState("credit_card");
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  
  // Mandatory input field states
  const [form, setForm] = useState({ holder: "", number: "", expiry: "", cvv: "" });
  const [error, setError] = useState("");

  useEffect(() => {
    api.get(`/bookings/${bookingId}`)
      .then((res) => {
        setBooking(res.data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [bookingId]);

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Enforce mandatory billing validations
    if (["credit_card", "debit_card"].includes(method)) {
      if (!form.holder.trim() || !form.number.trim() || !form.expiry.trim() || !form.cvv.trim()) {
        setError("All standard card billing fields are strictly mandatory.");
        return;
      }
      if (form.number.replace(/\s/g, "").length < 16) {
        setError("Card identification length validation mismatch error.");
        return;
      }
    }

    setPaying(true);
    try {
      const payload = {
        booking_id: bookingId,
        method: method,
        amount: booking.fare.total,
        currency: "INR"
      };
      
      const res = await api.post("/payments/charge", payload);
      if (res.data.status === "success") {
        navigate(`/confirmation/${bookingId}`);
      } else {
        setError("Gateway transaction rejected by clearing bank engine.");
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Network processing anomaly timed out.");
    } finally {
      setPaying(false);
    }
  };

  if (loading) return <div className="text-center p-12 font-medium text-slate-500">Loading billing information terminal...</div>;
  if (!booking) return <div className="text-center p-12 text-rose-500 font-bold">Booking entry pointer not found.</div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 py-10 px-4">
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Left Side Column: Payment Gateway Selection */}
        <div className="md:col-span-2 bg-white border border-slate-200 p-6 rounded-xl shadow-sm">
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2 mb-6">
            <Lock className="w-5 h-5 text-indigo-600" /> Secure Checkout Terminal
          </h2>

          {error && <div className="bg-rose-50 border border-rose-200 text-rose-600 p-3 rounded-md text-xs font-semibold mb-4">⚠️ {error}</div>}

          <div className="space-y-3 mb-6">
            {METHODS.map(({ v, l, Icon }) => (
              <label key={v} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${method === v ? "border-indigo-600 bg-indigo-50/50" : "border-slate-200 hover:bg-slate-50"}`}>
                <input type="radio" name="pay_method" checked={method === v} onChange={() => setMethod(v)} className="text-indigo-600 focus:ring-indigo-500" />
                <Icon className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-semibold text-slate-800">{l}</span>
              </label>
            ))}
          </div>

          {["credit_card", "debit_card"].includes(method) && (
            <div className="space-y-4 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">CARDHOLDER NAME *</label>
                <input type="text" value={form.holder} onChange={e => setForm({...form, holder: e.target.value})} className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-sm focus:bg-white focus:outline-indigo-500" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">CARD NUMBER *</label>
                <input type="text" placeholder="0000 0000 0000 0000" maxLength={19} value={form.number} onChange={e => setForm({...form, number: e.target.value.replace(/\s?/g, "").replace(/(\d{4})/g, "$1 ").trim()})} className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-sm tracking-widest focus:bg-white focus:outline-indigo-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">EXPIRY *</label>
                  <input type="text" placeholder="MM/YY" maxLength={5} value={form.expiry} onChange={e => setForm({...form, expiry: e.target.value})} className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-sm text-center focus:bg-white focus:outline-indigo-500" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">SECURITY CODE (CVV) *</label>
                  <input type="password" placeholder="***" maxLength={3} value={form.cvv} onChange={e => setForm({...form, cvv: e.target.value.replace(/\D/g, "")})} className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-sm text-center focus:bg-white focus:outline-indigo-500" />
                </div>
              </div>
            </div>
          )}

          <button onClick={handlePaymentSubmit} disabled={paying} className="w-full mt-6 bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-lg shadow-sm transition-all text-sm tracking-wide disabled:opacity-50">
            {paying ? "AUTHORIZING WITH BANK..." : `PAY ${fmtINR(booking.fare.total)}`}
          </button>
        </div>

        {/* Right Side Column: Fare Summary breakdown */}
        <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm self-start">
          <h3 className="text-sm font-bold text-slate-400 tracking-wider mb-3">FARE BREAKDOWN</h3>
          <div className="space-y-2 text-sm border-b border-slate-100 pb-3">
            <div className="flex justify-between text-slate-600"><span>Base Ticket Fare</span><span>{fmtINR(booking.fare.base)}</span></div>
            {booking.fare.discount > 0 && <div className="flex justify-between text-emerald-600 font-medium"><span>Applied Discount</span><span>-{fmtINR(booking.fare.discount)}</span></div>}
            <div className="flex justify-between text-slate-600"><span>Aviation Taxes & GST</span><span>{fmtINR(booking.fare.taxes)}</span></div>
          </div>
          <div className="flex justify-between items-center pt-3 font-black text-slate-900 text-base">
            <span>Total Payable</span><span>{fmtINR(booking.fare.total)}</span>
          </div>
        </div>

      </div>
    </div>
  );
}
