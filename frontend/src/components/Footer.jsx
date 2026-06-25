import React from "react";
import { Link } from "react-router-dom";
import { Plane, Mail, Phone, MapPin, Facebook, Instagram, Twitter, Linkedin } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-[#080E21] border-t border-white/5">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-16 grid md:grid-cols-12 gap-10">
        <div className="md:col-span-4">
          <Link to="/" className="flex items-center gap-3 mb-5">
            <div className="w-12 h-12 rounded-full av-bg-gold flex items-center justify-center">
              <Plane className="w-6 h-6 text-[#0B132B]" />
            </div>
            <div>
              <div className="font-serif-display text-3xl text-white">AeroVista</div>
              <div className="text-[11px] tracking-[0.25em] uppercase text-amber-300/80">Airlines</div>
            </div>
          </Link>
          <p className="text-white/60 font-light leading-relaxed mb-6">
            Connecting Horizons, Delivering Excellence. Award-winning service across 120+ destinations on 6 continents.
          </p>
          <div className="flex gap-3">
            {[Facebook, Instagram, Twitter, Linkedin].map((Icon, i) => (
              <a key={i} href="#" className="w-10 h-10 rounded-full glass-light grid place-items-center hover:av-bg-gold hover:text-[#0B132B] transition">
                <Icon className="w-4 h-4" />
              </a>
            ))}
          </div>
        </div>

        <div className="md:col-span-2">
          <div className="text-amber-400 text-xs tracking-[0.2em] uppercase mb-4">Explore</div>
          <ul className="space-y-2 text-white/70 text-sm">
            <li><Link to="/search">Book Flight</Link></li>
            <li><Link to="/destinations">Destinations</Link></li>
            <li><Link to="/fleet">Our Fleet</Link></li>
            <li><Link to="/offers">Offers</Link></li>
          </ul>
        </div>

        <div className="md:col-span-2">
          <div className="text-amber-400 text-xs tracking-[0.2em] uppercase mb-4">Manage</div>
          <ul className="space-y-2 text-white/70 text-sm">
            <li><Link to="/track">Track Flight</Link></li>
            <li><Link to="/checkin">Web Check-In</Link></li>
            <li><Link to="/account">My Bookings</Link></li>
            <li><Link to="/contact">Refund Status</Link></li>
          </ul>
        </div>

        <div className="md:col-span-4">
          <div className="text-amber-400 text-xs tracking-[0.2em] uppercase mb-4">Customer Care</div>
          <ul className="space-y-3 text-white/70 text-sm">
            <li className="flex items-center gap-3"><Mail className="w-4 h-4 text-amber-400" /> airlinesaerovista@gmail.com</li>
            <li className="flex items-center gap-3"><Phone className="w-4 h-4 text-amber-400" /> +91 1800-AEROVISTA</li>
            <li className="flex items-center gap-3"><MapPin className="w-4 h-4 text-amber-400" /> AeroVista HQ, Delhi, India</li>
          </ul>
          <div className="mt-6">
            <Link to="/careers" className="text-amber-400 text-sm hover:text-amber-300">Careers at AeroVista →</Link>
          </div>
        </div>
      </div>
      <div className="border-t border-white/5 py-5 text-center text-xs text-white/40">
        © {new Date().getFullYear()} AeroVista Airlines • Connecting Horizons, Delivering Excellence
      </div>
    </footer>
  );
}
