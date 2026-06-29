import React, { useEffect, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { api, fmtINR, API } from "../lib/api";
import { CheckCircle2, Download, Plane, FileText, Receipt, Ticket, Sparkles } from "lucide-react";

export default function BookingConfirmation() {
  const { bookingId } = useParams();
  const [params] = useSearchParams();
  const [booking, setBooking] = useState(null);
  const points = params.get("points");

  useEffect(() => {
    api.get(`/bookings/${bookingId}`).then((r) => setBooking(r.data));
  }, [bookingId]);

  if (!booking) return <div className="pt-32 text-center text-[#0B132B]/72">Loading confirmation…</div>;
  const f = booking.flight_snapshot;
  const token = localStorage.getItem("av_token");
  const link = (path) => `${API}${path}?_=${token ? "1" : "0"}`;

  return (
    <div className="min-h-screen pt-24 pb-16 av-bg-booking" data-testid="confirmation-page">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="glass-light rounded-2xl p-8 mb-8 border border-emerald-400/30">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-full bg-emerald-400/20 grid place-items-center shrink-0">
              <CheckCircle2 className="w-7 h-7 text-emerald-400" />
            </div>
            <div className="flex-1">
              <div className="text-emerald-300 text-xs tracking-[0.3em] uppercase mb-1">Confirmed</div>
              <h2 className="font-serif-display text-4xl text-[#0B132B]">Your journey is booked.</h2>
              <p className="text-[#0B132B]/70 mt-2">A confirmation email with your e-ticket is on its way. Have a wonderful flight!</p>
              {points && (
                <div className="mt-3 inline-flex items-center gap-2 bg-amber-400/15 text-amber-600 rounded-full px-3 py-1.5 text-xs">
                  <Sparkles className="w-3.5 h-3.5" /> Earned {points} SkyChip points
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Ticket card - light over dark */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-2xl mb-8" data-testid="ticket-card">
          <div className="av-bg-cream p-6 flex items-center justify-between">
            <div>
              <div className="text-amber-700 text-[11px] tracking-[0.3em] uppercase">AeroVista Airlines</div>
              <div className="font-serif-display text-2xl text-[#0B132B] mt-1">E-Ticket</div>
            </div>
            <div className="text-right">
              <div className="text-amber-600 text-[11px] tracking-[0.3em] uppercase">PNR</div>
              <div className="font-mono-aero text-2xl text-[#0B132B]">{booking.pnr}</div>
            </div>
          </div>

          <div className="p-8 grid md:grid-cols-12 gap-6">
            <div className="md:col-span-7">
              <div className="grid grid-cols-3 items-center mb-6">
                <div>
                  <div className="font-serif-display text-4xl text-[#0B132B]">{f.departure_time}</div>
                  <div className="text-slate-500 text-xs mt-1">{f.departure_date}</div>
                  <div className="font-mono-aero text-amber-600 text-lg mt-2">{f.origin}</div>
                  <div className="text-slate-500 text-sm">{f.origin_city}</div>
                </div>
                <div className="text-center">
                  <div className="text-slate-500 text-xs mb-1">{f.duration}</div>
                  <div className="border-t border-dashed border-slate-300 relative">
                    <Plane className="absolute left-1/2 -translate-x-1/2 -top-3 w-5 h-5 text-amber-600" />
                  </div>
                  <div className="text-slate-400 text-[10px] uppercase mt-1">Non-stop</div>
                </div>
                <div className="text-right">
                  <div className="font-serif-display text-4xl text-[#0B132B]">{f.arrival_time}</div>
                  <div className="text-slate-500 text-xs mt-1">{f.arrival_date}</div>
                  <div className="font-mono-aero text-amber-600 text-lg mt-2">{f.destination}</div>
                  <div className="text-slate-500 text-sm">{f.destination_city}</div>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3 text-center border-t border-slate-100 pt-5">
                <Cell k="Flight" v={f.flight_number} />
                <Cell k="Aircraft" v={f.aircraft} />
                <Cell k="Terminal" v={f.terminal} />
                <Cell k="Gate" v={f.gate} />
                <Cell k="Class" v={booking.cabin_class.replace("_", " ")} />
                <Cell k="Ticket" v={booking.ticket_number} />
                <Cell k="Invoice" v={booking.invoice_number} />
                <Cell k="Receipt" v={booking.receipt_number} />
              </div>

              <div className="mt-5 border-t border-slate-100 pt-4">
                <div className="text-slate-500 text-xs uppercase tracking-widest mb-2">Passengers</div>
                {booking.passengers.map((p, i) => (
                  <div key={i} className="flex justify-between py-1.5 border-b border-slate-100 last:border-b-0">
                    <span className="text-[#0B132B]">{p.title} {p.first_name} {p.last_name}</span>
                    <span className="font-mono-aero text-amber-600">{booking.seats[i] || "TBA"}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* QR stub */}
            <div className="md:col-span-5 bg-slate-50 rounded-xl p-6 border-l-2 border-dashed border-slate-300">
              <div className="text-slate-500 text-xs uppercase tracking-widest mb-3">Scan at gate</div>
              <div className="aspect-square bg-white rounded-lg grid place-items-center mb-4 border border-slate-200">
                <div className="font-mono-aero text-[10px] text-slate-400 text-center break-all p-4">
                  PNR:{booking.pnr}<br />TKT:{booking.ticket_number}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div>
                  <div className="text-slate-400 text-[10px] uppercase">Boarding</div>
                  <div className="font-serif-display text-xl text-[#0B132B]">{f.boarding_time}</div>
                </div>
                <div>
                  <div className="text-slate-400 text-[10px] uppercase">Total</div>
                  <div className="font-serif-display text-xl text-amber-600">{fmtINR(booking.fare.total)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Downloads */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <DownloadCard Icon={Ticket} label="E-Ticket" href={link(`/bookings/${bookingId}/ticket.pdf`)} testId="download-ticket" />
          <DownloadCard Icon={Plane} label="Boarding Pass" href={link(`/bookings/${bookingId}/boarding-pass.pdf`)} testId="download-bp" />
          <DownloadCard Icon={FileText} label="Tax Invoice" href={link(`/bookings/${bookingId}/invoice.pdf`)} testId="download-invoice" />
          <DownloadCard Icon={Receipt} label="Payment Receipt" href={link(`/bookings/${bookingId}/receipt.pdf`)} testId="download-receipt" />
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/account" className="bg-amber-400 hover:bg-amber-300 text-[#0B132B] font-semibold px-6 py-3 rounded-full">My Bookings</Link>
          <Link to="/checkin" className="glass-light hover:bg-[#0B132B]/12 text-[#0B132B] px-6 py-3 rounded-full">Web Check-In</Link>
          <Link to="/" className="glass-light hover:bg-[#0B132B]/12 text-[#0B132B] px-6 py-3 rounded-full">Back Home</Link>
        </div>
      </div>
    </div>
  );
}

function Cell({ k, v }) {
  return (
    <div>
      <div className="text-slate-400 text-[10px] uppercase tracking-widest">{k}</div>
      <div className="font-medium text-[#0B132B] text-sm break-words">{v}</div>
    </div>
  );
}

function DownloadCard({ Icon, label, href, testId }) {
  const handleClick = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem("av_token");
    const res = await fetch(href.split("?")[0], { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${label.replace(/\s+/g, "-").toLowerCase()}.pdf`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };
  return (
    <a href={href.split("?")[0]} onClick={handleClick} data-testid={testId}
      className="glass-light rounded-2xl p-5 hover:border-amber-500/50 border border-[#E5E1D6] flex items-center justify-between transition">
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5 text-amber-700" />
        <div className="text-[#0B132B] text-sm">{label}</div>
      </div>
      <Download className="w-4 h-4 text-[#0B132B]/65" />
    </a>
  );
}
