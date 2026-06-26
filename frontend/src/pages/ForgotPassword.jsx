import React, { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { Plane, Mail, CheckCircle2 } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      await api.post("/auth/forgot-password", { email });
      setDone(true);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Could not send reset email");
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen pt-20 grid place-items-center px-6 py-16" data-testid="forgot-page">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-full av-bg-gold grid place-items-center"><Plane className="w-5 h-5 text-[#0B132B]" /></div>
          <div>
            <div className="font-serif-display text-2xl text-white">Reset Password</div>
            <div className="text-white/55 text-xs">We'll email you a secure reset link</div>
          </div>
        </div>

        {done ? (
          <div className="glass-light rounded-2xl p-8 text-center border border-emerald-400/30" data-testid="forgot-done">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
            <div className="text-white font-serif-display text-2xl mb-2">Check your inbox</div>
            <p className="text-white/65 text-sm">If an AeroVista account exists for <span className="text-amber-300">{email}</span>, a reset link is on its way. The link expires in 30 minutes.</p>
            <div className="mt-4 p-3 rounded-lg bg-amber-400/10 border border-amber-400/30 text-amber-200 text-xs text-left" data-testid="spam-notice">
              <strong>Can't find the email?</strong>
              <ul className="list-disc list-inside mt-1 space-y-0.5">
                <li>Check your <strong>Spam</strong> and <strong>Promotions</strong> folders</li>
                <li>Search for <code className="bg-white/10 px-1 rounded">AeroVista</code> or <code className="bg-white/10 px-1 rounded">airlinesaerovista@gmail.com</code></li>
                <li>If you registered with a different email, try that one</li>
                <li>Still nothing? Contact support: <a href="mailto:airlinesaerovista@gmail.com" className="underline">airlinesaerovista@gmail.com</a></li>
              </ul>
            </div>
            <Link to="/login" className="inline-block mt-5 text-amber-400 hover:text-amber-300 text-sm">← Back to sign in</Link>
          </div>
        ) : (
          <form onSubmit={submit}>
            <label className="block">
              <span className="text-[10px] tracking-[0.2em] uppercase text-white/55 mb-1.5 block">Email</span>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-400" />
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} data-testid="forgot-email"
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-3.5 text-white text-sm focus:border-amber-400 outline-none" />
              </div>
            </label>
            {err && <div className="text-red-400 text-sm mt-3">{err}</div>}
            <button disabled={busy} data-testid="forgot-submit"
              className="w-full mt-6 bg-amber-400 hover:bg-amber-300 text-[#0B132B] font-semibold py-3.5 rounded-full transition disabled:opacity-60">
              {busy ? "Sending…" : "Send Reset Link"}
            </button>
            <div className="text-center text-white/60 text-sm mt-5">
              Remembered? <Link to="/login" className="text-amber-400 hover:text-amber-300">Sign in</Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
