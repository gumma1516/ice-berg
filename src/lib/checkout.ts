import {
  findCatalogItem,
  findCatalogItemByName,
  isAvailableToday,
  type CatalogItem,
} from "@/data/menu";
import {
  generateOrderId,
  type DeliveryAddress,
  type Fulfilment,
  type FulfilmentType,
  type Order,
  type OrderItem,
} from "@/data/orders";
import { MAX_QUANTITY_PER_ITEM, type CartLine } from "./cart";
import type { CustomerProfile } from "./customer-auth";
import { createOnlineOrderInFirestore } from "./firebase";
import type { PaymentChoice } from "./payments";

/**
 * Checkout pricing and order placement.
 *
 * Prices are always resolved from the menu catalog, never taken from the page.
 * An online order is created as `awaiting_confirmation`: the store accepts it
 * at the till, where `verifyOrderPricing` re-checks every line against the
 * current menu before anyone is charged.
 */

export { DELIVERY, quoteOrder } from "./order-pricing";
import { DELIVERY, quoteOrder } from "./order-pricing";
import { STORE_OPEN_MINUTE, STORE_CLOSE_MINUTE, storeMinutesSinceMidnight } from "./store-time";

export const PICKUP_MINIMUM_SUBTOTAL = 0;

export const ASAP_SLOT = "As soon as possible";

/** Today's slots are at least 30 minutes ahead, in the store's time zone. */
export function timeSlotsForToday(now = new Date()): string[] {
  const minute = storeMinutesSinceMidnight(now);
  const earliest = Math.max(STORE_OPEN_MINUTE, Math.ceil((minute + 30) / 30) * 30);
  if (earliest > STORE_CLOSE_MINUTE) return [];
  const slots: string[] = isStoreOpenNow(now) ? [ASAP_SLOT] : [];
  for (let cursor = earliest; cursor <= STORE_CLOSE_MINUTE; cursor += 30) {
    const hour = Math.floor(cursor / 60);
    slots.push(
      `${hour % 12 || 12}:${String(cursor % 60).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`,
    );
  }
  return slots;
}

export function isStoreOpenNow(now = new Date()): boolean {
  const minute = storeMinutesSinceMidnight(now);
  return minute >= STORE_OPEN_MINUTE && minute < STORE_CLOSE_MINUTE;
}

export function isServiceablePincode(pincode: string): boolean {
  return (DELIVERY.serviceablePincodes as readonly string[]).includes(pincode.trim());
}

export type CheckoutProblem = { field: string; message: string };

/** Everything that must hold before an order may be placed. */
export function validateCheckout(input: {
  lines: CartLine[];
  fulfilmentType: FulfilmentType;
  slot: string;
  address: Partial<DeliveryAddress>;
  phone: string;
  now?: Date;
}): CheckoutProblem[] {
  const problems: CheckoutProblem[] = [];
  const now = input.now ?? new Date();

  if (input.lines.length === 0) {
    problems.push({ field: "cart", message: "Your cart is empty." });
  }

  if (
    input.lines.some(
      (line) =>
        !Number.isInteger(line.quantity) ||
        line.quantity < 1 ||
        line.quantity > MAX_QUANTITY_PER_ITEM,
    )
  ) {
    problems.push({
      field: "cart",
      message: `Choose between 1 and ${MAX_QUANTITY_PER_ITEM} of each item.`,
    });
  }
  const unknown = input.lines.filter((line) => !findCatalogItem(line.sku));
  if (unknown.length) {
    problems.push({
      field: "cart",
      message: "An item is no longer on the menu. Remove it from your cart to continue.",
    });
  }
  const unavailable = input.lines.filter((line) => {
    const item = findCatalogItem(line.sku);
    return item ? !isAvailableToday(item, now) : false;
  });
  if (unavailable.length > 0) {
    problems.push({
      field: "cart",
      message: `${unavailable
        .map((line) => line.name)
        .join(", ")} is only available on Saturdays and Sundays. Please remove it to continue.`,
    });
  }

  const phoneDigits = input.phone.replace(/\D/g, "");
  if (!/^(?:91)?[6-9]\d{9}$/.test(phoneDigits)) {
    problems.push({ field: "phone", message: "Enter a 10-digit phone number we can call." });
  }

  const slots = timeSlotsForToday(now);
  if (!slots.includes(input.slot)) {
    problems.push({
      field: "slot",
      message: slots.length
        ? "Choose an available time for today (India Standard Time)."
        : "Ordering has closed for today. Please return tomorrow from 11 AM.",
    });
  }

  const { subtotal } = quoteOrder(input.lines, input.fulfilmentType);

  if (input.fulfilmentType === "delivery") {
    if (subtotal < DELIVERY.minimumSubtotal) {
      problems.push({
        field: "cart",
        message: `Delivery orders start at ₹${DELIVERY.minimumSubtotal}. Add ₹${
          DELIVERY.minimumSubtotal - subtotal
        } more, or switch to pickup.`,
      });
    }
    if (!input.address.line1?.trim()) {
      problems.push({ field: "line1", message: "Enter the flat or house and street." });
    }
    if (!input.address.area?.trim()) {
      problems.push({ field: "area", message: "Enter the area or locality." });
    }
    const pincode = (input.address.pincode ?? "").trim();
    if (!/^\d{6}$/.test(pincode)) {
      problems.push({ field: "pincode", message: "Enter a 6-digit pincode." });
    } else if (!isServiceablePincode(pincode)) {
      problems.push({
        field: "pincode",
        message: `We don't deliver to ${pincode} yet. Pickup is available for every order.`,
      });
    }
  }

  return problems;
}

