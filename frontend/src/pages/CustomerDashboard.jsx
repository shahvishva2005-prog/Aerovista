import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, fmtINR, fmtDate, API } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Plane, Ticket, Receipt, Download, RefreshCw, FileText, AlertTriangle } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../components/ui/alert-dialog";

const TIERS = ["Bronze", "Silver", "Gold", "Platinum"];

export default function CustomerDashboard() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [tab, setTab] = useState("upcoming");
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelBusy, setCancelBusy] = useState(false);

  useEffect(() => {
    api.get("/bookings/mine").then((r) => setBookings(r.data));
    api.get("/refunds/mine").then((r) => setRefunds(r.data));
  }, []);

  if (!user) return <div className="pt-32 text-center text-[#0B132B]/72">Please sign in.</div>;

  const now = new Date();
  const upcoming = bookings.filter((b) => b.status !== "cancelled" && new Date(b.flight_snapshot.departure_iso) >= now);
  const past = bookings.filter((b) => b.status !== "cancelled" && new Date(b.flight_snapshot.departure_iso) < now);
  const cancelled = bookings.filter((b) => b.status === "cancelled");
  const tierIdx = TIERS.indexOf(user.loyalty_tier || "Bronze");
  const points = user.loyalty_points || 0;
  const nextTier = TIERS[Math.min(tierIdx + 1, 3)];
  const progress = Math.min(100, (points % 5000) / 50);

  const confirmCancel = async () => {
    if (!cancelTarget) return;
    setCancelBusy(true);
    try {
      await api.post("/refunds", { booking_id: cancelTarget.id, reason: "Customer cancelled" });
      const r1 = await api.get("/bookings/mine"); setBookings(r1.data);
      const r2 = await api.get("/refunds/mine"); setRefunds(r2.data);
    } finally {
      setCancelBusy(false);
      setCancelTarget(null);
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-16" data-testid="account-page">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        {/* Hero */}
        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 glass-light rounded-2xl p-8 bg-gradient-to-br from-amber-500/10 to-amber-500/0">
            <div className="text-amber-700 text-xs tracking-[0.3em] uppercase mb-3">SkyChip {user.loyalty_tier || "Bronze"}</div>
            <h2 className="font-serif-display text-4xl text-[#0B132B] mb-1">Welcome, {user.name.split(" ")[0]}</h2>
            <p className="text-[#0B132B]/60 text-sm">{user.email}</p>

            <div className="mt-6">
              <div className="flex justify-between text-xs text-[#0B132B]/72 mb-2">
                <span>{points} points</span>
                <span>{nextTier !== user.loyalty_tier ? `Reach ${nextTier} at 5,000` : "Top Tier"}</span>
              </div>
              <div className="h-2 bg-[#0B132B]/10 rounded-full overflow-hidden">
                <div className="h-full av-bg-gold" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Upcoming" value={upcoming.length} Icon={Plane} />
            <Stat label="Past" value={past.length} Icon={Ticket} />
            <Stat label="Refunds" value={refunds.length} Icon={RefreshCw} />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 flex-wrap mb-6">
          {[
            ["upcoming", `Upcoming (${upcoming.length})`],
            ["past", `Past (${past.length})`],
            ["cancelled", `Cancelled (${cancelled.length})`],
            ["refunds", `Refunds (${refunds.length})`],
          ].map(([v, l]) => (
            <button key={v} onClick={() => setTab(v)} data-testid={`tab-${v}`}
              className={`px-5 py-2 rounded-full text-sm transition ${tab === v ? "bg-amber-400 text-[#0B132B]" : "glass-light text-[#0B132B]/80"}`}>{l}</button>
          ))}
        </div>

        {/* Lists */}
        {tab === "refunds" ? (
          <div className="space-y-3">
            {refunds.map((r) => (
              <div key={r.id} className="glass-light rounded-2xl p-5" data-testid={`refund-${r.refund_id}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-mono-aero text-amber-700">{r.refund_id}</div>
                    <div className="text-[#0B132B]/60 text-xs">PNR {r.pnr} • {fmtDate(r.created_at)}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-serif-display text-xl text-[#0B132B]">{fmtINR(r.amount)}</div>
                    <div className="text-xs px-3 py-1 rounded-full bg-amber-400/15 text-amber-600 inline-block mt-1">{r.status}</div>
                  </div>
                </div>
              </div>
            ))}
            {refunds.length === 0 && <Empty msg="No refund requests yet." />}
          </div>
        ) : (
          <BookingList
            items={tab === "upcoming" ? upcoming : tab === "past" ? past : cancelled}
            onCancel={(b) => setCancelTarget(b)} showCancel={tab === "upcoming"} />
        )}
      </div>

      <AlertDialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <AlertDialogContent data-testid="cancel-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif-display flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" /> Cancel booking?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {cancelTarget && (
                <>
                  You are about to cancel booking <strong className="text-[#0B132B] font-mono-aero">{cancelTarget.pnr}</strong> for{" "}
                  <strong className="text-[#0B132B]">{cancelTarget.flight_snapshot?.origin} → {cancelTarget.flight_snapshot?.destination}</strong> on{" "}
                  <strong className="text-[#0B132B]">{fmtDate(cancelTarget.flight_snapshot?.departure_date)}</strong>.
                  <br /><br />
                  A refund of <strong className="text-amber-700">{fmtINR((cancelTarget.fare?.total || 0) * 0.85)}</strong> (85% of paid amount, 15% cancellation fee) will be initiated and processed within 7–10 business days.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="cancel-dialog-no">Keep Booking</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCancel} disabled={cancelBusy} data-testid="cancel-dialog-yes"
              className="bg-red-600 hover:bg-red-700 text-white">
              {cancelBusy ? "Cancelling…" : "Yes, Cancel & Refund"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Stat({ Icon, label, value }) {
  return (
    <div className="glass-light rounded-2xl p-5 flex flex-col items-center justify-center">
      <Icon className="w-5 h-5 text-amber-700 mb-2" />
      <div className="font-serif-display text-3xl text-[#0B132B]">{value}</div>
      <div className="text-[#0B132B]/60 text-xs uppercase tracking-widest">{label}</div>
    </div>
  );
}

function BookingList({ items, onCancel, showCancel }) {
  if (items.length === 0) return <Empty msg="Nothing here yet." />;
  return (
    <div className="space-y-3">
      {items.map((b) => <BookingCard key={b.id} b={b} onCancel={onCancel} showCancel={showCancel} />)}
    </div>
  );
}

function BookingCard({ b, onCancel, showCancel }) {
  const f = b.flight_snapshot;
  const download = async (kind) => {
    const token = localStorage.getItem("av_token");
    const r = await fetch(`${API}/bookings/${b.id}/${kind}.pdf`, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return;
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${kind}-${b.pnr}.pdf`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="glass-light rounded-2xl p-6" data-testid={`booking-${b.pnr}`}>
      <div className="grid md:grid-cols-12 gap-4 items-center">
        <div className="md:col-span-3">
          <div className="text-amber-700 font-mono-aero text-xs">{b.pnr}</div>
          <div className="text-[#0B132B]/60 text-xs">{f.flight_number} • {fmtDate(f.departure_date)}</div>
          <span className="text-xs px-3 py-1 rounded-full bg-amber-400/15 text-amber-600 inline-block mt-2 uppercase">{b.status}</span>
        </div>
        <div className="md:col-span-5 grid grid-cols-3 items-center">
          <div>
            <div className="font-serif-display text-2xl text-[#0B132B]">{f.departure_time}</div>
            <div className="text-[#0B132B]/60 text-xs">{f.origin}</div>
          </div>
          <div className="text-center">
            <Plane className="w-4 h-4 text-amber-700 mx-auto" />
            <div className="text-[#0B132B]/45 text-[10px] uppercase mt-1">{f.duration}</div>
          </div>
          <div className="text-right">
            <div className="font-serif-display text-2xl text-[#0B132B]">{f.arrival_time}</div>
            <div className="text-[#0B132B]/60 text-xs">{f.destination}</div>
          </div>
        </div>
        <div className="md:col-span-4 flex flex-wrap gap-2 justify-end">
          <button onClick={() => download("ticket")} className="text-xs px-3 py-1.5 rounded-full glass-light text-[#0B132B] inline-flex items-center gap-1 hover:bg-[#0B132B]/12">
            <Download className="w-3 h-3" /> Ticket
          </button>
          <button onClick={() => download("invoice")} className="text-xs px-3 py-1.5 rounded-full glass-light text-[#0B132B] inline-flex items-center gap-1 hover:bg-[#0B132B]/12">
            <FileText className="w-3 h-3" /> Invoice
          </button>
          <button onClick={() => download("receipt")} className="text-xs px-3 py-1.5 rounded-full glass-light text-[#0B132B] inline-flex items-center gap-1 hover:bg-[#0B132B]/12">
            <Receipt className="w-3 h-3" /> Receipt
          </button>
          <button onClick={() => download("boarding-pass")} className="text-xs px-3 py-1.5 rounded-full glass-light text-[#0B132B] inline-flex items-center gap-1 hover:bg-[#0B132B]/12">
            <Ticket className="w-3 h-3" /> Boarding Pass
          </button>
          {showCancel && (
            <button onClick={() => onCancel(b)} data-testid={`cancel-${b.pnr}`}
              className="text-xs px-3 py-1.5 rounded-full bg-red-500/15 text-red-700 hover:bg-red-500/25 transition">Cancel</button>
          )}
        </div>
      </div>
    </div>
  );
}

function Empty({ msg }) {
  return <div className="text-center py-16 text-[#0B132B]/60 glass-light rounded-2xl">{msg}</div>;
}
