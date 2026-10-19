import { errorMessage } from "@/lib/utils";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  TrendingUp,
  ShoppingBag,
  Clock,
  IndianRupee,
  ArrowUpRight,
  ChevronRight,
  Flame,
  CheckCircle2,
  Sparkles,
  Database,
  Plus,
} from "lucide-react";
import {
  getDailyStats,
  getCategoryStats,
  getTopItems,
  ORDER_STATUS_CONFIG,
  type OrderStatus,
} from "@/data/orders";
import { useOrders } from "@/lib/orders-store";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [{ title: "Dashboard — Ice Age Admin" }],
  }),
  component: AdminDashboardPage,
});

const CATEGORY_COLORS = [
  "#c88a4b", // Caramel
  "#802636", // Berry
  "#3a7260", // Mint
  "#d65d45", // Warm coral
  "#6b5b95", // Purple
  "#feb236", // Gold
];

function AdminDashboardPage() {
  const { orders, updateOrderStatus, isFirebaseConfigured, firebaseProjectId } = useOrders();
  const [statusFilter, setStatusFilter] = useState<"all" | "active">("active");

  // Today's orders
  const todayStr = new Date().toISOString().split("T")[0]!;
  const todayOrders = orders.filter(
    (o) => o.createdAt.toISOString().split("T")[0] === todayStr && o.status !== "cancelled",
  );
  const todayRevenue = todayOrders.reduce((sum, o) => sum + o.total, 0);
  const activeOrders = orders.filter((o) =>
    ["awaiting_confirmation", "pending", "preparing", "ready"].includes(o.status),
  );
  // Website orders the store has not accepted yet — these are the urgent ones.
  const toConfirm = orders.filter((o) => o.status === "awaiting_confirmation");
  const avgOrderValue = todayOrders.length > 0 ? Math.round(todayRevenue / todayOrders.length) : 0;

  // Chart data
  const dailyStats = getDailyStats(orders, 7);
  const categoryStats = getCategoryStats(orders).slice(0, 5);
  const topItems = getTopItems(orders, 5);

  const displayedOrders = statusFilter === "active" ? activeOrders : orders.slice(0, 10);

  const handleUpdateStatus = async (orderId: string, newStatus: OrderStatus) => {
    try {
      await updateOrderStatus(orderId, newStatus);
      toast.success(`Order ${orderId} updated to ${ORDER_STATUS_CONFIG[newStatus].label}`);
    } catch (err) {
      toast.error("Could not update the order", {
        description: errorMessage(err, "The change was not saved. Please try again."),
      });
    }
  };

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#1a1410] via-[#2d221c] to-[#3a2c24] p-6 text-white shadow-xl md:p-8">
        <div className="relative z-10 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-accent">
              <Sparkles className="h-4 w-4" /> Live Café Status
            </div>
            <h2 className="mt-1 font-display text-2xl font-bold md:text-3xl">
              Ice Age Creamery Dashboard
            </h2>
            <p className="mt-1 text-sm text-white/70">
              Station Road, Guntur • Operating Hours: 11:00 AM – 10:30 PM
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {/* Firebase Status Badge */}
            {isFirebaseConfigured ? (
              <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3.5 py-1.5 text-xs font-medium text-emerald-300 backdrop-blur-md">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                </span>
                <Database className="h-3.5 w-3.5" /> Firebase Live ({firebaseProjectId})
              </div>
            ) : (
              <div
                title="Firebase ready. Add VITE_FIREBASE_* in .env to connect cloud Firestore."
                className="flex items-center gap-1.5 rounded-full bg-amber-500/20 px-3.5 py-1.5 text-xs font-medium text-amber-300 backdrop-blur-md"
              >
                <Database className="h-3.5 w-3.5" /> Firebase Ready (Local Sync)
              </div>
            )}

            <div className="flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-medium text-white/90 backdrop-blur-md">
              <span className="h-2 w-2 rounded-full bg-emerald-400" /> Kitchen Ready
            </div>

            <Link
              to="/admin/orders"
              className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground transition hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" /> Place Order
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Today's Sales */}
        <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Today's Revenue</span>
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-50 text-emerald-600">
              <IndianRupee className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-display text-3xl font-bold text-foreground">
              ₹{todayRevenue.toLocaleString("en-IN")}
            </span>
            {todayRevenue > 0 && (
              <span className="flex items-center text-xs font-medium text-emerald-600">
                <TrendingUp className="mr-0.5 h-3 w-3" /> Live
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            From {todayOrders.length} completed transactions
          </p>
        </div>

        {/* Active In Kitchen */}
        <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">In Kitchen Queue</span>
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-amber-50 text-amber-600">
              <Flame className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-display text-3xl font-bold text-foreground">
              {activeOrders.length}
            </span>
            <span className="text-xs font-medium text-amber-600">
              {toConfirm.length > 0
                ? `${toConfirm.length} website order${toConfirm.length === 1 ? "" : "s"} to confirm`
                : `${orders.filter((o) => o.status === "pending").length} pending`}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {activeOrders.length === 0 ? "No pending kitchen orders" : "Requires preparation now"}
          </p>
        </div>

        {/* Orders Today */}
        <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Total Orders Today
            </span>
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-50 text-blue-600">
              <ShoppingBag className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-display text-3xl font-bold text-foreground">
              {todayOrders.length}
            </span>
            {todayOrders.length > 0 && (
              <span className="flex items-center text-xs font-medium text-blue-600">
                <ArrowUpRight className="mr-0.5 h-3 w-3" /> Active
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Across dine-in & takeaway</p>
        </div>

        {/* Avg Order Ticket */}
        <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Avg Order Value</span>
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-purple-50 text-purple-600">
              <Clock className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-display text-3xl font-bold text-foreground">
              ₹{avgOrderValue}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Target: ₹400+ per guest</p>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Sales Trend (2 cols) */}
        <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-lg font-bold">Revenue Trend (Last 7 Days)</h3>
              <p className="text-xs text-muted-foreground">
                Daily sales performance and customer volume
              </p>
            </div>
            <Link
              to="/admin/analytics"
              className="text-xs font-medium text-accent hover:underline flex items-center gap-1"
            >
              Detailed Analytics <ChevronRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="mt-6 h-64 w-full">
            {todayRevenue === 0 && orders.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center rounded-xl bg-[#faf9f8] p-6 text-center">
                <ShoppingBag className="h-8 w-8 text-muted-foreground/50" />
                <p className="mt-2 text-sm font-semibold text-foreground">Awaiting First Order</p>
                <p className="mt-0.5 text-xs text-muted-foreground max-w-sm">
                  No sales transactions recorded yet today. Counter and phone orders will plot live
                  revenue curves here in real time.
                </p>
                <Link
                  to="/admin/orders"
                  className="mt-3 rounded-xl bg-accent px-4 py-1.5 text-xs font-semibold text-accent-foreground"
                >
                  Create New Order
                </Link>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyStats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#c88a4b" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#c88a4b" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#888" }} stroke="#eee" />
                  <YAxis
                    tick={{ fontSize: 12, fill: "#888" }}
                    stroke="#eee"
                    tickFormatter={(v) => `₹${v}`}
                  />
                  <Tooltip
                    formatter={(val: number) => [`₹${val.toLocaleString("en-IN")}`, "Revenue"]}
                    contentStyle={{
                      borderRadius: "12px",
                      border: "1px solid #eaeaea",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#c88a4b"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#revenueGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Category Share */}
        <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-lg font-bold">Category Share</h3>
              <p className="text-xs text-muted-foreground">By sales revenue contribution</p>
            </div>
          </div>

          <div className="mt-4 h-48 w-full">
            {categoryStats.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center rounded-xl bg-[#faf9f8] p-4 text-center">
                <Sparkles className="h-6 w-6 text-muted-foreground/40" />
                <p className="mt-1 text-xs text-muted-foreground">No completed orders yet</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryStats}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="revenue"
                    nameKey="category"
                  >
                    {categoryStats.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: number) => [`₹${val.toLocaleString("en-IN")}`, "Revenue"]}
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid #eaeaea",
                      fontSize: "12px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {categoryStats.length > 0 && (
            <div className="mt-2 space-y-1.5 text-xs">
              {categoryStats.map((cat, idx) => (
                <div key={cat.category} className="flex items-center justify-between">
                  <span className="flex items-center gap-2 truncate">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: CATEGORY_COLORS[idx % CATEGORY_COLORS.length] }}
                    />
                    <span className="truncate">{cat.category}</span>
                  </span>
                  <span className="font-semibold">₹{cat.revenue.toLocaleString("en-IN")}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Live Order Queue & Top Items */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Live Orders (2 cols) */}
        <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm lg:col-span-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-display text-lg font-bold">Kitchen & Order Queue</h3>
              <p className="text-xs text-muted-foreground">
                Manage ongoing and recent orders in real-time
              </p>
            </div>
            <div className="flex items-center gap-1 rounded-xl bg-muted p-1 text-xs font-medium">
              <button
                onClick={() => setStatusFilter("active")}
                className={`rounded-lg px-3 py-1.5 transition ${
                  statusFilter === "active"
                    ? "bg-white text-foreground shadow-sm"
                    : "text-muted-foreground"
                }`}
              >
                In Kitchen ({activeOrders.length})
              </button>
              <button
                onClick={() => setStatusFilter("all")}
                className={`rounded-lg px-3 py-1.5 transition ${
                  statusFilter === "all"
                    ? "bg-white text-foreground shadow-sm"
                    : "text-muted-foreground"
                }`}
              >
                Recent Orders
              </button>
            </div>
          </div>

          <div className="mt-5 divide-y divide-gray-100">
            {displayedOrders.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
                <p className="mt-2 text-sm font-medium">
                  All caught up! No active orders in queue.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Ready to take orders from counter or phone callers.
                </p>
                <Link
                  to="/admin/orders"
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground"
                >
                  <Plus className="h-3.5 w-3.5" /> Create Walk-in Order
                </Link>
              </div>
            ) : (
              displayedOrders.map((order) => {
                const cfg = ORDER_STATUS_CONFIG[order.status];
                return (
                  <div
                    key={order.id}
                    className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold">{order.id}</span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${cfg.bg} ${cfg.color}`}
                        >
                          {cfg.label}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {order.createdAt.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-foreground">
                        {order.customerName}{" "}
                        <span className="text-xs text-muted-foreground font-normal">
                          ({order.phone})
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {order.items.map((i) => `${i.quantity}x ${i.name}`).join(", ")}
                      </p>
                      {order.notes && (
                        <p className="text-xs italic text-amber-600">Note: {order.notes}</p>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                      <span className="font-display text-base font-bold text-foreground">
                        ₹{order.total}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {order.status === "pending" && (
                          <button
                            onClick={() => handleUpdateStatus(order.id, "preparing")}
                            className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                          >
                            Start Preparing
                          </button>
                        )}
                        {order.status === "preparing" && (
                          <button
                            onClick={() => handleUpdateStatus(order.id, "ready")}
                            className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                          >
                            Mark Ready
                          </button>
                        )}
                        {order.status === "ready" && (
                          <button
                            onClick={() => handleUpdateStatus(order.id, "completed")}
                            className="rounded-lg bg-gray-800 px-2.5 py-1 text-xs font-medium text-white hover:bg-black"
                          >
                            Complete
                          </button>
                        )}
                        <Link
                          to="/admin/orders"
                          className="rounded-lg border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
                        >
                          Details
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Top Items Leaderboard */}
        <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-bold">Top Delights</h3>
            <span className="text-xs text-muted-foreground">Best sellers</span>
          </div>
          <p className="text-xs text-muted-foreground">By units ordered</p>

          <div className="mt-5 space-y-4">
            {topItems.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No orders recorded yet. Top dishes will rank automatically.
              </div>
            ) : (
              topItems.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 truncate">
                    <span
                      className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${
                        index === 0
                          ? "bg-amber-100 text-amber-800"
                          : index === 1
                            ? "bg-gray-100 text-gray-700"
                            : index === 2
                              ? "bg-amber-50 text-amber-700"
                              : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <div className="truncate">
                      <p className="truncate text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.quantity} orders</p>
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-semibold">
                    ₹{item.revenue.toLocaleString("en-IN")}
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="mt-6 rounded-xl bg-[#faf7f2] p-3 text-xs text-[#6e5d50]">
            💡 <strong>Staff Tip:</strong> Peak dessert hours in Guntur are 7:00 PM – 9:30 PM. Keep
            waffle batter and chocolate fudge prepped.
          </div>
        </div>
      </div>
    </div>
  );
}
