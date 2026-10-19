import { mainMenu, weekendMenu } from "./menu";
import { STORE_TIME_ZONE, storeDateKey, storeMinutesSinceMidnight } from "@/lib/store-time";

// ── Types ──────────────────────────────────────────────────────
export type OrderStatus =
  /** Placed online by a customer; the store has not accepted it yet. */
  "awaiting_confirmation" | "pending" | "preparing" | "ready" | "completed" | "cancelled";

export type PaymentMethod = "cash" | "upi" | "card" | "online";

/** Where the money stands. Only the store or the gateway may set "paid". */
export type PaymentStatus = "unpaid" | "pending" | "paid" | "failed" | "refunded";

/** How the order reached the store. */
export type OrderChannel = "counter" | "online";

export type FulfilmentType = "pickup" | "delivery";

export type DeliveryAddress = {
  line1: string;
  line2?: string | undefined;
  area: string;
  city: string;
  pincode: string;
  landmark?: string | undefined;
};

export type Fulfilment = {
  type: FulfilmentType;
  /** Requested time, e.g. "As soon as possible" or "7:30 PM". */
  slot: string;
  address?: DeliveryAddress | undefined;
};

export type OrderItem = {
  name: string;
  quantity: number;
  price: number;
  /** Catalog sku, present on online orders so prices can be re-checked. */
  sku?: string | undefined;
};

export type Order = {
  id: string;
  customerName: string;
  phone: string;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  createdAt: Date;
  notes?: string | undefined;
  channel?: OrderChannel | undefined;
  paymentStatus?: PaymentStatus | undefined;
  /** Items total before the delivery fee. */
  subtotal?: number | undefined;
  deliveryFee?: number | undefined;
  fulfilment?: Fulfilment | undefined;
  /** Bank UTR / provider payment reference, set by the payment webhook. */
  paymentReference?: string | undefined;
  paymentGatewayId?: string | undefined;
  /** True when the gateway reported an amount that is not the order total. */
  paymentAmountMismatch?: boolean | undefined;
  paymentReportedPaise?: number | undefined;
  /** Set when the order is linked to a registered customer account (their uid). */
  customerId?: string | null;
  /** Kept alongside the uid so staff can find an order by email. */
  customerEmail?: string | null;
};

/**
 * A human-readable order id with a high-entropy suffix: IA-<store-date>-<random>.
 * Sequential ids derived from the loaded order count can collide when two
 * tills create an order at the same moment, which silently overwrites one.
 */
export function generateOrderId(now = new Date()): string {
  const datePart = storeDateKey(now).replaceAll("-", "").slice(2);

  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  const bytes =
    typeof crypto !== "undefined" && crypto.getRandomValues
      ? crypto.getRandomValues(new Uint8Array(12))
      : null;

  for (let i = 0; i < 12; i++) {
    const value = bytes ? bytes[i]! : Math.floor(Math.random() * 256);
    suffix += alphabet[value % alphabet.length];
  }

  return `IA-${datePart}-${suffix}`;
}

// ── Status Display Configurations ──────────────────────────────
export const ORDER_STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; color: string; bg: string }
> = {
  awaiting_confirmation: {
    label: "Needs confirming",
    color: "text-violet-700",
    bg: "bg-violet-100",
  },
  pending: { label: "Pending", color: "text-amber-700", bg: "bg-amber-100" },
  preparing: { label: "Preparing", color: "text-blue-700", bg: "bg-blue-100" },
  ready: { label: "Ready", color: "text-emerald-700", bg: "bg-emerald-100" },
  completed: { label: "Completed", color: "text-gray-600", bg: "bg-gray-100" },
  cancelled: { label: "Cancelled", color: "text-red-700", bg: "bg-red-100" },
};

// ── Production Analytics Helpers ───────────────────────────────
export type DailyStats = {
  date: string;
  label: string;
  revenue: number;
  orders: number;
  avgOrderValue: number;
};

export type CategoryStats = {
  category: string;
  revenue: number;
  orders: number;
};

export type ItemStats = {
  name: string;
  quantity: number;
  revenue: number;
};

export type HourlyStats = {
  hour: number;
  label: string;
  orders: number;
};

const allCategories = [weekendMenu, ...mainMenu];

export function getDailyStats(orders: Order[], days: number, now = new Date()): DailyStats[] {
  const stats: DailyStats[] = [];

  for (let d = days - 1; d >= 0; d--) {
    const date = new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
    const dateStr = storeDateKey(date);
    const dayOrders = orders.filter(
      (o) => storeDateKey(o.createdAt) === dateStr && o.status === "completed",
    );
    const revenue = dayOrders.reduce((s, o) => s + o.total, 0);
    stats.push({
      date: dateStr,
      label: date.toLocaleDateString("en-IN", {
        timeZone: STORE_TIME_ZONE,
        weekday: "short",
        day: "numeric",
      }),
      revenue,
      orders: dayOrders.length,
      avgOrderValue: dayOrders.length > 0 ? Math.round(revenue / dayOrders.length) : 0,
    });
  }
  return stats;
}

export function getCategoryStats(orders: Order[]): CategoryStats[] {
  const completedOrders = orders.filter((o) => o.status === "completed");
  return allCategories
    .map((cat) => {
      const itemNames = new Set(cat.items.map((i) => i.name));
      let revenue = 0;
      let orderCount = 0;
      for (const order of completedOrders) {
        let found = false;
        for (const item of order.items) {
          if (itemNames.has(item.name)) {
            revenue += item.price * item.quantity;
            found = true;
          }
        }
        if (found) orderCount++;
      }
      return { category: cat.title, revenue, orders: orderCount };
    })
    .filter((c) => c.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue);
}

export function getTopItems(orders: Order[], limit = 10): ItemStats[] {
  const completed = orders.filter((o) => o.status === "completed");
  const map = new Map<string, { quantity: number; revenue: number }>();
  for (const order of completed) {
    for (const item of order.items) {
      const existing = map.get(item.name);
      if (existing) {
        existing.quantity += item.quantity;
        existing.revenue += item.price * item.quantity;
      } else {
        map.set(item.name, { quantity: item.quantity, revenue: item.price * item.quantity });
      }
    }
  }
  return Array.from(map.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, limit);
}

export function getHourlyStats(orders: Order[]): HourlyStats[] {
  const active = orders.filter((o) => o.status !== "cancelled");
  const hours: number[] = Array.from({ length: 12 }, () => 0);
  for (const order of active) {
    const h = Math.floor(storeMinutesSinceMidnight(order.createdAt) / 60);
    if (h >= 10 && h <= 21) {
      hours[h - 10]! += 1;
    }
  }
  return hours.map((count, i) => ({
    hour: i + 10,
    label: `${i + 10 > 12 ? i + 10 - 12 : i + 10}${i + 10 >= 12 ? "PM" : "AM"}`,
    orders: count,
  }));
}
