import React, { useEffect, useState } from "react";
import { api, fmtINR } from "../lib/api";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { Coins, Users, Plane, RefreshCw, BarChart3, Mail } from "lucide-react";

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [emails, setEmails] = useState([]);
  const [tab, setTab] = useState("overview");

  useEffect(() => {
    api.get("/admin/dashboard").then((r) => setData(r.data));
    api.get("/admin/bookings").then((r) => setBookings(r.data));
    api.get("/admin/refunds").then((r) => setRefunds(r.data));
    api.get("/admin/email-logs").then((r) => setEmails(r.data));
  }, []);

  if (!data) return <div className="pt-32 text-center text-white/70">Loading dashboard…</div>;

  return (
    <div className="min-h-screen pt-24 pb-16" data-testid="admin-page">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="mb-8">
          <div className="text-amber-400 text-xs tracking-[0.3em] uppercase mb-3">Operations Control Center</div>
          <h2 className="font-serif-display text-4xl text-white">Admin Dashboard</h2>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Stat label="Revenue" value={fmtINR(data.revenue)} Icon={Coins} />
          <Stat label="Bookings" value={data.bookings} Icon={Plane} />
          <Stat label="Customers" value={data.customers} Icon={Users} />
          <Stat label="Refunds" value={data.refunds} Icon={RefreshCw} />
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 glass-light rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif-display text-2xl text-white">Revenue (last 8 days)</h3>
              <BarChart3 className="w-4 h-4 text-amber-400" />
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.revenue_series}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                  <XAxis dataKey="date" stroke="#ffffff60" fontSize={11} />
                  <YAxis stroke="#ffffff60" fontSize={11} />
                  <Tooltip contentStyle={{ background: "#0B132B", border: "1px solid #ffffff20" }} />
                  <Line type="monotone" dataKey="revenue" stroke="#D4AF37" strokeWidth={2.5} dot={{ fill: "#D4AF37" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass-light rounded-2xl p-6">
            <h3 className="font-serif-display text-2xl text-white mb-4">Top Routes</h3>
            <div className="space-y-3">
              {data.top_routes.map((r) => (
                <div key={r.route} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <div>
                    <div className="font-mono-aero text-amber-400">{r.route}</div>
                    <div className="text-white/55 text-xs">{r.count} bookings</div>
                  </div>
                  <div className="font-serif-display text-amber-300">{fmtINR(r.revenue)}</div>
                </div>
              ))}
              {data.top_routes.length === 0 && <div className="text-white/50 text-sm">No paid bookings yet.</div>}
            </div>
          </div>
        </div>

        <div className="flex gap-2 mb-6 flex-wrap">
          {[
            ["overview", "Overview"],
            ["bookings", `Bookings (${bookings.length})`],
            ["refunds", `Refunds (${refunds.length})`],
            ["emails", `Email Logs (${emails.length})`],
          ].map(([v, l]) => (
            <button key={v} onClick={() => setTab(v)} data-testid={`admin-tab-${v}`}
              className={`px-4 py-2 rounded-full text-sm ${tab === v ? "bg-amber-400 text-[#0B132B]" : "glass-light text-white/80"}`}>{l}</button>
          ))}
        </div>

        {tab === "bookings" && (
          <Table head={["PNR", "Customer", "Route", "Class", "Status", "Amount"]}>
            {bookings.map((b) => (
              <tr key={b.id} className="border-t border-white/5">
                <td className="p-3 font-mono-aero text-amber-400">{b.pnr}</td>
                <td className="p-3 text-white/80">{b.user_email}</td>
                <td className="p-3 text-white/80">{b.flight_snapshot.origin} → {b.flight_snapshot.destination}</td>
                <td className="p-3 text-white/60 capitalize">{b.cabin_class.replace("_", " ")}</td>
                <td className="p-3"><span className="px-2 py-0.5 text-[10px] rounded-full bg-amber-400/15 text-amber-300 uppercase">{b.status}</span></td>
                <td className="p-3 text-white">{fmtINR(b.fare.total)}</td>
              </tr>
            ))}
          </Table>
        )}

        {tab === "refunds" && (
          <Table head={["Refund ID", "PNR", "Amount", "Status", "Action"]}>
            {refunds.map((r) => (
              <tr key={r.id} className="border-t border-white/5">
                <td className="p-3 font-mono-aero text-amber-400">{r.refund_id}</td>
                <td className="p-3 text-white/80">{r.pnr}</td>
                <td className="p-3 text-white">{fmtINR(r.amount)}</td>
                <td className="p-3"><span className="px-2 py-0.5 text-[10px] rounded-full bg-amber-400/15 text-amber-300 uppercase">{r.status}</span></td>
                <td className="p-3">
                  <select onChange={async (e) => {
                    await api.post(`/admin/refunds/${r.id}/status`, { status: e.target.value });
                    const x = await api.get("/admin/refunds"); setRefunds(x.data);
                  }} defaultValue={r.status} className="bg-white/5 border border-white/10 rounded-md px-2 py-1 text-xs text-white">
                    {["Requested", "Under Review", "Approved", "Processing", "Completed", "Rejected"].map((s) =>
                      <option key={s} value={s} className="bg-[#1C2541]">{s}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </Table>
        )}

        {tab === "emails" && (
          <Table head={["To", "Subject", "Category", "Status", "Sent At"]}>
            {emails.map((e) => (
              <tr key={e.id} className="border-t border-white/5">
                <td className="p-3 text-white/80">{e.to_email}</td>
                <td className="p-3 text-white/80">{e.subject}</td>
                <td className="p-3 text-white/60">{e.category}</td>
                <td className="p-3"><StatusPill v={e.status} /></td>
                <td className="p-3 text-white/55 text-xs">{(e.sent_at || e.created_at || "").slice(0, 19).replace("T", " ")}</td>
              </tr>
            ))}
          </Table>
        )}

        {tab === "overview" && (
          <div className="glass-light rounded-2xl p-6">
            <h3 className="font-serif-display text-2xl text-white mb-2">Welcome, Operator</h3>
            <p className="text-white/65 text-sm">Use the tabs above to manage Bookings, Refunds, and outgoing email logs. Email sending is currently <span className="text-amber-400">MOCKED</span> until SMTP App Password is configured in backend .env.</p>
            <div className="mt-4 inline-flex gap-2 items-center text-xs text-white/55"><Mail className="w-3.5 h-3.5 text-amber-400" /> All outgoing emails are logged in the database for audit.</div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, Icon }) {
  return (
    <div className="glass-light rounded-2xl p-5">
      <Icon className="w-5 h-5 text-amber-400 mb-3" />
      <div className="font-serif-display text-3xl text-white">{value}</div>
      <div className="text-white/55 text-xs uppercase tracking-widest">{label}</div>
    </div>
  );
}

function Table({ head, children }) {
  return (
    <div className="glass-light rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white/5">
              {head.map((h) => <th key={h} className="text-left p-3 text-amber-400 text-xs uppercase tracking-widest">{h}</th>)}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
}

function StatusPill({ v }) {
  const c = v === "sent" ? "bg-emerald-500/15 text-emerald-300"
    : v === "mocked" ? "bg-amber-400/15 text-amber-300"
    : v === "failed" ? "bg-red-500/15 text-red-300"
    : "bg-white/10 text-white/70";
  return <span className={`px-2 py-0.5 text-[10px] rounded-full ${c} uppercase`}>{v}</span>;
}
