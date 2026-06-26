import React, { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { Plane, Lock, CheckCircle2 } from "lucide-react";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const token = params.get("token") || "";
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault(); setErr(""); setBusy(true);
    if (pw !== pw2) { setErr("Passwords do not match"); setBusy(false); return; }
    try {
      await api.post("/auth/reset-password", { token, new_password: pw });
      setDone(true);
      setTimeout(() => nav("/login"), 2500);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Could not reset password");
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen pt-20 grid place-items-center px-6 py-16" data-testid="reset-page">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-full av-bg-gold grid place-items-center"><Plane className="w-5 h-5 text-[#0B132B]" /></div>
          <div>
            <div className="font-serif-display text-2xl text-white">Set a new password</div>
            <div className="text-white/55 text-xs">Choose at least 6 characters</div>
          </div>
        </div>

        {!token ? (
          <div className="text-red-400 text-sm">Missing reset token. Please request a new reset link.</div>
        ) : done ? (
          <div className="glass-light rounded-2xl p-8 text-center border border-emerald-400/30">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
            <div className="text-white font-serif-display text-2xl mb-1">Password updated</div>
            <p className="text-white/65 text-sm">Redirecting to sign-in…</p>
          </div>
        ) : (
          <form onSubmit={submit}>
            <Field label="New Password" value={pw} onChange={setPw} testId="reset-pw" />
            <div className="h-3" />
            <Field label="Confirm New Password" value={pw2} onChange={setPw2} testId="reset-pw2" />
            {err && <div className="text-red-400 text-sm mt-3">{err}</div>}
            <button disabled={busy} data-testid="reset-submit"
              className="w-full mt-6 bg-amber-400 hover:bg-amber-300 text-[#0B132B] font-semibold py-3.5 rounded-full transition disabled:opacity-60">
              {busy ? "Updating…" : "Update Password"}
            </button>
            <div className="text-center text-white/60 text-sm mt-5">
              <Link to="/login" className="text-amber-400 hover:text-amber-300">← Back to sign in</Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, testId }) {
  return (
    <label className="block">
      <span className="text-[10px] tracking-[0.2em] uppercase text-white/55 mb-1.5 block">{label}</span>
      <div className="relative">
        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-400" />
        <input type="password" required value={value} onChange={(e) => onChange(e.target.value)} data-testid={testId}
          className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-3.5 text-white text-sm focus:border-amber-400 outline-none" />
      </div>
    </label>
  );
}
