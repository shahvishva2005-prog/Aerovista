import React from "react";
import PageShell from "../components/PageShell";

const OFFERS = [
  { tag: "Credit Card • HDFC", title: "Diners Privilege • 10% off", desc: "Up to ₹3,000 off on Business and First class.", code: "HDFC10" },
  { tag: "Credit Card • ICICI", title: "Coral / Sapphiro • ₹200 off", desc: "Flat ₹200 instant discount on domestic.", code: "ICICI200" },
  { tag: "Credit Card • Axis", title: "Magnus • 5% off", desc: "Earn 4X EDGE rewards on AeroVista.", code: "AXIS5" },
  { tag: "Credit Card • SBI", title: "SBI Card • ₹500 off", desc: "Flat ₹500 on international long-haul.", code: "SBI500" },
  { tag: "Loyalty", title: "Platinum Companion Fare", desc: "50% off for one companion on long-haul.", code: "PLAT50" },
  { tag: "Business Upgrade", title: "Upgrade for ₹4,999", desc: "Business class on select Gulf routes.", code: "UPG4999" },
  { tag: "Festival", title: "Diwali Skyfare", desc: "25% off domestic + ₹500 cashback.", code: "DIWALI25" },
  { tag: "Festival", title: "Holi Weekend", desc: "Up to 30% off weekend departures.", code: "HOLI30" },
];

export default function Offers() {
  return (
    <PageShell title="Offers" subtitle="Curated savings for our esteemed guests." testId="offers-page"
      bgUrl="https://images.unsplash.com/photo-1542296332-2e4473faf563?w=1920&q=85">
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {OFFERS.map((o) => (
          <div key={o.code} className="glass-light rounded-2xl p-7 border border-[#E5E1D6] hover:border-amber-500/60 transition" data-testid={`offer-${o.code}`}>
            <div className="text-amber-700 text-[10px] tracking-[0.3em] uppercase mb-4">{o.tag}</div>
            <h3 className="font-serif-display text-2xl text-[#0B132B] mb-2">{o.title}</h3>
            <p className="text-[#0B132B]/70 text-sm font-light mb-5">{o.desc}</p>
            <div className="font-mono-aero text-xs text-amber-600 bg-amber-400/10 inline-block px-3 py-1 rounded-full">Code: {o.code}</div>
          </div>
        ))}
      </div>
    </PageShell>
  );
}
