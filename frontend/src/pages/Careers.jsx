import React, { useState } from "react";
import PageShell from "../components/PageShell";
import { api } from "../lib/api";
import { Send, Upload, X } from "lucide-react";

const JOBS = [
  { title: "First Officer (A320neo)", loc: "Delhi", type: "Full-time", team: "Flight Operations" },
  { title: "Cabin Senior", loc: "Mumbai", type: "Full-time", team: "Inflight Services" },
  { title: "Aircraft Maintenance Engineer", loc: "Bengaluru", type: "Full-time", team: "Engineering" },
  { title: "Customer Experience Lead", loc: "Delhi", type: "Full-time", team: "Customer Care" },
  { title: "Network Planning Analyst", loc: "Delhi", type: "Full-time", team: "Strategy" },
  { title: "Sustainability Lead", loc: "Remote", type: "Full-time", team: "ESG" },
];

export default function Careers() {
  const [openJob, setOpenJob] = useState(null);

  return (
    <PageShell title="Careers" subtitle="Build the airline of tomorrow. Above and beyond." testId="careers-page"
      bgUrl="https://images.pexels.com/photos/30812970/pexels-photo-30812970.jpeg?auto=compress&cs=tinysrgb&w=1920">
      <div className="grid lg:grid-cols-3 gap-8">
        <aside className="space-y-4">
          <div className="glass-light rounded-2xl p-6">
            <div className="text-amber-700 text-[10px] tracking-[0.3em] uppercase mb-3">Why AeroVista</div>
            <ul className="space-y-2 text-[#0B132B]/75 text-sm font-light">
              <li>• Global mobility across 120+ destinations</li>
              <li>• Best-in-class training academy</li>
              <li>• Industry-leading SkyChip benefits</li>
              <li>• Carbon-conscious operations</li>
            </ul>
          </div>
        </aside>
        <div className="lg:col-span-2 space-y-3">
          {JOBS.map((j, i) => (
            <div key={i} className="glass-light rounded-2xl p-6 flex items-center justify-between" data-testid={`job-${i}`}>
              <div>
                <h3 className="font-serif-display text-xl text-[#0B132B]">{j.title}</h3>
                <div className="text-[#0B132B]/60 text-xs mt-1">{j.team} • {j.loc} • {j.type}</div>
              </div>
              <button onClick={() => setOpenJob(j)} data-testid={`job-apply-${i}`}
                className="bg-amber-400 hover:bg-amber-300 text-[#0B132B] font-semibold px-5 py-2 rounded-full text-sm transition">
                Apply
              </button>
            </div>
          ))}
        </div>
      </div>

      {openJob && <ApplyModal job={openJob} onClose={() => setOpenJob(null)} />}
    </PageShell>
  );
}

