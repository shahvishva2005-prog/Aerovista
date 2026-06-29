import React from "react";
import PageShell from "../components/PageShell";

const JOBS = [
  { title: "First Officer (A320neo)", loc: "Delhi", type: "Full-time", team: "Flight Operations" },
  { title: "Cabin Senior", loc: "Mumbai", type: "Full-time", team: "Inflight Services" },
  { title: "Aircraft Maintenance Engineer", loc: "Bengaluru", type: "Full-time", team: "Engineering" },
  { title: "Customer Experience Lead", loc: "Delhi", type: "Full-time", team: "Customer Care" },
  { title: "Network Planning Analyst", loc: "Delhi", type: "Full-time", team: "Strategy" },
  { title: "Sustainability Lead", loc: "Remote", type: "Full-time", team: "ESG" },
];

export default function Careers() {
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
              <button className="bg-amber-400 hover:bg-amber-300 text-[#0B132B] font-semibold px-5 py-2 rounded-full text-sm transition">Apply</button>
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
