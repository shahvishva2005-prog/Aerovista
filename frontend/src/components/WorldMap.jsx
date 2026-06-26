import React, { useEffect, useRef } from "react";
import { motion } from "framer-motion";

// Equirectangular projection on a 1000x500 SVG canvas
// Lng -180..180 -> X 0..1000; Lat 90..-90 -> Y 0..500
const project = (lat, lng) => ({
  x: ((lng + 180) / 360) * 1000,
  y: ((90 - lat) / 180) * 500,
});

// AeroVista hubs and major destinations (approx coordinates)
const HUBS = [
  { code: "DEL", city: "Delhi", lat: 28.5562, lng: 77.1, hub: true },
  { code: "BOM", city: "Mumbai", lat: 19.0896, lng: 72.8656, hub: true },
  { code: "BLR", city: "Bengaluru", lat: 13.1986, lng: 77.7066 },
  { code: "DXB", city: "Dubai", lat: 25.2532, lng: 55.3657 },
  { code: "DOH", city: "Doha", lat: 25.273, lng: 51.608 },
  { code: "AUH", city: "Abu Dhabi", lat: 24.4330, lng: 54.6511 },
  { code: "LHR", city: "London", lat: 51.4700, lng: -0.4543 },
  { code: "CDG", city: "Paris", lat: 49.0097, lng: 2.5479 },
  { code: "FRA", city: "Frankfurt", lat: 50.0379, lng: 8.5622 },
  { code: "IST", city: "Istanbul", lat: 41.2753, lng: 28.7519 },
  { code: "JFK", city: "New York", lat: 40.6413, lng: -73.7781 },
  { code: "LAX", city: "Los Angeles", lat: 33.9416, lng: -118.4085 },
  { code: "YYZ", city: "Toronto", lat: 43.6777, lng: -79.6248 },
  { code: "SIN", city: "Singapore", lat: 1.3644, lng: 103.9915 },
  { code: "HKG", city: "Hong Kong", lat: 22.308, lng: 113.9185 },
  { code: "NRT", city: "Tokyo", lat: 35.7720, lng: 140.3929 },
  { code: "ICN", city: "Seoul", lat: 37.4602, lng: 126.4407 },
  { code: "BKK", city: "Bangkok", lat: 13.6900, lng: 100.7501 },
  { code: "SYD", city: "Sydney", lat: -33.9461, lng: 151.1772 },
  { code: "MEL", city: "Melbourne", lat: -37.6690, lng: 144.8410 },
  { code: "JNB", city: "Johannesburg", lat: -26.1392, lng: 28.2460 },
  { code: "CAI", city: "Cairo", lat: 30.1219, lng: 31.4056 },
  { code: "GRU", city: "Sao Paulo", lat: -23.4356, lng: -46.4731 },
  { code: "EZE", city: "Buenos Aires", lat: -34.8222, lng: -58.5358 },
];

// Routes from DEL/BOM hubs
const ROUTES = [
  ["DEL", "DXB"], ["DEL", "LHR"], ["DEL", "JFK"], ["DEL", "SIN"], ["DEL", "BKK"],
  ["DEL", "NRT"], ["DEL", "CDG"], ["DEL", "FRA"], ["DEL", "DOH"], ["DEL", "AUH"],
  ["DEL", "ICN"], ["DEL", "HKG"], ["DEL", "IST"], ["DEL", "SYD"], ["DEL", "JNB"],
  ["BOM", "DXB"], ["BOM", "SIN"], ["BOM", "LHR"], ["BOM", "LAX"], ["BOM", "MEL"],
  ["BOM", "GRU"], ["BOM", "CAI"], ["DEL", "YYZ"], ["DEL", "LAX"], ["DEL", "EZE"],
];

function arcPath(from, to) {
  const p1 = project(from.lat, from.lng);
  const p2 = project(to.lat, to.lng);
  const mx = (p1.x + p2.x) / 2;
  const my = (p1.y + p2.y) / 2;
  // Curve upward (negative Y on SVG = up); curvature scales with distance
  const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  const curve = Math.min(120, dist / 2.6);
  return `M ${p1.x},${p1.y} Q ${mx},${my - curve} ${p2.x},${p2.y}`;
}

