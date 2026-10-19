import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  TrendingUp,
  BarChart3,
  Calendar,
  Download,
  IndianRupee,
  ShoppingBag,
  Users,
  Clock,
  Sparkles,
  ArrowUpRight,
  PieChart as PieIcon,
  CreditCard,
  Flame,
  Database,
} from "lucide-react";
import {
  getDailyStats,
  getCategoryStats,
  getTopItems,
  getHourlyStats,
  type PaymentMethod,
} from "@/data/orders";
import { useOrders } from "@/lib/orders-store";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from "recharts";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/analytics")({
  head: () => ({
    meta: [{ title: "Data Analytics — Ice Age Admin" }],
  }),
  component: AdminAnalyticsPage,
});

const PALETTE = [
  "#c88a4b", // Caramel Accent
  "#802636", // Berry Primary
  "#3a7260", // Mint
  "#d65d45", // Warm Coral
  "#6b5b95", // Grape
  "#feb236", // Warm Honey
  "#5e454b", // Deep Cocoa
];

function AdminAnalyticsPage() {
  const [daysRange, setDaysRange] = useState<7 | 14 | 30>(7);
  const { orders, isFirebaseConfigured, firebaseProjectId } = useOrders();

  // Computed analytics
  const dailyStats = useMemo(() => getDailyStats(orders, daysRange), [orders, daysRange]);
  const categoryStats = useMemo(() => getCategoryStats(orders), [orders]);
  const topItems = useMemo(() => getTopItems(orders, 10), [orders]);
  const hourlyStats = useMemo(() => getHourlyStats(orders), [orders]);

  // Summary Metrics
  const totalPeriodRevenue = useMemo(
    () => dailyStats.reduce((sum, d) => sum + d.revenue, 0),
    [dailyStats],
  );
  const totalPeriodOrders = useMemo(
    () => dailyStats.reduce((sum, d) => sum + d.orders, 0),
    [dailyStats],
  );
  const avgTicket = totalPeriodOrders > 0 ? Math.round(totalPeriodRevenue / totalPeriodOrders) : 0;
  const avgDailyRevenue = Math.round(totalPeriodRevenue / daysRange);

  // Payment Breakdown
  const paymentStats = useMemo(() => {
    const counts: Record<PaymentMethod, number> = { upi: 0, cash: 0, card: 0, online: 0 };
    orders.forEach((o) => {
      if (o.status !== "cancelled") counts[o.paymentMethod] += o.total;
    });
    return [
      { name: "UPI (Google Pay / PhonePe)", value: counts.upi, color: "#10b981" },
      { name: "Cash on Counter", value: counts.cash, color: "#f59e0b" },
      { name: "Debit / Credit Card", value: counts.card, color: "#3b82f6" },
      { name: "Paid Online", value: counts.online, color: "#8b5cf6" },
    ];
  }, [orders]);

  // CSV Export
  const handleExportCSV = () => {
    if (orders.length === 0) {
      toast.info("No orders to export yet.");
      return;
    }
    const headers = "Date,Day,Revenue (INR),Orders,Average Order Value\n";
    const rows = dailyStats
      .map((d) => `${d.date},${d.label},${d.revenue},${d.orders},${d.avgOrderValue}`)
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `ice-age-creamery-analytics-${daysRange}d.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Analytics report downloaded successfully!");
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-2xl font-bold">Sales & Operations Analytics</h2>
            {isFirebaseConfigured ? (
              <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                <Database className="h-3 w-3" /> Firebase Live
              </span>
            ) : (
              <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-800">
                <Database className="h-3 w-3" /> Firebase Ready
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            In-depth performance insights, revenue curves, peak rush periods, and menu engineering
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Timeframe switch */}
          <div className="flex rounded-xl bg-muted p-1 text-xs font-semibold">
            {([7, 14, 30] as const).map((r) => (
              <button
                key={r}
                onClick={() => setDaysRange(r)}
                className={`rounded-lg px-3 py-1.5 transition ${
                  daysRange === r
                    ? "bg-white text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {r === 7 ? "7 Days" : r === 14 ? "14 Days" : "30 Days"}
              </button>
            ))}
          </div>

          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-3.5 py-2 text-xs font-semibold shadow-sm transition hover:bg-muted"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Total Sales ({daysRange}D)
            </span>
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-50 text-emerald-600">
              <IndianRupee className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-display text-3xl font-bold">
              ₹{totalPeriodRevenue.toLocaleString("en-IN")}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            ₹{avgDailyRevenue.toLocaleString("en-IN")} avg per day
          </p>
        </div>

        <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Orders</span>
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-50 text-blue-600">
              <ShoppingBag className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-display text-3xl font-bold">{totalPeriodOrders}</span>
            <span className="text-xs font-medium text-muted-foreground">Completed</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            ~{Math.round(totalPeriodOrders / daysRange)} orders/day
          </p>
        </div>

        <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Average Basket Size
            </span>
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-amber-50 text-amber-600">
              <TrendingUp className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-display text-3xl font-bold">₹{avgTicket}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {totalPeriodOrders > 0
              ? "Calculated across completed orders"
              : "Awaiting first completed order"}
          </p>
        </div>

        <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Data Source</span>
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-purple-50 text-purple-600">
              <Database className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-display text-lg font-bold">
              {isFirebaseConfigured ? "Firestore Live" : "Local Sync"}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {isFirebaseConfigured ? `Project: ${firebaseProjectId}` : "Ready for cloud .env keys"}
          </p>
        </div>
      </div>

      {/* Main Revenue & Order Chart */}
      <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <h3 className="font-display text-lg font-bold">Revenue & Order Volume Trend</h3>
            <p className="text-xs text-muted-foreground">
              Daily revenue (left axis) compared against customer order volume (right axis)
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 font-medium text-accent">
              <span className="h-3 w-3 rounded-sm bg-accent" /> Revenue (₹)
            </span>
            <span className="flex items-center gap-1.5 font-medium text-[#802636]">
              <span className="h-3 w-3 rounded-sm bg-[#802636]" /> Orders Count
            </span>
          </div>
        </div>

        <div className="mt-6 h-72 w-full">
          {totalPeriodOrders === 0 ? (
            <div className="flex h-full flex-col items-center justify-center rounded-xl bg-[#faf9f8] p-6 text-center">
              <BarChart3 className="h-8 w-8 text-muted-foreground/40" />
              <p className="mt-2 text-sm font-semibold text-foreground">No Historical Orders Yet</p>
              <p className="mt-0.5 text-xs text-muted-foreground max-w-sm">
                No completed transaction records found for this period. Analytics and rush trend
                lines will plot here automatically as customer orders are fulfilled.
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyStats} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="areaRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#c88a4b" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#c88a4b" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#888" }} stroke="#eee" />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 11, fill: "#888" }}
                  stroke="#eee"
                  tickFormatter={(v) => `₹${v}`}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11, fill: "#888" }}
                  stroke="#eee"
                />
                <Tooltip
                  formatter={(val: number, name: string) => [
                    name === "revenue" ? `₹${val.toLocaleString("en-IN")}` : val,
                    name === "revenue" ? "Revenue" : "Orders",
                  ]}
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid #eaeaea",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                  }}
                />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="revenue"
                  stroke="#c88a4b"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#areaRevenue)"
                />
                <Bar
                  yAxisId="right"
                  dataKey="orders"
                  fill="#802636"
                  radius={[4, 4, 0, 0]}
                  opacity={0.8}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Hourly Rush & Category Distribution */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Hourly Traffic Curve */}
        <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-lg font-bold flex items-center gap-2">
                <Clock className="h-4 w-4 text-accent" /> Hourly Rush Analysis
              </h3>
              <p className="text-xs text-muted-foreground">
                Distribution of walk-ins and orders throughout café operating hours
              </p>
            </div>
          </div>

          <div className="mt-6 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyStats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#888" }} stroke="#eee" />
                <YAxis tick={{ fontSize: 11, fill: "#888" }} stroke="#eee" />
                <Tooltip
                  formatter={(val: number) => [`${val} orders`, "Rush Volume"]}
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid #eaeaea",
                  }}
                />
                <Bar dataKey="orders" fill="#c88a4b" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 p-2.5 rounded-xl">
            <Flame className="h-4 w-4 shrink-0" />
            <span>
              <strong>Staff Peak Readiness:</strong> 7:00 PM – 9:30 PM is historical peak dessert
              rush hour in Guntur.
            </span>
          </div>
        </div>

        {/* Category Contribution */}
        <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-lg font-bold flex items-center gap-2">
                <PieIcon className="h-4 w-4 text-accent" /> Revenue by Category
              </h3>
              <p className="text-xs text-muted-foreground">
                How each dessert menu section contributes to gross turnover
              </p>
            </div>
          </div>

          <div className="mt-4 h-56 w-full">
            {categoryStats.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center rounded-xl bg-[#faf9f8] p-4 text-center">
                <PieIcon className="h-6 w-6 text-muted-foreground/40" />
                <p className="mt-1 text-xs text-muted-foreground">No completed category data yet</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryStats}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="revenue"
                    nameKey="category"
                  >
                    {categoryStats.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PALETTE[index % PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: number) => [`₹${val.toLocaleString("en-IN")}`, "Sales"]}
                    contentStyle={{ borderRadius: "8px", border: "1px solid #eaeaea" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {categoryStats.length > 0 && (
            <div className="grid grid-cols-2 gap-2 text-xs mt-2">
              {categoryStats.map((cat, idx) => (
                <div
                  key={cat.category}
                  className="flex items-center justify-between p-1.5 rounded-lg bg-[#faf9f8]"
                >
                  <span className="flex items-center gap-2 truncate">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: PALETTE[idx % PALETTE.length] }}
                    />
                    <span className="truncate">{cat.category}</span>
                  </span>
                  <span className="font-semibold shrink-0">
                    ₹{cat.revenue.toLocaleString("en-IN")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top 10 Star Delights & Payment Distribution */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Top 10 Menu Items (2 cols) */}
        <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm lg:col-span-2">
          <h3 className="font-display text-lg font-bold">Top Performing Menu Delights</h3>
          <p className="text-xs text-muted-foreground">
            Ranked by unit demand and financial sales impact
          </p>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-[#faf9f8] text-muted-foreground font-semibold uppercase">
                <tr>
                  <th className="py-2.5 px-3">Rank & Item</th>
                  <th className="py-2.5 px-3 text-center">Units Sold</th>
                  <th className="py-2.5 px-3 text-right">Gross Revenue</th>
                  <th className="py-2.5 px-3 text-right">Share of Sales</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {topItems.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-muted-foreground">
                      No order items yet. Top performers will rank as orders arrive.
                    </td>
                  </tr>
                ) : (
                  topItems.map((item, idx) => {
                    const share =
                      totalPeriodRevenue > 0
                        ? ((item.revenue / totalPeriodRevenue) * 100).toFixed(1)
                        : "0.0";
                    return (
                      <tr key={item.name} className="hover:bg-[#faf9f8]/60">
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold ${
                                idx < 3
                                  ? "bg-accent text-accent-foreground"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {idx + 1}
                            </span>
                            <span className="font-semibold text-foreground">{item.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center font-medium">{item.quantity}</td>
                        <td className="py-3 px-3 text-right font-display font-bold">
                          ₹{item.revenue.toLocaleString("en-IN")}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="h-1.5 w-16 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-accent"
                                style={{ width: `${Math.min(100, parseFloat(share) * 5)}%` }}
                              />
                            </div>
                            <span className="font-medium text-muted-foreground">{share}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Payment Breakdown */}
        <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
          <h3 className="font-display text-lg font-bold">Payment Methods</h3>
          <p className="text-xs text-muted-foreground">Digital vs Counter collection</p>

          <div className="mt-6 space-y-4">
            {paymentStats.map((p) => {
              const totalAll = paymentStats.reduce((s, x) => s + x.value, 0);
              const pct = totalAll > 0 ? ((p.value / totalAll) * 100).toFixed(1) : "0";
              return (
                <div key={p.name} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-medium">
                    <span>{p.name}</span>
                    <span className="font-bold">
                      ₹{p.value.toLocaleString("en-IN")} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: p.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8 rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground mb-1">💡 Smart Operations:</p>
            UPI & counter QR codes accelerate bill settlement for dessert customers. All
            transactions log in real-time to your dashboard.
          </div>
        </div>
      </div>
    </div>
  );
}
