import React, { useState } from "react";
import { Lock, Eye, EyeOff } from "lucide-react";

/**
 * Password input with show/hide toggle.
 * Props: label, value, onChange, testId, required (default true), icon (default Lock)
 */
export default function PasswordField({
  label = "Password",
  value,
  onChange,
  testId,
  required = true,
  autoComplete = "current-password",
  icon: Icon = Lock,
}) {
  const [show, setShow] = useState(false);
  return (
    <label className="block">
      <span className="text-[10px] tracking-[0.2em] uppercase text-white/55 mb-1.5 block">{label}</span>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-400" />
        <input
          type={show ? "text" : "password"}
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          data-testid={testId}
          className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-11 py-3.5 text-white text-sm focus:border-amber-400 outline-none"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          data-testid={testId ? `${testId}-toggle` : "password-toggle"}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/55 hover:text-amber-400 transition p-1"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </label>
  );
}
