import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Plane, Award, Globe, ShieldCheck, Sparkles, Star, ArrowRight, MapPin } from "lucide-react";
import FlightSearchWidget from "../components/FlightSearchWidget";
import { api } from "../lib/api";

const HERO_IMG = "https://images.unsplash.com/photo-1687885461404-5ab0c1aa4ad9?crop=entropy&cs=srgb&fm=jpg&w=1920&q=85";

const DESTINATIONS = [
  { code: "DXB", city: "Dubai", country: "United Arab Emirates", img: "https://images.pexels.com/photos/18341554/pexels-photo-18341554.jpeg?auto=compress&cs=tinysrgb&w=940", span: "md:col-span-5 md:row-span-2" },
  { code: "LHR", city: "London", country: "United Kingdom", img: "https://images.unsplash.com/photo-1549483249-f0b359d1e289?w=1200&q=85", span: "md:col-span-4" },
  { code: "SIN", city: "Singapore", country: "Singapore", img: "https://images.pexels.com/photos/18280158/pexels-photo-18280158.jpeg?auto=compress&cs=tinysrgb&w=940", span: "md:col-span-3" },
  { code: "NRT", city: "Tokyo", country: "Japan", img: "https://images.pexels.com/photos/35072454/pexels-photo-35072454.jpeg?auto=compress&cs=tinysrgb&w=940", span: "md:col-span-3" },
  { code: "CDG", city: "Paris", country: "France", img: "https://images.pexels.com/photos/14763491/pexels-photo-14763491.jpeg?auto=compress&cs=tinysrgb&w=940", span: "md:col-span-4" },
  { code: "JFK", city: "New York", country: "USA", img: "https://images.pexels.com/photos/8569166/pexels-photo-8569166.jpeg?auto=compress&cs=tinysrgb&w=940", span: "md:col-span-5" },
  { code: "BOM", city: "Mumbai", country: "India", img: "https://images.pexels.com/photos/28390915/pexels-photo-28390915.jpeg?auto=compress&cs=tinysrgb&w=940", span: "md:col-span-4" },
  { code: "DEL", city: "Delhi", country: "India", img: "https://images.unsplash.com/photo-1587474260584-136574528ed5?w=1200&q=85", span: "md:col-span-3" },
];

const FLEET = [
  { name: "Boeing 787-9 Dreamliner", desc: "Ultra-long-haul wide-body flagship.", img: "https://images.unsplash.com/photo-1529074963764-98f45c47344b?w=1600&q=85" },
  { name: "Airbus A350-900", desc: "Carbon-fibre fuselage. Whisper-quiet cabin.", img: "https://images.pexels.com/photos/1493756/pexels-photo-1493756.jpeg?auto=compress&cs=tinysrgb&w=1600" },
  { name: "Boeing 777-300ER", desc: "Three-class long-haul workhorse.", img: "https://images.unsplash.com/photo-1556388158-158ea5ccacbd?w=1600&q=85" },
  { name: "Airbus A320neo", desc: "Best-in-class fuel efficiency.", img: "https://images.unsplash.com/photo-1542296332-2e4473faf563?w=1600&q=85" },
  { name: "Boeing 737-800", desc: "Reliable narrow-body across India.", img: "https://images.unsplash.com/photo-1583416750470-965b2707b355?w=1600&q=85" },
];

const OFFERS = [
  { tag: "Credit Card", title: "HDFC Diners Privilege", desc: "Flat 10% off + 2X SkyChip points on Business class.", color: "from-amber-500/20 to-amber-400/5", code: "HDFC10" },
  { tag: "Loyalty", title: "Platinum Companion Fare", desc: "Bring a companion at 50% on long-haul routes.", color: "from-purple-500/20 to-purple-400/5", code: "PLAT50" },
  { tag: "Business", title: "Upgrade for ₹4,999", desc: "Business class upgrade on select Gulf routes.", color: "from-sky-500/20 to-sky-400/5", code: "UPG4999" },
  { tag: "Festival", title: "Diwali Skyfare", desc: "Up to 25% off domestic + ₹500 cashback.", color: "from-rose-500/20 to-rose-400/5", code: "DIWALI25" },
];

