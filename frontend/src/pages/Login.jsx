import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Plane, Mail, Lock, Phone } from "lucide-react";
import PasswordField from "../components/PasswordField";

const HERO = "https://images.unsplash.com/photo-1556388158-158ea5ccacbd?w=1920&q=85";

export default function Login() {
  const [params] = useSearchParams();
  const next = params.get("next") || "/account";
  const { login } = useAuth();
  const nav = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [loginMode, setLoginMode] = useState("email"); // "email" or "mobile"
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      // The login() helper accepts email; we pass identifier and let backend detect mobile vs email.
      // Build raw axios call here since helper signature is (email, password).
      const payload = loginMode === "mobile"
        ? { mobile: identifier, password: pw }
        : { email: identifier, password: pw };
      const resp = await (await import("../lib/api")).api.post("/auth/login", payload);
      localStorage.setItem("av_token", resp.data.access_token);
      localStorage.setItem("av_user", JSON.stringify(resp.data.user));
      const user = resp.data.user;
      // Hard reload so AuthProvider picks up token immediately
      window.location.href = user.role === "admin" ? "/admin"
        : user.role === "pilot" ? "/pilot"
        : user.role === "crew" ? "/crew"
        : next;
    } catch (e) {
      setErr(e?.response?.data?.detail || "Login failed");
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen pt-20 flex" data-testid="login-page">
      <div className="hidden lg:block lg:w-1/2 relative">
        <img src={HERO} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-br from-[#0B132B]/95 via-[#0B132B]/60 to-transparent" />
        <div className="absolute inset-0 p-16 flex flex-col justify-end">
          <div className="text-amber-300 text-xs tracking-[0.3em] uppercase mb-4">AeroVista Airlines</div>
          <h2 className="font-serif-display text-5xl text-white leading-tight">Welcome back to luxury.</h2>
          <p className="text-white/75 mt-3 max-w-md">Manage bookings, earn SkyChip points, and access exclusive offers.</p>
        </div>
      </div>

      <div className="w-full lg:w-1/2 grid place-items-center px-6 py-16 bg-[#FAF8F2]">
        <form onSubmit={submit} className="w-full max-w-md">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-full av-bg-gold grid place-items-center">
              <Plane className="w-5 h-5 text-[#0B132B]" />
            </div>
            <div>
              <div className="font-serif-display text-2xl text-[#0B132B]">Sign in</div>
              <div className="text-[#0B132B]/65 text-xs">to your AeroVista account</div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex gap-2 bg-amber-50 border border-amber-200 rounded-full p-1" data-testid="login-mode-tabs">
              <button type="button" onClick={() => setLoginMode("email")} data-testid="mode-email"
                className={`flex-1 py-2 rounded-full text-xs font-medium transition ${loginMode === "email" ? "bg-[#0B132B] text-amber-300" : "text-[#0B132B]/65 hover:text-[#0B132B]"}`}>
                Email
              </button>
              <button type="button" onClick={() => setLoginMode("mobile")} data-testid="mode-mobile"
                className={`flex-1 py-2 rounded-full text-xs font-medium transition ${loginMode === "mobile" ? "bg-[#0B132B] text-amber-300" : "text-[#0B132B]/65 hover:text-[#0B132B]"}`}>
                Mobile Number
              </button>
            </div>
            <Field icon={loginMode === "mobile" ? Phone : Mail}
              label={loginMode === "mobile" ? "Mobile Number (with country code)" : "Email"}
              type={loginMode === "mobile" ? "tel" : "email"}
              value={identifier} onChange={setIdentifier} testId="login-email" />
            <PasswordField label="Password" value={pw} onChange={setPw} testId="login-password" autoComplete="current-password" />
          </div>

          {err && <div className="text-red-700 text-sm mt-3 bg-red-100 border border-red-300 rounded-lg px-3 py-2" data-testid="login-error">{err}</div>}

          <button disabled={busy} data-testid="login-submit"
            className="w-full mt-6 bg-amber-400 hover:bg-amber-300 text-[#0B132B] font-semibold py-3.5 rounded-full transition disabled:opacity-60">
            {busy ? "Signing in…" : "Sign In"}
          </button>

          <div className="text-center text-[#0B132B]/65 text-sm mt-5">
            New to AeroVista? <Link to="/register" className="text-amber-700 hover:text-amber-600 font-medium">Create account</Link>
          </div>
          <div className="text-center text-[#0B132B]/55 text-xs mt-2">
            <Link to="/forgot-password" data-testid="forgot-link" className="hover:text-amber-600 transition">Forgot password?</Link>
          </div>

          <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs">
            <div className="text-amber-700 mb-3 tracking-[0.2em] uppercase font-semibold">Demo credentials — click to use</div>
            <div className="space-y-2">
              {[
                ["admin@aerovista.com", "Admin@123", "Admin"],
                ["pilot@aerovista.com", "Pilot@123", "Pilot"],
                ["crew@aerovista.com", "Crew@123", "Crew"],
                ["customer@aerovista.com", "Customer@123", "Customer"],
              ].map(([em, pwd, label]) => (
                <button type="button" key={em} data-testid={`demo-${label.toLowerCase()}`}
                  onClick={() => { setIdentifier(em); setPw(pwd); setLoginMode("email"); }}
                  className="w-full flex items-center justify-between bg-white hover:bg-amber-100 border border-amber-200 hover:border-amber-400 rounded-lg px-3 py-2 transition group">
                  <div className="text-left">
                    <div className="text-[#0B132B] font-medium">{label}</div>
                    <div className="text-[#0B132B]/60 font-mono-aero text-[10px]">{em}</div>
                  </div>
                  <div className="text-amber-700 text-[10px] font-mono-aero opacity-0 group-hover:opacity-100 transition">
                    Click to fill
                  </div>
                </button>
              ))}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ icon: Icon, label, value, onChange, type = "text", testId }) {
  return (
    <label className="block">
      <span className="text-[10px] tracking-[0.2em] uppercase text-[#0B132B]/55 mb-1.5 block">{label}</span>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-600" />
        <input type={type} required value={value} onChange={(e) => onChange(e.target.value)} data-testid={testId}
          className="w-full bg-white border border-slate-300 rounded-lg pl-10 pr-4 py-3.5 text-[#0B132B] text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-200 outline-none transition" />
      </div>
    </label>
  );
}
