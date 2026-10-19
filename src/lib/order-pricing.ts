import type { FulfilmentType } from "@/data/orders";
import type { CartLine } from "./cart";

export const DELIVERY = {
  /** Flat fee within the serviceable area. */
  fee: 39,
  /** Orders at or above this subtotal are delivered free. */
  freeAbove: 599,
  /** Minimum subtotal the kitchen will send out. */
  minimumSubtotal: 199,
  city: "Guntur",
  /** Edit these to match the store's delivery area. */
  serviceablePincodes: ["522001", "522002", "522004", "522005", "522006", "522007", "522034"],
} as const;

export type Quote = {
  subtotal: number;
  deliveryFee: number;
  total: number;
  /** Set when delivery is free because the subtotal cleared the threshold. */
  deliveryIsFree: boolean;
};

export function quoteOrder(
  lines: Pick<CartLine, "price" | "quantity">[],
  fulfilment: FulfilmentType,
): Quote {
  const subtotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);

  const deliveryIsFree = subtotal >= DELIVERY.freeAbove;
  const deliveryFee = fulfilment === "delivery" && !deliveryIsFree ? DELIVERY.fee : 0;

  return {
    subtotal,
    deliveryFee,
    total: subtotal + deliveryFee,
    deliveryIsFree: fulfilment === "delivery" && deliveryIsFree,
  };
}