function ApplyModal({ job, onClose }) {
  const [form, setForm] = useState({
    name: "", email: "", mobile: "", experience_years: 0, current_company: "",
    cover_letter: "",
  });
  const [resume, setResume] = useState(null);
  const [resumeName, setResumeName] = useState("");
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState("");
  const [err, setErr] = useState("");

  const readFile = (file) => {
    setErr("");
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setErr("Resume must be ≤ 5MB"); return; }
    if (!/pdf|msword|wordprocessingml/.test(file.type) && !/\.(pdf|doc|docx)$/i.test(file.name)) {
      setErr("Resume must be PDF or Word format"); return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = String(reader.result || "").split(",")[1] || "";
      setResume(b64); setResumeName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setOk(""); setErr("");
    try {
      if (!form.cover_letter.trim()) throw new Error("Please add a cover letter");
      await api.post("/careers/apply", {
        ...form, role_applied: job.title,
        experience_years: Number(form.experience_years || 0),
        resume_filename: resumeName, resume_base64: resume || "",
      });
      setOk("Application received! We've emailed you a confirmation.");
      setForm({ name: "", email: "", mobile: "", experience_years: 0, current_company: "", cover_letter: "" });
      setResume(null); setResumeName("");
    } catch (e) {
      setErr(e?.response?.data?.detail || e.message || "Could not submit application");
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#0B132B]/60 backdrop-blur-sm grid place-items-center p-4" data-testid="apply-modal">
      <form onSubmit={submit} className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between p-6 border-b border-[#E5E1D6]">
          <div>
            <div className="text-amber-700 text-[10px] tracking-[0.3em] uppercase">Apply for</div>
            <h3 className="font-serif-display text-2xl text-[#0B132B]">{job.title}</h3>
            <div className="text-[#0B132B]/60 text-xs mt-1">{job.team} • {job.loc} • {job.type}</div>
          </div>
          <button type="button" onClick={onClose} data-testid="apply-close"
            className="text-[#0B132B]/55 hover:text-[#0B132B] transition"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-3">
          <div className="grid md:grid-cols-2 gap-3">
            <F label="Full Name *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} testId="apply-name" required />
            <F label="Email *" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} testId="apply-email" required />
            <F label="Mobile *" value={form.mobile} onChange={(v) => setForm({ ...form, mobile: v })} testId="apply-mobile" required />
            <F label="Years of Experience" type="number" value={form.experience_years}
              onChange={(v) => setForm({ ...form, experience_years: v })} testId="apply-years" />
            <F label="Current Company" col="md:col-span-2" value={form.current_company}
              onChange={(v) => setForm({ ...form, current_company: v })} testId="apply-company" />
          </div>
          <div>
            <div className="text-[10px] tracking-[0.2em] uppercase text-[#0B132B]/60 mb-1.5">Cover Letter *</div>
            <textarea required rows={5} value={form.cover_letter} onChange={(e) => setForm({ ...form, cover_letter: e.target.value })}
              data-testid="apply-cover"
              placeholder="Tell us why you'd be a great fit…"
              className="w-full bg-[#0B132B]/5 border border-[#E5E1D6] rounded-lg px-4 py-3 text-[#0B132B] text-sm focus:border-amber-400 outline-none" />
          </div>
          <div>
            <div className="text-[10px] tracking-[0.2em] uppercase text-[#0B132B]/60 mb-1.5">Resume (PDF / Word, ≤5MB)</div>
            <label className="flex items-center gap-3 p-3 border border-dashed border-amber-300 rounded-xl bg-amber-50 hover:bg-amber-100 cursor-pointer transition">
              <Upload className="w-4 h-4 text-amber-700" />
              <div className="text-sm text-[#0B132B]">
                {resumeName || "Click to upload your resume"}
              </div>
              <input type="file" accept=".pdf,.doc,.docx" data-testid="apply-resume"
                onChange={(e) => readFile(e.target.files?.[0])} className="hidden" />
            </label>
          </div>

          {err && <div className="text-red-600 text-sm">{err}</div>}
          {ok && <div className="text-emerald-700 text-sm">{ok}</div>}

          <button type="submit" disabled={busy} data-testid="apply-submit"
            className="w-full bg-amber-400 hover:bg-amber-300 text-[#0B132B] font-semibold py-3 rounded-full inline-flex items-center justify-center gap-2 transition disabled:opacity-60">
            <Send className="w-4 h-4" /> {busy ? "Submitting…" : "Submit Application"}
          </button>
          <div className="text-[11px] text-[#0B132B]/55 text-center">
            Your application is emailed to AeroVista People & Culture (airlinesaerovista@gmail.com).
          </div>
        </div>
      </form>
    </div>
  );
}

function F({ label, value, onChange, type = "text", required, testId, col = "" }) {
  return (
    <label className={`block ${col}`}>
      <span className="text-[10px] tracking-[0.2em] uppercase text-[#0B132B]/60 mb-1.5 block">{label}</span>
      <input type={type} value={value} required={required}
        onChange={(e) => onChange(e.target.value)} data-testid={testId}
        className="w-full bg-[#0B132B]/5 border border-[#E5E1D6] rounded-lg px-4 py-3 text-[#0B132B] text-sm focus:border-amber-400 outline-none" />
    </label>
  );
}
