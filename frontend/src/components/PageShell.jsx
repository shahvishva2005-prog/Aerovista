import React from "react";

export default function PageShell({ title, subtitle, children, bgUrl, testId }) {
  return (
    <div className="min-h-screen pt-20" data-testid={testId}>
      <section className="relative h-[300px] md:h-[360px] overflow-hidden">
        <div className="absolute inset-0">
          <img src={bgUrl || "https://images.unsplash.com/photo-1529074963764-98f45c47344b?w=1920&q=85"}
            alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 hero-overlay" />
        </div>
        <div className="relative max-w-[1400px] mx-auto px-6 lg:px-12 h-full flex items-end pb-12">
          <div>
            <div className="text-amber-400 text-xs tracking-[0.3em] uppercase mb-3">AeroVista</div>
            <h1 className="font-serif-display text-5xl md:text-6xl text-white font-light tracking-tight">{title}</h1>
            {subtitle && <p className="text-white/70 mt-3 text-lg max-w-2xl font-light">{subtitle}</p>}
          </div>
        </div>
      </section>
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-16">{children}</div>
    </div>
  );
}
