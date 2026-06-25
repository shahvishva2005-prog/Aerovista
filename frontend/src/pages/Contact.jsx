import React, { useState } from "react";
import PageShell from "../components/PageShell";
import { Mail, Phone, MapPin } from "lucide-react";

export default function Contact() {
  const [sent, setSent] = useState(false);
  return (
    <PageShell title="Contact Us" subtitle="We are here for you, 24/7." testId="contact-page"
      bgUrl="https://images.unsplash.com/photo-1542296332-2e4473faf563?w=1920&q=85">
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="space-y-5">
          <Card Icon={Mail} title="Email" lines={["airlinesaerovista@gmail.com"]} />
          <Card Icon={Phone} title="Phone" lines={["+91 1800-AEROVISTA (24x7)", "+91 1800-237-6847"]} />
          <Card Icon={MapPin} title="Headquarters" lines={["AeroVista House, IGI Airport,", "New Delhi 110037, India"]} />
        </div>
        <div className="lg:col-span-2 glass-light rounded-2xl p-7">
          {sent ? (
            <div className="text-center py-12">
              <div className="font-serif-display text-3xl text-white mb-2">Thank you!</div>
              <p className="text-white/65">Our team will reach out within 24 hours.</p>
            </div>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); setSent(true); }} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <Input label="Name" required />
                <Input label="Email" type="email" required />
              </div>
              <Input label="Subject" />
              <div>
                <label className="text-[10px] tracking-[0.2em] uppercase text-white/55 mb-1.5 block">Message</label>
                <textarea required className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:border-amber-400 outline-none min-h-[140px]" />
              </div>
              <button data-testid="contact-submit" className="bg-amber-400 hover:bg-amber-300 text-[#0B132B] font-semibold px-7 py-3 rounded-full transition">Send Message</button>
            </form>
          )}
        </div>
      </div>
    </PageShell>
  );
}

function Input({ label, type = "text", required }) {
  return (
    <label className="block">
      <span className="text-[10px] tracking-[0.2em] uppercase text-white/55 mb-1.5 block">{label}</span>
      <input type={type} required={required} className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:border-amber-400 outline-none" />
    </label>
  );
}

function Card({ Icon, title, lines }) {
  return (
    <div className="glass-light rounded-2xl p-5">
      <div className="flex items-start gap-3">
        <Icon className="w-5 h-5 text-amber-400 mt-1" />
        <div>
          <div className="text-amber-400 text-[10px] tracking-[0.3em] uppercase mb-1">{title}</div>
          {lines.map((l, i) => <div key={i} className="text-white text-sm">{l}</div>)}
        </div>
      </div>
    </div>
  );
}