export default function WorldMap() {
  const svgRef = useRef(null);

  // Pulse animation for hubs handled via CSS
  useEffect(() => { }, []);

  return (
    <div className="relative w-full aspect-[2/1] rounded-2xl overflow-hidden glass-light border border-white/10">
      <svg ref={svgRef} viewBox="0 0 1000 500" className="w-full h-full" style={{ background: "radial-gradient(ellipse at center, #0F1A3A 0%, #0B132B 70%)" }}>
        {/* Stylised continents - simplified shapes (decorative) */}
        <g fill="#162145" opacity="0.85">
          {/* Africa + Europe blob */}
          <path d="M450 110 q-30 -5 -50 10 q-20 18 -20 50 q5 40 25 70 q12 18 30 25 l5 75 q-3 30 8 60 q14 30 40 50 q22 14 45 12 q22 -1 35 -22 q15 -25 5 -55 q-10 -28 -5 -52 q5 -22 -2 -50 q-8 -32 5 -55 q12 -23 -5 -50 q-18 -28 -55 -38 q-30 -10 -56 -30 z" />
          {/* Asia */}
          <path d="M610 110 q40 -10 90 5 q60 20 110 65 q35 32 50 75 q12 32 -8 60 q-25 32 -65 30 q-40 -3 -75 -18 q-30 -12 -55 -35 q-20 -22 -35 -42 q-20 -28 -32 -55 q-10 -25 -8 -45 z" />
          {/* India peninsula */}
          <path d="M650 195 q5 35 18 55 q14 22 8 45 q-8 22 -25 18 q-15 -5 -22 -25 q-10 -28 -8 -55 q1 -25 12 -42 z" />
          {/* Americas */}
          <path d="M190 110 q-25 0 -45 25 q-22 30 -22 70 q3 50 28 90 q22 35 18 70 q-2 35 -25 60 q-15 18 -8 38 q8 18 30 18 q22 -2 35 -20 q15 -22 25 -50 q15 -42 8 -85 q-5 -32 -10 -58 q-2 -25 8 -52 q12 -30 0 -60 q-12 -28 -42 -45 z" />
          {/* Australia */}
          <path d="M820 350 q35 -5 60 5 q30 12 38 35 q5 22 -10 38 q-22 22 -55 18 q-32 -3 -50 -25 q-15 -22 -8 -42 q5 -20 25 -28 z" />
        </g>

        {/* Lat/Lng grid (subtle) */}
        <g stroke="#ffffff" strokeOpacity="0.04" strokeWidth="0.5">
          {[0, 100, 200, 300, 400].map((y) => <line key={y} x1="0" x2="1000" y1={y} y2={y} />)}
          {[0, 200, 400, 600, 800, 1000].map((x) => <line key={x} y1="0" y2="500" x1={x} x2={x} />)}
        </g>

        {/* Route arcs */}
        {ROUTES.map(([a, b], i) => {
          const from = HUBS.find((h) => h.code === a);
          const to = HUBS.find((h) => h.code === b);
          if (!from || !to) return null;
          const d = arcPath(from, to);
          return (
            <g key={`${a}-${b}`}>
              <path d={d} stroke="#D4AF37" strokeOpacity="0.35" strokeWidth="0.8" fill="none" />
              <motion.circle
                r="2.4"
                fill="#F3E5AB"
                initial={{ offsetDistance: "0%" }}
                animate={{ offsetDistance: "100%" }}
                transition={{ duration: 6 + (i % 4), repeat: Infinity, ease: "linear", delay: i * 0.18 }}
                style={{ offsetPath: `path('${d}')` }}
              />
            </g>
          );
        })}

        {/* Hubs */}
        {HUBS.map((h) => {
          const p = project(h.lat, h.lng);
          const isHub = h.hub;
          return (
            <g key={h.code} transform={`translate(${p.x}, ${p.y})`}>
              {isHub && (
                <motion.circle
                  r={6} fill="#D4AF37" opacity="0.35"
                  animate={{ scale: [1, 2.2, 1], opacity: [0.4, 0, 0.4] }}
                  transition={{ duration: 2.2, repeat: Infinity }}
                />
              )}
              <circle r={isHub ? 3.5 : 2} fill="#F3E5AB" stroke="#0B132B" strokeWidth="0.5" />
              <text x={4} y={-4} fill="#ffffff" fontSize="7" fontFamily="JetBrains Mono, monospace" opacity="0.7">
                {h.code}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Overlay legend */}
      <div className="absolute top-4 left-4 glass rounded-xl px-4 py-3 text-xs text-white/80">
        <div className="text-amber-400 text-[10px] tracking-[0.3em] uppercase mb-1">Global Network</div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> Hub</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-200" /> Destination</span>
        </div>
      </div>
      <div className="absolute bottom-4 right-4 text-[10px] text-white/40">
        Decorative visualisation • Not to cartographic scale
      </div>
    </div>
  );
}
