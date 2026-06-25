import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Plane, User, Mail, Lock, Phone } from "lucide-react";

const HERO = "https://images.pexels.com/photos/30812970/pexels-photo-30812970.jpeg?auto=compress&cs=tinysrgb&w=1600";

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      await register({ name, email, mobile, password: pw });
      nav("/account");
    } catch (e) {
      setErr(e?.response?.data?.detail || "Registration failed");
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen pt-20 flex" data-testid="register-page">
      <div className="hidden lg:block lg:w-1/2 relative">
        <img src={HERO} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-br from-[#0B132B]/95 via-[#0B132B]/60 to-transparent" />
        <div className="absolute inset-0 p-16 flex flex-col justify-end">
          <div className="text-amber-400 text-xs tracking-[0.3em] uppercase mb-4">Join SkyChip</div>
          <h2 className="font-serif-display text-5xl text-white leading-tight">Begin your journey above the clouds.</h2>
          <p className="text-white/65 mt-3 max-w-md">Earn points on every flight, redeem on upgrades, hotels, and signature experiences.</p>
        </div>
      </div>

      <div className="w-full lg:w-1/2 grid place-items-center px-6 py-16">
        <form onSubmit={submit} className="w-full max-w-md">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-full av-bg-gold grid place-items-center"><Plane className="w-5 h-5 text-[#0B132B]" /></div>
            <div>
              <div className="font-serif-display text-2xl text-white">Create Account</div>
              <div className="text-white/55 text-xs">Free SkyChip membership included</div>
            </div>
          </div>

          <div className="space-y-4">
            <Field icon={User} label="Full Name" value={name} onChange={setName} testId="reg-name" />
            <Field icon={Mail} label="Email" type="email" value={email} onChange={setEmail} testId="reg-email" />
            <Field icon={Phone} label="Mobile" value={mobile} onChange={setMobile} testId="reg-mobile" />
            <Field icon={Lock} label="Password" type="password" value={pw} onChange={setPw} testId="reg-password" />
          </div>

          {err && <div className="text-red-400 text-sm mt-3">{err}</div>}

          <button disabled={busy} data-testid="reg-submit"
            className="w-full mt-6 bg-amber-400 hover:bg-amber-300 text-[#0B132B] font-semibold py-3.5 rounded-full transition disabled:opacity-60">
            {busy ? "Creating…" : "Create Account"}
          </button>

          <div className="text-center text-white/60 text-sm mt-5">
            Already have an account? <Link to="/login" className="text-amber-400 hover:text-amber-300">Sign in</Link>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ icon: Icon, label, value, onChange, type = "text", testId }) {
  return (
    <label className="block">
      <span className="text-[10px] tracking-[0.2em] uppercase text-white/55 mb-1.5 block">{label}</span>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-400" />
        <input type={type} required value={value} onChange={(e) => onChange(e.target.value)} data-testid={testId}
          className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-3.5 text-white text-sm focus:border-amber-400 outline-none" />
      </div>
    </label>
  );
}
