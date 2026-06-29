import React, { useEffect, useState } from "react";
import { api, fmtINR, API } from "../lib/api";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from "recharts";
import { Coins, Users, Plane, RefreshCw, BarChart3, Mail, Download, TrendingUp, ChartPie as PieIcon } from "lucide-react";

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [emails, setEmails] = useState([]);
  const [trend, setTrend] = useState([]);
  const [occupancy, setOccupancy] = useState(null);
  const [tab, setTab] = useState("overview");

  useEffect(() => {
    api.get("/admin/dashboard").then((r) => setData(r.data));
    api.get("/admin/bookings").then((r) => setBookings(r.data));
    api.get("/admin/refunds").then((r) => setRefunds(r.data));
    api.get("/admin/email-logs").then((r) => setEmails(r.data));
    api.get("/admin/charts/bookings-trend?days=14").then((r) => setTrend(r.data));
    api.get("/admin/charts/occupancy").then((r) => setOccupancy(r.data));
  }, []);

  if (!data) return <div className="pt-32 text-center text-[#0B132B]/72">Loading dashboard…</div>;

  return (
    <div className="min-h-screen pt-24 pb-16" data-testid="admin-page">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="mb-8">
          <div className="text-amber-700 text-xs tracking-[0.3em] uppercase mb-3">Operations Control Center</div>
          <h2 className="font-serif-display text-4xl text-[#0B132B]">Admin Dashboard</h2>
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
              <h3 className="font-serif-display text-2xl text-[#0B132B]">Revenue (last 8 days)</h3>
              <BarChart3 className="w-4 h-4 text-amber-700" />
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
            <h3 className="font-serif-display text-2xl text-[#0B132B] mb-4">Top Routes</h3>
            <div className="space-y-3">
              {data.top_routes.map((r) => (
                <div key={r.route} className="flex items-center justify-between p-3 bg-[#0B132B]/5 rounded-lg">
                  <div>
                    <div className="font-mono-aero text-amber-700">{r.route}</div>
                    <div className="text-[#0B132B]/60 text-xs">{r.count} bookings</div>
                  </div>
                  <div className="font-serif-display text-amber-600">{fmtINR(r.revenue)}</div>
                </div>
              ))}
              {data.top_routes.length === 0 && <div className="text-[#0B132B]/55 text-sm">No paid bookings yet.</div>}
            </div>
          </div>
        </div>

        {/* Extra charts row */}
        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 glass-light rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif-display text-2xl text-[#0B132B]">Bookings Trend (14 days)</h3>
              <TrendingUp className="w-4 h-4 text-amber-700" />
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#0B132B11" />
                  <XAxis dataKey="date" stroke="#0B132B66" fontSize={10} tickFormatter={(v) => v.slice(5)} />
                  <YAxis stroke="#0B132B66" fontSize={11} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E5E1D6", borderRadius: 8 }} />
                  <Bar dataKey="bookings" fill="#D4AF37" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass-light rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif-display text-2xl text-[#0B132B]">Cabin Class Split</h3>
              <PieIcon className="w-4 h-4 text-amber-700" />
            </div>
            {occupancy && occupancy.cabin_split.length > 0 ? (
              <>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={occupancy.cabin_split} dataKey="count" nameKey="class" innerRadius={32} outerRadius={66}>
                        {occupancy.cabin_split.map((_, i) => (
                          <Cell key={i} fill={["#D4AF37", "#1C2541", "#B8941F", "#7C8DB5"][i % 4]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E5E1D6", borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 space-y-1">
                  {occupancy.cabin_split.map((c, i) => (
                    <div key={c.class} className="flex justify-between text-xs">
                      <span className="text-[#0B132B]/70 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ background: ["#D4AF37", "#1C2541", "#B8941F", "#7C8DB5"][i % 4] }} />
                        {c.class.replace("_", " ")}
                      </span>
                      <span className="text-[#0B132B] font-medium">{c.count}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="text-[10px] uppercase tracking-widest text-amber-700">Avg Occupancy</div>
                  <div className="font-serif-display text-3xl text-[#0B132B]">{occupancy.occupancy_pct}%</div>
                </div>
              </>
            ) : (
              <div className="text-[#0B132B]/55 text-sm">No bookings yet to chart.</div>
            )}
          </div>
        </div>

        <div className="flex gap-2 mb-6 flex-wrap">
          {[
            ["overview", "Overview"],
            ["bookings", `Bookings (${bookings.length})`],
            ["refunds", `Refunds (${refunds.length})`],
            ["emails", `Email Logs (${emails.length})`],
            ["exports", "Exports"],
          ].map(([v, l]) => (
            <button key={v} onClick={() => setTab(v)} data-testid={`admin-tab-${v}`}
              className={`px-4 py-2 rounded-full text-sm ${tab === v ? "bg-amber-400 text-[#0B132B]" : "glass-light text-[#0B132B]/80"}`}>{l}</button>
          ))}
        </div>

        {tab === "bookings" && (
          <Table head={["PNR", "Customer", "Route", "Class", "Status", "Amount"]}>
            {bookings.map((b) => (
              <tr key={b.id} className="border-t border-[#E5E1D6]">
                <td className="p-3 font-mono-aero text-amber-700">{b.pnr}</td>
                <td className="p-3 text-[#0B132B]/80">{b.user_email}</td>
                <td className="p-3 text-[#0B132B]/80">{b.flight_snapshot.origin} → {b.flight_snapshot.destination}</td>
                <td className="p-3 text-[#0B132B]/65 capitalize">{b.cabin_class.replace("_", " ")}</td>
                <td className="p-3"><span className="px-2 py-0.5 text-[10px] rounded-full bg-amber-400/15 text-amber-600 uppercase">{b.status}</span></td>
                <td className="p-3 text-[#0B132B]">{fmtINR(b.fare.total)}</td>
              </tr>
            ))}
          </Table>
        )}

        {tab === "refunds" && (
          <Table head={["Refund ID", "PNR", "Amount", "Status", "Action"]}>
            {refunds.map((r) => (
              <tr key={r.id} className="border-t border-[#E5E1D6]">
                <td className="p-3 font-mono-aero text-amber-700">{r.refund_id}</td>
                <td className="p-3 text-[#0B132B]/80">{r.pnr}</td>
                <td className="p-3 text-[#0B132B]">{fmtINR(r.amount)}</td>
                <td className="p-3"><span className="px-2 py-0.5 text-[10px] rounded-full bg-amber-400/15 text-amber-600 uppercase">{r.status}</span></td>
                <td className="p-3">
                  <select onChange={async (e) => {
                    await api.post(`/admin/refunds/${r.id}/status`, { status: e.target.value });
                    const x = await api.get("/admin/refunds"); setRefunds(x.data);
                  }} defaultValue={r.status} className="bg-[#0B132B]/5 border border-[#E5E1D6] rounded-md px-2 py-1 text-xs text-[#0B132B]">
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
              <tr key={e.id} className="border-t border-[#E5E1D6]">
                <td className="p-3 text-[#0B132B]/80">{e.to_email}</td>
                <td className="p-3 text-[#0B132B]/80">{e.subject}</td>
                <td className="p-3 text-[#0B132B]/65">{e.category}</td>
                <td className="p-3"><StatusPill v={e.status} /></td>
                <td className="p-3 text-[#0B132B]/60 text-xs">{(e.sent_at || e.created_at || "").slice(0, 19).replace("T", " ")}</td>
              </tr>
            ))}
          </Table>
        )}

        {tab === "overview" && (
          <div className="glass-light rounded-2xl p-6">
            <h3 className="font-serif-display text-2xl text-[#0B132B] mb-2">Welcome, Operator</h3>
            <p className="text-[#0B132B]/70 text-sm">Use the tabs above to manage Bookings, Refunds, Email Logs, and download Exports. Email sending is currently <span className="text-amber-700">MOCKED</span> until SMTP App Password is configured in backend .env.</p>
            <div className="mt-4 inline-flex gap-2 items-center text-xs text-[#0B132B]/60"><Mail className="w-3.5 h-3.5 text-amber-700" /> All outgoing emails are logged in the database for audit.</div>
          </div>
        )}

        {tab === "exports" && <ExportsPanel />}
      </div>
    </div>
  );
}

function ExportsPanel() {
  const kinds = [
    { v: "bookings", l: "Bookings", desc: "PNR, customer, route, status, amount" },
    { v: "payments", l: "Payments", desc: "Transactions, methods, banks, status" },
    { v: "customers", l: "Customers", desc: "Profile + loyalty tier + points" },
    { v: "refunds", l: "Refunds", desc: "Refund IDs, amounts, status" },
    { v: "flights", l: "Flights", desc: "Schedule, aircraft, seats, prices" },
  ];

  const download = async (kind, fmt) => {
    const token = localStorage.getItem("av_token");
    const url = kind === "revenue"
      ? `${API}/admin/revenue-report.${fmt}`
      : `${API}/admin/exports/${kind}.${fmt}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) { alert("Export failed"); return; }
    const blob = await r.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `aerovista-${kind}.${fmt}`;
    document.body.appendChild(a); a.click(); a.remove();
  };

  return (
    <div className="grid md:grid-cols-2 gap-4" data-testid="exports-panel">
      {kinds.map((k) => (
        <div key={k.v} className="glass-light rounded-2xl p-6">
          <div className="text-amber-700 text-[10px] tracking-[0.3em] uppercase mb-2">Export</div>
          <h3 className="font-serif-display text-2xl text-[#0B132B]">{k.l}</h3>
          <p className="text-[#0B132B]/60 text-sm mt-1">{k.desc}</p>
          <div className="mt-4 flex gap-2">
            <button onClick={() => download(k.v, "csv")} data-testid={`export-${k.v}-csv`}
              className="text-xs px-4 py-2 rounded-full glass-light hover:bg-[#0B132B]/12 text-[#0B132B] inline-flex items-center gap-2">
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
            <button onClick={() => download(k.v, "xlsx")} data-testid={`export-${k.v}-xlsx`}
              className="text-xs px-4 py-2 rounded-full bg-amber-400 hover:bg-amber-300 text-[#0B132B] font-semibold inline-flex items-center gap-2">
              <Download className="w-3.5 h-3.5" /> Excel
            </button>
          </div>
        </div>
      ))}

      <div className="glass-light rounded-2xl p-6 md:col-span-2 bg-gradient-to-br from-amber-500/10 to-amber-500/0 border border-amber-500/40">
        <div className="text-amber-700 text-[10px] tracking-[0.3em] uppercase mb-2">Finance</div>
        <h3 className="font-serif-display text-2xl text-[#0B132B]">Daily Revenue Report</h3>
        <p className="text-[#0B132B]/60 text-sm mt-1">Aggregated by date with transaction count and revenue total.</p>
        <div className="mt-4 flex gap-2">
          <button onClick={() => download("revenue", "csv")} data-testid="export-revenue-csv"
            className="text-xs px-4 py-2 rounded-full glass-light hover:bg-[#0B132B]/12 text-[#0B132B] inline-flex items-center gap-2">
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          <button onClick={() => download("revenue", "xlsx")} data-testid="export-revenue-xlsx"
            className="text-xs px-4 py-2 rounded-full bg-amber-400 hover:bg-amber-300 text-[#0B132B] font-semibold inline-flex items-center gap-2">
            <Download className="w-3.5 h-3.5" /> Excel
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, Icon }) {
  return (
    <div className="glass-light rounded-2xl p-5">
      <Icon className="w-5 h-5 text-amber-700 mb-3" />
      <div className="font-serif-display text-3xl text-[#0B132B]">{value}</div>
      <div className="text-[#0B132B]/60 text-xs uppercase tracking-widest">{label}</div>
    </div>
  );
}

function Table({ head, children }) {
  return (
    <div className="glass-light rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#0B132B]/5">
              {head.map((h) => <th key={h} className="text-left p-3 text-amber-700 text-xs uppercase tracking-widest">{h}</th>)}
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
    : v === "mocked" ? "bg-amber-400/15 text-amber-600"
    : v === "failed" ? "bg-red-500/15 text-red-300"
    : "bg-[#0B132B]/10 text-[#0B132B]/72";
  return <span className={`px-2 py-0.5 text-[10px] rounded-full ${c} uppercase`}>{v}</span>;
}