export type PricingCheck = {
  matches: boolean;
  expectedSubtotal: number;
  expectedDeliveryFee: number;
  expectedTotal: number;
  issues: string[];
};

/**
 * Re-prices an order against the current menu. The staff screen runs this
 * before confirming an online order, so a tampered or stale cart is caught
 * before anything is made or charged.
 */
export function verifyOrderPricing(order: Order): PricingCheck {
  const issues: string[] = [];
  let expectedSubtotal = 0;

  for (const item of order.items) {
    const catalogItem: CatalogItem | undefined = item.sku
      ? findCatalogItem(item.sku)
      : findCatalogItemByName(item.name);

    if (!catalogItem) {
      issues.push(`“${item.name}” is not on the current menu.`);
      expectedSubtotal += item.price * item.quantity;
      continue;
    }

    if (catalogItem.price !== item.price) {
      issues.push(
        `“${item.name}” was ordered at ₹${item.price}; the menu price is ₹${catalogItem.price}.`,
      );
    }

    expectedSubtotal += catalogItem.price * item.quantity;
  }

  const fulfilmentType = order.fulfilment?.type ?? "pickup";
  const expected = quoteOrder(
    order.items.map((item) => ({
      price: item.sku
        ? (findCatalogItem(item.sku)?.price ?? item.price)
        : (findCatalogItemByName(item.name)?.price ?? item.price),
      quantity: item.quantity,
    })),
    fulfilmentType,
  );

  if (order.total !== expected.total) {
    issues.push(`Order total is ₹${order.total}; the menu works out to ₹${expected.total}.`);
  }

  return {
    matches: issues.length === 0,
    expectedSubtotal,
    expectedDeliveryFee: expected.deliveryFee,
    expectedTotal: expected.total,
    issues,
  };
}

export type PlaceOrderInput = {
  customer: CustomerProfile;
  lines: CartLine[];
  fulfilmentType: FulfilmentType;
  slot: string;
  address?: DeliveryAddress | undefined;
  phone: string;
  notes?: string | undefined;
  payment: PaymentChoice;
};

/**
 * Writes the order as `awaiting_confirmation`. Nothing is charged here: an
 * online payment is settled by the gateway and confirmed server-side, and a
 * pay-later order is settled at the counter or on delivery.
 */
export async function placeOnlineOrder(input: PlaceOrderInput): Promise<Order> {
  const problems = validateCheckout({ ...input, address: input.address ?? {} });
  if (problems.length) throw new Error(problems.map((problem) => problem.message).join(" "));
  if (!input.payment.available || !["unpaid", "pending"].includes(input.payment.status)) {
    throw new Error("Choose an available payment method.");
  }
  const items: OrderItem[] = input.lines.map((line) => {
    // Re-read the price from the catalog at the moment of placing.
    const catalogItem = findCatalogItem(line.sku);
    return {
      name: catalogItem!.name,
      quantity: line.quantity,
      price: catalogItem!.price,
      sku: line.sku,
    };
  });

  const quote = quoteOrder(
    items.map((item) => ({ price: item.price, quantity: item.quantity })),
    input.fulfilmentType,
  );

  const fulfilment: Fulfilment = {
    type: input.fulfilmentType,
    slot: input.slot,
    ...(input.fulfilmentType === "delivery" && input.address ? { address: input.address } : {}),
  };

  const order: Order = {
    id: generateOrderId(),
    customerName: input.customer.name,
    phone: input.phone.trim(),
    items,
    subtotal: quote.subtotal,
    deliveryFee: quote.deliveryFee,
    total: quote.total,
    status: "awaiting_confirmation",
    paymentMethod: input.payment.method,
    paymentStatus: input.payment.status,
    channel: "online",
    fulfilment,
    createdAt: new Date(),
    notes: input.notes?.trim() || undefined,
    customerId: input.customer.id,
    customerEmail: input.customer.email,
  };

  await createOnlineOrderInFirestore(order);

  return order;
}
