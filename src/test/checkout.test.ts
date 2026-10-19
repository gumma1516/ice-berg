import { describe, expect, it } from "vitest";

import { CATALOG, findCatalogItem } from "@/data/menu";
import type { Order } from "@/data/orders";
import {
  DELIVERY,
  isServiceablePincode,
  quoteOrder,
  validateCheckout,
  verifyOrderPricing,
} from "@/lib/checkout";
import type { CartLine } from "@/lib/cart";

function line(sku: string, quantity: number): CartLine {
  const item = findCatalogItem(sku)!;
  return {
    sku: item.sku,
    name: item.name,
    price: item.price,
    quantity,
    lineTotal: item.price * quantity,
    categoryTitle: item.categoryTitle,
    note: item.note,
  };
}

// A weekday item, so weekend availability never affects these cases.
const WAFFLE = "waffles:Nutella"; // ₹189
const SHAKE = "shakes:KitKat"; // ₹179

describe("quoteOrder", () => {
  it("charges nothing to deliver once the subtotal clears the threshold", () => {
    const lines = [line(WAFFLE, 4)]; // ₹756

    const quote = quoteOrder(lines, "delivery");

    expect(quote.subtotal).toBe(756);
    expect(quote.deliveryFee).toBe(0);
    expect(quote.deliveryIsFree).toBe(true);
    expect(quote.total).toBe(756);
  });

  it("adds the delivery fee below the threshold, and never for pickup", () => {
    const lines = [line(SHAKE, 1)]; // ₹179

    expect(quoteOrder(lines, "delivery").total).toBe(179 + DELIVERY.fee);
    expect(quoteOrder(lines, "pickup").total).toBe(179);
  });
});

describe("validateCheckout", () => {
  const base = {
    fulfilmentType: "delivery" as const,
    slot: "7:30 PM",
    phone: "9848012345",
    address: { line1: "2-14 Brundavan Gardens", area: "Krishna Nagar", pincode: "522006" },
    now: new Date(2026, 9, 19), // a Monday
  };

  it("accepts a complete delivery order", () => {
    expect(validateCheckout({ ...base, lines: [line(WAFFLE, 2)] })).toEqual([]);
  });

  it("refuses a pincode the store does not deliver to", () => {
    const problems = validateCheckout({
      ...base,
      lines: [line(WAFFLE, 2)],
      address: { ...base.address, pincode: "110001" },
    });

    expect(problems.map((p) => p.field)).toContain("pincode");
  });

  it("holds delivery orders to the minimum subtotal", () => {
    const problems = validateCheckout({ ...base, lines: [line("lava:Choco Lava Short", 1)] });

    expect(problems.some((p) => p.message.includes("Delivery orders start at"))).toBe(true);
  });

  it("blocks a weekend-only item on a weekday", () => {
    const weekendItem = CATALOG.find((item) => item.categoryId === "weekend")!;

    const problems = validateCheckout({
      ...base,
      fulfilmentType: "pickup",
      lines: [line(weekendItem.sku, 1)],
    });

    expect(problems.some((p) => p.message.includes("Saturdays and Sundays"))).toBe(true);
  });

  it("requires a usable phone number", () => {
    const problems = validateCheckout({ ...base, lines: [line(WAFFLE, 2)], phone: "123" });

    expect(problems.map((p) => p.field)).toContain("phone");
  });
});

describe("verifyOrderPricing", () => {
  const nutella = findCatalogItem(WAFFLE)!;

  function order(overrides: Partial<Order> = {}): Order {
    return {
      id: "IA-261019-ABCD",
      customerName: "Priya",
      phone: "9848012345",
      items: [{ name: nutella.name, sku: nutella.sku, quantity: 2, price: nutella.price }],
      subtotal: nutella.price * 2,
      deliveryFee: 0,
      total: nutella.price * 2,
      status: "awaiting_confirmation",
      paymentMethod: "cash",
      paymentStatus: "unpaid",
      channel: "online",
      fulfilment: { type: "pickup", slot: "7:30 PM" },
      createdAt: new Date(),
      ...overrides,
    };
  }

  it("passes an honest order", () => {
    const check = verifyOrderPricing(order());

    expect(check.matches).toBe(true);
    expect(check.expectedTotal).toBe(nutella.price * 2);
  });

  it("catches a tampered line price and reports the menu total", () => {
    const check = verifyOrderPricing(
      order({
        items: [{ name: nutella.name, sku: nutella.sku, quantity: 2, price: 1 }],
        subtotal: 2,
        total: 2,
      }),
    );

    expect(check.matches).toBe(false);
    expect(check.expectedTotal).toBe(nutella.price * 2);
    expect(check.issues.join(" ")).toContain("menu price");
  });

  it("catches a total that does not match its own lines", () => {
    const check = verifyOrderPricing(order({ total: 10 }));

    expect(check.matches).toBe(false);
    expect(check.issues.join(" ")).toContain("works out to");
  });

  it("flags an item that is no longer on the menu", () => {
    const check = verifyOrderPricing(
      order({
        items: [{ name: "Retired Sundae", sku: "sundaes:Retired", quantity: 1, price: 99 }],
      }),
    );

    expect(check.matches).toBe(false);
    expect(check.issues.join(" ")).toContain("not on the current menu");
  });
});

describe("isServiceablePincode", () => {
  it("accepts a store pincode and rejects one outside the area", () => {
    expect(isServiceablePincode("522006")).toBe(true);
    expect(isServiceablePincode("560001")).toBe(false);
  });
});
