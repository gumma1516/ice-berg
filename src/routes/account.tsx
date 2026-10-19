import { useState, useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  IceCreamCone,
  User,
  Phone,
  Mail,
  Sparkles,
  Gift,
  ShoppingBag,
  LogOut,
  Award,
  Clock,
  ArrowRight,
  Heart,
} from "lucide-react";
import { useCustomerAuth } from "@/lib/customer-auth";
import { useMyOrders } from "@/lib/orders-store";
import { ORDER_STATUS_CONFIG } from "@/data/orders";
import { toast } from "sonner";
import { errorMessage } from "@/lib/utils";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "My Account & Loyalty — Ice Age Creamery" },
      {
        name: "description",
        content: "View your Ice Age Creamery member loyalty card, points, and order history.",
      },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const navigate = useNavigate();
  const { customer, logout, authReady } = useCustomerAuth();
  const {
    orders: myOrders,
    loading: ordersLoading,
    error: ordersError,
  } = useMyOrders(customer?.id);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !authReady) {
    return (
      <div className="mx-auto max-w-md px-5 py-24 text-center">
        <span className="mx-auto block h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        <p className="mt-3 text-sm text-muted-foreground">Loading your account…</p>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="mx-auto max-w-md px-5 py-20 text-center animate-rise">
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-berry-soft text-accent">
          <IceCreamCone className="h-8 w-8" />
        </div>
        <h1 className="font-display text-3xl font-semibold text-foreground">Customer Portal</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in or create an account to view your member loyalty points, favorite flavors, and
          order history.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            to="/login"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-soft transition-transform hover:scale-105"
          >
            Sign In
          </Link>
          <Link
            to="/register"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-6 py-3 font-semibold transition-colors hover:bg-muted"
          >
            Register (+100 Pts)
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-12 animate-rise">
      {/* Top Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">
            Ice Age Member
          </span>
          <h1 className="mt-1 font-display text-4xl font-semibold text-foreground sm:text-5xl">
            Hello, {customer.name}!
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Member since {customer.memberSince} • Guntur Creamery Rewards
          </p>
        </div>

        <button
          onClick={async () => {
            try {
              await logout();
              toast.info("You have signed out.");
              navigate({ to: "/" });
            } catch (err) {
              toast.error(errorMessage(err, "Could not sign out. Please try again."));
            }
          }}
          className="inline-flex items-center gap-2 self-start rounded-full border border-border px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Sign Out</span>
        </button>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {/* Digital Loyalty Card */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary/95 to-accent/90 p-6 text-primary-foreground shadow-soft lg:col-span-2">
          {/* Card subtle pattern */}
          <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -left-12 -bottom-12 h-44 w-44 rounded-full bg-caramel/20 blur-2xl" />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-white/20 backdrop-blur-sm">
                <IceCreamCone className="h-5 w-5" />
              </span>
              <div>
                <p className="font-display font-semibold text-lg leading-tight">Ice Age Creamery</p>
                <p className="text-[11px] uppercase tracking-widest opacity-80">VIP Scoop Pass</p>
              </div>
            </div>
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
              {customer.tier}
            </span>
          </div>

          <div className="mt-8">
            <p className="text-xs uppercase tracking-wider opacity-75">Loyalty Points Balance</p>
            <div className="mt-1 flex items-baseline gap-3">
              <span className="font-display text-5xl font-bold">{customer.points}</span>
              <span className="text-sm font-medium opacity-90">Scoop Points</span>
            </div>
            <p className="mt-1 text-xs opacity-75">
              Worth ₹{Math.floor(customer.points * 0.5)} off on your next visit at Krishna Nagar,
              Guntur
            </p>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-white/20 pt-4 text-xs opacity-90">
            <div>
              <p className="opacity-70">Cardholder</p>
              <p className="font-semibold">{customer.name}</p>
            </div>
            <div>
              <p className="opacity-70">Favorite Pick</p>
              <p className="font-semibold">{customer.favoriteFlavor || "Belgian Chocolate"}</p>
            </div>
            <Link
              to="/menu"
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 font-semibold text-primary transition-transform hover:scale-105"
            >
              Order Now <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* Profile Details Card */}
        <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
          <h2 className="font-display text-xl font-semibold text-foreground">Customer Profile</h2>
          <div className="mt-5 space-y-4 text-sm">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-berry-soft text-accent shrink-0">
                <User className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Full Name</p>
                <p className="font-medium text-foreground truncate">{customer.name}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-caramel/20 text-caramel shrink-0">
                <Phone className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Phone Number</p>
                <p className="font-medium text-foreground truncate">
                  {customer.phone || "Not set"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-muted text-foreground shrink-0">
                <Mail className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="font-medium text-foreground truncate">{customer.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-berry-soft text-accent shrink-0">
                <Heart className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Favorite Treat</p>
                <p className="font-medium text-foreground truncate">
                  {customer.favoriteFlavor || "Belgian Chocolate"}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl bg-muted/60 p-3.5 text-xs text-muted-foreground space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Cloud Synced: Firebase Firestore</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Account ID: <code className="font-mono text-foreground">{customer.id}</code>
            </p>
            <p className="mt-0.5 text-[11px]">
              Show your phone number at the café counter to collect points on every dessert.
            </p>
          </div>
        </div>
      </div>

      {/* Recent Orders Section */}
      <div className="mt-12">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-accent" />
            <h2 className="font-display text-2xl font-semibold text-foreground">
              My Orders & Visits
            </h2>
          </div>
          <Link to="/menu" className="text-xs font-semibold text-accent hover:underline">
            Browse Menu →
          </Link>
        </div>

        {ordersError ? (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {ordersError.message}
          </p>
        ) : ordersLoading ? (
          <div className="mt-4 rounded-3xl border border-border bg-card/60 p-8 text-center">
            <span className="mx-auto block h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            <p className="mt-3 text-xs text-muted-foreground">Loading your orders…</p>
          </div>
        ) : myOrders.length === 0 ? (
          <div className="mt-4 rounded-3xl border border-dashed border-border bg-card/60 p-8 text-center">
            <ShoppingBag className="mx-auto h-8 w-8 text-muted-foreground/60" />
            <p className="mt-2 font-medium text-foreground">No orders recorded yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Ask the counter to add your email ({customer.email}) to an order and it will appear
              here automatically.
            </p>
            <Link
              to="/menu"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground shadow-soft transition-transform hover:scale-105"
            >
              Order Something Sweet
            </Link>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {myOrders.map((ord) => {
              const statusCfg = ORDER_STATUS_CONFIG[ord.status] || {
                label: ord.status,
                color: "text-gray-600",
                bg: "bg-gray-100",
              };
              return (
                <div
                  key={ord.id}
                  className="flex flex-col justify-between gap-4 rounded-2xl border border-border bg-card p-4 transition-all sm:flex-row sm:items-center hover:shadow-soft"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-foreground">
                        #{ord.id.slice(-6)}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusCfg.bg} ${statusCfg.color}`}
                      >
                        {statusCfg.label}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        •{" "}
                        {ord.createdAt.toLocaleDateString("en-IN", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                    {ord.fulfilment && (
                      <p className="mt-1 text-xs font-medium text-accent">
                        {ord.fulfilment.type === "delivery" ? "Delivery" : "Pickup"} ·{" "}
                        {ord.fulfilment.slot}
                        {ord.paymentStatus === "paid" ? " · Paid" : " · Pay on collection"}
                      </p>
                    )}
                    <div className="mt-1.5 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {ord.items.map((it, idx) => (
                        <span key={idx}>
                          {it.quantity}x {it.name}
                          {idx < ord.items.length - 1 ? "," : ""}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:text-right">
                    <span className="text-xs text-muted-foreground sm:hidden">Total:</span>
                    <span className="font-display text-lg font-semibold text-accent">
                      ₹{ord.total}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
