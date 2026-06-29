import React, { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { Plane, Lock, CheckCircle2 } from "lucide-react";
import PasswordField from "../components/PasswordField";

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
            <div className="font-serif-display text-2xl text-[#0B132B]">Set a new password</div>
            <div className="text-[#0B132B]/60 text-xs">Choose at least 6 characters</div>
          </div>
        </div>

        {!token ? (
          <div className="text-red-400 text-sm">Missing reset token. Please request a new reset link.</div>
        ) : done ? (
          <div className="glass-light rounded-2xl p-8 text-center border border-emerald-400/30">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
            <div className="text-[#0B132B] font-serif-display text-2xl mb-1">Password updated</div>
            <p className="text-[#0B132B]/70 text-sm">Redirecting to sign-in…</p>
          </div>
        ) : (
          <form onSubmit={submit}>
            <PasswordField label="New Password" value={pw} onChange={setPw} testId="reset-pw" autoComplete="new-password" />
            <div className="h-3" />
            <PasswordField label="Confirm New Password" value={pw2} onChange={setPw2} testId="reset-pw2" autoComplete="new-password" />
            {err && <div className="text-red-400 text-sm mt-3">{err}</div>}
            <button disabled={busy} data-testid="reset-submit"
              className="w-full mt-6 bg-amber-400 hover:bg-amber-300 text-[#0B132B] font-semibold py-3.5 rounded-full transition disabled:opacity-60">
              {busy ? "Updating…" : "Update Password"}
            </button>
            <div className="text-center text-[#0B132B]/65 text-sm mt-5">
              <Link to="/login" className="text-amber-700 hover:text-amber-600">← Back to sign in</Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