const TESTIMONIALS = [
  { name: "Ananya Roy", role: "Frequent Flyer • Gold", text: "AeroVista feels like the airline of the future — every detail considered. The cabin crew remembered my meal preference on the third trip in a row." },
  { name: "Marcus Reuter", role: "Business Traveler", text: "Punctuality and a business cabin that genuinely feels premium. The 787 Dreamliner experience is unmatched on the Frankfurt-Delhi route." },
  { name: "Sara Al-Mansoori", role: "Travel Writer", text: "From booking to baggage, friction is absent. AeroVista has set a new bar for South-Asian luxury aviation." },
];

export default function Home() {
  const [stats, setStats] = useState({});

  useEffect(() => {
    api.get("/stats").then((r) => setStats(r.data)).catch(() => {});
  }, []);

  return (
    <div data-testid="home-page">
      {/* HERO */}
      <section className="relative min-h-screen flex flex-col">
        <div className="absolute inset-0">
          <img src={HERO_IMG} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 hero-overlay" />
        </div>

        <div className="relative flex-1 flex items-center pt-20">
          <div className="max-w-[1400px] mx-auto w-full px-6 lg:px-12 py-16">
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9 }}>
              <div className="text-amber-400 text-xs tracking-[0.4em] uppercase mb-5">AeroVista Airlines • Est. 2025</div>
              <h1 className="font-serif-display text-5xl md:text-7xl lg:text-8xl font-light leading-[1.05] text-white tracking-tight max-w-5xl">
                Experience <span className="av-text-gold-grad italic">World-Class</span><br />Aviation
              </h1>
              <p className="text-white/75 text-lg md:text-xl mt-6 max-w-2xl font-light leading-relaxed">
                Connecting over 120 destinations worldwide with a fleet of 85+ modern aircraft, crafted for travellers who expect more.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/search" data-testid="hero-book-flight" className="bg-amber-400 hover:bg-amber-300 text-[#0B132B] font-semibold px-7 py-3.5 rounded-full inline-flex items-center gap-2 transition">
                  Book Flight <ArrowRight className="w-4 h-4" />
                </Link>
                <Link to="/track" data-testid="hero-track-flight" className="glass-light hover:bg-white/15 text-white px-7 py-3.5 rounded-full transition">Track Flight</Link>
                <Link to="/checkin" data-testid="hero-checkin" className="glass-light hover:bg-white/15 text-white px-7 py-3.5 rounded-full transition">Web Check-In</Link>
                <Link to="/offers" data-testid="hero-offers" className="glass-light hover:bg-white/15 text-white px-7 py-3.5 rounded-full transition">View Offers</Link>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Search Widget overlapping */}
        <div className="relative max-w-[1400px] mx-auto w-full px-6 lg:px-12 pb-16 mt-4">
          <FlightSearchWidget />
        </div>
      </section>

      {/* STATS */}
      <section className="av-section-pad bg-[#0B132B]">
        <div className="max-w-[1400px] mx-auto">
          <div className="text-amber-400 text-xs tracking-[0.3em] uppercase mb-4">By the numbers</div>
          <h2 className="font-serif-display text-4xl md:text-5xl text-white mb-12 max-w-3xl font-light">A scale that speaks for itself.</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/5">
            {[
              ["Passengers Served", stats.passengers || "2.5M+"],
              ["Flights Completed", stats.flights_completed || "185,000+"],
              ["Aircraft", stats.aircraft || "85+"],
              ["Pilots", stats.pilots || "320+"],
              ["Cabin Crew", stats.cabin_crew || "780+"],
              ["Countries", stats.countries || "45+"],
              ["Destinations", stats.destinations || "120+"],
              ["Satisfaction", stats.satisfaction || "98.7%"],
            ].map(([label, val]) => (
              <div key={label} className="bg-[#0B132B] p-8 group hover:bg-[#0F1A3A] transition">
                <div className="font-serif-display text-4xl md:text-5xl av-text-gold-grad font-light mb-2">{val}</div>
                <div className="text-white/60 text-xs tracking-[0.2em] uppercase">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DESTINATIONS - Bento */}
      <section className="av-section-pad bg-[#080E21]">
        <div className="max-w-[1400px] mx-auto">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-12">
            <div>
              <div className="text-amber-400 text-xs tracking-[0.3em] uppercase mb-4">Popular Destinations</div>
              <h2 className="font-serif-display text-4xl md:text-5xl text-white font-light">Where will you go next?</h2>
            </div>
            <Link to="/destinations" className="text-amber-400 hover:text-amber-300 inline-flex items-center gap-2">
              All destinations <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-8 gap-4 md:gap-5 auto-rows-[220px]">
            {DESTINATIONS.map((d, i) => (
              <Link key={d.code} to={`/search?origin=DEL&destination=${d.code}`}
                data-testid={`dest-${d.code}`}
                className={`group relative rounded-2xl overflow-hidden ${d.span}`}>
                <img src={d.img} alt={d.city} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                <div className="absolute bottom-0 left-0 p-6">
                  <div className="text-amber-300 text-[10px] tracking-[0.3em] uppercase mb-1">{d.country}</div>
                  <div className="font-serif-display text-3xl text-white">{d.city}</div>
                  <div className="text-white/50 text-xs mt-1 font-mono-aero">{d.code}</div>
                </div>
                <div className="absolute top-4 right-4 w-9 h-9 rounded-full glass-light grid place-items-center opacity-0 group-hover:opacity-100 transition">
                  <ArrowRight className="w-4 h-4 text-amber-400" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* OFFERS */}
      <section className="av-section-pad bg-[#0B132B]">
        <div className="max-w-[1400px] mx-auto">
          <div className="text-amber-400 text-xs tracking-[0.3em] uppercase mb-4">Special Offers</div>
          <h2 className="font-serif-display text-4xl md:text-5xl text-white font-light mb-12">Curated savings for our guests.</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {OFFERS.map((o) => (
              <div key={o.title} className={`rounded-2xl p-7 bg-gradient-to-br ${o.color} border border-white/10 hover:border-amber-400/50 transition`}>
                <div className="text-amber-400 text-[10px] tracking-[0.3em] uppercase mb-4">{o.tag}</div>
                <h3 className="font-serif-display text-2xl text-white mb-2">{o.title}</h3>
                <p className="text-white/65 text-sm font-light mb-5">{o.desc}</p>
                <div className="font-mono-aero text-xs text-amber-300 bg-amber-400/10 inline-block px-3 py-1 rounded-full">Code: {o.code}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FLEET */}
      <section className="av-section-pad bg-[#080E21]">
        <div className="max-w-[1400px] mx-auto">
          <div className="text-amber-400 text-xs tracking-[0.3em] uppercase mb-4">Our Fleet</div>
          <h2 className="font-serif-display text-4xl md:text-5xl text-white font-light mb-12">Engineered for unforgettable journeys.</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FLEET.map((f) => (
              <div key={f.name} className="rounded-2xl overflow-hidden bg-[#0B132B] border border-white/5 group">
                <div className="h-48 overflow-hidden">
                  <img src={f.img} alt={f.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                </div>
                <div className="p-6">
                  <h3 className="font-serif-display text-xl text-white mb-2">{f.name}</h3>
                  <p className="text-white/55 text-sm font-light">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHY US */}
      <section className="av-section-pad bg-[#0B132B] border-y border-white/5">
        <div className="max-w-[1400px] mx-auto grid lg:grid-cols-4 gap-10">
          {[
            { Icon: Award, t: "Award-Winning", d: "World Travel Awards 2024 — Best Luxury Airline in Asia." },
            { Icon: Globe, t: "Global Reach", d: "120+ destinations across 6 continents." },
            { Icon: ShieldCheck, t: "Safety First", d: "7-star IATA safety rating across the fleet." },
            { Icon: Sparkles, t: "SkyChip Loyalty", d: "Earn miles, redeem on flights, hotels, dining." },
          ].map(({ Icon, t, d }) => (
            <div key={t} className="flex gap-4">
              <div className="w-12 h-12 rounded-full av-bg-gold grid place-items-center shrink-0">
                <Icon className="w-5 h-5 text-[#0B132B]" />
              </div>
              <div>
                <h3 className="font-serif-display text-2xl text-white mb-2">{t}</h3>
                <p className="text-white/60 text-sm font-light">{d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="av-section-pad bg-[#080E21]">
        <div className="max-w-[1400px] mx-auto">
          <div className="text-amber-400 text-xs tracking-[0.3em] uppercase mb-4">Stories from the cabin</div>
          <h2 className="font-serif-display text-4xl md:text-5xl text-white font-light mb-12 max-w-3xl">
            Trusted by millions, beloved by frequent flyers.
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="glass-light rounded-2xl p-7">
                <div className="flex gap-1 mb-5 text-amber-400">
                  {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 fill-amber-400" />)}
                </div>
                <p className="text-white/80 font-light leading-relaxed mb-6">"{t.text}"</p>
                <div>
                  <div className="text-white font-medium">{t.name}</div>
                  <div className="text-amber-400 text-xs">{t.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA - Mobile app */}
      <section className="av-section-pad bg-gradient-to-br from-[#0B132B] via-[#1C2541] to-[#0B132B]">
        <div className="max-w-[1400px] mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="text-amber-400 text-xs tracking-[0.3em] uppercase mb-4">Mobile App</div>
            <h2 className="font-serif-display text-4xl md:text-5xl text-white font-light mb-5">
              Your sky, in your pocket.
            </h2>
            <p className="text-white/65 font-light text-lg leading-relaxed mb-7">
              Manage bookings, store boarding passes, track real-time flight status, and earn SkyChip points — all in one elegant app.
            </p>
            <div className="flex gap-3">
              <div className="glass-light rounded-xl px-5 py-3 flex items-center gap-3">
                <Plane className="w-5 h-5 text-amber-400" />
                <div>
                  <div className="text-[10px] text-white/50 uppercase">Coming Soon</div>
                  <div className="text-white text-sm">App Store</div>
                </div>
              </div>
              <div className="glass-light rounded-xl px-5 py-3 flex items-center gap-3">
                <Plane className="w-5 h-5 text-amber-400" />
                <div>
                  <div className="text-[10px] text-white/50 uppercase">Coming Soon</div>
                  <div className="text-white text-sm">Google Play</div>
                </div>
              </div>
            </div>
          </div>
          <div className="rounded-3xl glass p-10 flex items-center justify-center">
            <div className="w-full max-w-sm aspect-[9/16] rounded-3xl bg-gradient-to-b from-[#0B132B] to-[#1C2541] border border-amber-400/30 p-6">
              <div className="text-amber-400 text-xs tracking-[0.3em] uppercase">Boarding Pass</div>
              <div className="font-serif-display text-3xl text-white mt-1">DEL → DXB</div>
              <div className="text-white/50 text-xs mt-1">AV1042 • 14:30</div>
              <div className="mt-8 bg-white rounded-xl aspect-square grid place-items-center">
                <div className="w-32 h-32 bg-[#0B132B] grid place-items-center text-amber-400 text-3xl">⌘</div>
              </div>
              <div className="mt-6 flex justify-between text-white">
                <div><div className="text-[10px] text-white/40 uppercase">Seat</div><div className="font-serif-display text-xl">12A</div></div>
                <div><div className="text-[10px] text-white/40 uppercase">Gate</div><div className="font-serif-display text-xl">B07</div></div>
                <div><div className="text-[10px] text-white/40 uppercase">Class</div><div className="font-serif-display text-xl">BUS</div></div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
