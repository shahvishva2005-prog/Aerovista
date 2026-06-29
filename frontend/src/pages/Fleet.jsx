import React from "react";
import PageShell from "../components/PageShell";

const FLEET = [
  { name: "Boeing 787-9 Dreamliner", img: "https://images.unsplash.com/photo-1529074963764-98f45c47344b?w=1600&q=85",
    capacity: 290, range: "14,140 km", role: "Long-haul Wide-body", units: 8 },
  { name: "Airbus A350-900", img: "https://images.pexels.com/photos/1493756/pexels-photo-1493756.jpeg?auto=compress&cs=tinysrgb&w=1600",
    capacity: 325, range: "15,000 km", role: "Ultra Long-haul", units: 6 },
  { name: "Boeing 777-300ER", img: "https://images.unsplash.com/photo-1556388158-158ea5ccacbd?w=1600&q=85",
    capacity: 396, range: "13,650 km", role: "Long-haul Wide-body", units: 9 },
  { name: "Airbus A320neo", img: "https://images.unsplash.com/photo-1542296332-2e4473faf563?w=1600&q=85",
    capacity: 186, range: "6,500 km", role: "Short to Medium-haul", units: 32 },
  { name: "Boeing 737-800", img: "https://images.unsplash.com/photo-1583416750470-965b2707b355?w=1600&q=85",
    capacity: 180, range: "5,400 km", role: "Domestic Workhorse", units: 30 },
];

export default function Fleet() {
  return (
    <PageShell title="Our Fleet" subtitle="85+ aircraft engineered for safety, sustainability and comfort." testId="fleet-page"
      bgUrl="https://images.unsplash.com/photo-1529074963764-98f45c47344b?w=1920&q=85">
      <div className="grid lg:grid-cols-2 gap-6">
        {FLEET.map((f) => (
          <div key={f.name} className="glass-light rounded-2xl overflow-hidden border border-[#E5E1D6]" data-testid={`fleet-${f.name.replace(/\s+/g, "-")}`}>
            <div className="h-64 overflow-hidden">
              <img src={f.img} alt={f.name} className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" />
            </div>
            <div className="p-6">
              <div className="text-amber-700 text-[10px] tracking-[0.3em] uppercase mb-2">{f.role}</div>
              <h3 className="font-serif-display text-3xl text-[#0B132B] mb-4">{f.name}</h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div><div className="font-serif-display text-2xl av-text-gold-grad">{f.capacity}</div><div className="text-[#0B132B]/60 text-xs uppercase">Seats</div></div>
                <div><div className="font-serif-display text-2xl av-text-gold-grad">{f.range}</div><div className="text-[#0B132B]/60 text-xs uppercase">Range</div></div>
                <div><div className="font-serif-display text-2xl av-text-gold-grad">{f.units}</div><div className="text-[#0B132B]/60 text-xs uppercase">Units</div></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </PageShell>
  );
}
