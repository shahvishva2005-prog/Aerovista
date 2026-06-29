import React from "react";
import PageShell from "../components/PageShell";

export default function About() {
  return (
    <PageShell title="About AeroVista" subtitle="Connecting Horizons, Delivering Excellence." testId="about-page"
      bgUrl="https://images.unsplash.com/photo-1556388158-158ea5ccacbd?w=1920&q=85">
      <div className="grid lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-6 text-[#0B132B]/75 font-light text-lg leading-relaxed">
          <p>Founded with a singular ambition — to redefine premium aviation for the modern traveller — AeroVista Airlines operates a fleet of 85+ next-generation aircraft to over 120 destinations across six continents.</p>
          <p>From our flagship Boeing 787 Dreamliners to the whisper-quiet Airbus A350, every cabin is engineered for comfort. Our crews are trained at our state-of-the-art academy in Delhi, where excellence is not a goal — it is a baseline.</p>
          <p>We carry over 2.5 million passengers annually with a customer satisfaction rating of 98.7%, and have been recognized at the World Travel Awards 2024 for service excellence.</p>
        </div>
        <div className="glass-light rounded-2xl p-7">
          <div className="text-amber-700 text-[10px] tracking-[0.3em] uppercase mb-4">At a glance</div>
          <ul className="space-y-3 text-[#0B132B]/82 text-sm">
            <li className="flex justify-between"><span className="text-[#0B132B]/55">Headquartered</span><span>Delhi, India</span></li>
            <li className="flex justify-between"><span className="text-[#0B132B]/55">Founded</span><span>2025</span></li>
            <li className="flex justify-between"><span className="text-[#0B132B]/55">Fleet Size</span><span>85+</span></li>
            <li className="flex justify-between"><span className="text-[#0B132B]/55">Destinations</span><span>120+</span></li>
            <li className="flex justify-between"><span className="text-[#0B132B]/55">Pilots</span><span>320+</span></li>
            <li className="flex justify-between"><span className="text-[#0B132B]/55">Cabin Crew</span><span>780+</span></li>
            <li className="flex justify-between"><span className="text-[#0B132B]/55">Hub Airports</span><span>DEL, BOM, BLR</span></li>
          </ul>
        </div>
      </div>
    </PageShell>
  );
}
