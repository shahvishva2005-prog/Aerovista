import React, { useState } from 'react';

export default function PaymentWindow({ totalAmount, onPaymentSuccess }) {
  const [form, setForm] = useState({ holder: '', number: '', expiry: '', cvv: '' });
  const [error, setError] = useState('');

  const handlePaySubmit = (e) => {
    e.preventDefault();
    setError('');

    // Strict validation engine enforcement rule block
    if (!form.holder.trim() || !form.number.trim() || !form.expiry.trim() || !form.cvv.trim()) {
      setError('All transaction payment fields are strictly mandatory.');
      return;
    }
    if (form.number.replace(/\s/g, '').length < 16) {
      setError('Invalid card configuration parameter layout.');
      return;
    }
    if (form.cvv.length < 3) {
      setError('Invalid CVV security format verification metrics.');
      return;
    }

    onPaymentSuccess({ transactionId: `TXN-${Math.random().toString(36).substring(2, 10).toUpperCase()}` });
  };

  return (
    <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-lg max-w-md mx-auto my-8 text-slate-800">
      <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
        <h3 className="text-lg font-bold text-slate-900">Secure Billing Terminal</h3>
        <span className="text-lg font-extrabold text-indigo-600">₹{totalAmount}</span>
      </div>

      {error && (
        <div className="bg-rose-50 text-rose-600 p-3 rounded-md text-xs font-semibold mb-4 border border-rose-200">
          ⚠️ {error}
        </div>
      )}

      <form onSubmit={handlePaySubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">CARDHOLDER NAME *</label>
          <input
            type="text"
            required
            value={form.holder}
            onChange={(e) => setForm({ ...form, holder: e.target.value })}
            className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-sm text-slate-900 focus:bg-white focus:outline-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">CREDIT/DEBIT CARD NUMBER *</label>
          <input
            type="text"
            maxLength={19}
            required
            placeholder="0000 0000 0000 0000"
            value={form.number}
            onChange={(e) => setForm({ ...form, number: e.target.value.replace(/\s?/g, '').replace(/(\d{4})/g, '$1 ').trim() })}
            className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-sm text-slate-900 tracking-widest focus:bg-white focus:outline-indigo-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">EXPIRY DATE *</label>
            <input
              type="text"
              maxLength={5}
              required
              placeholder="MM/YY"
              value={form.expiry}
              onChange={(e) => setForm({ ...form, expiry: e.target.value })}
              className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-sm text-slate-900 text-center focus:bg-white focus:outline-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">SECURITY CODE (CVV) *</label>
            <input
              type="password"
              maxLength={3}
              required
              placeholder="***"
              value={form.cvv}
              onChange={(e) => setForm({ ...form, cvv: e.target.value.replace(/\D/g, '') })}
              className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-sm text-slate-900 text-center tracking-widest focus:bg-white focus:outline-indigo-500"
            />
          </div>
        </div>

        <button
          type="submit"
          className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-4 rounded transition-all mt-2 text-sm tracking-wide shadow-sm"
        >
          CONFIRM TRANSACTION PAYMENT
        </button>
      </form>
    </div>
  );
}
