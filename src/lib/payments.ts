import type { PaymentMethod, PaymentStatus } from "@/data/orders";
import { createTestGateway, isTestPaymentMode } from "./payments-test-mode";
import { createYoupiGateway, readYoupiConfig } from "./youpi";

/**
 * Payment seam.
 *
 * The store can always take money at the counter or on delivery — that path
 * needs no gateway and is live today. An online gateway plugs in here by
 * implementing `PaymentGateway` and returning it from `getConfiguredGateway()`.
 *
 * Two rules the gateway must respect, whatever provider it wraps:
 *   1. The amount charged is the amount the STORE calculated, never a number
 *      that came from the page.
 *   2. "Paid" is only ever set from a server-verified signature or webhook.
 *      A browser callback is a hint, not proof — which is why an online order
 *      lands as `pending` here and is settled by the store or the webhook.
 */

export type PaymentChoiceId = "pay_on_collection" | "pay_on_delivery" | "pay_online";

export type PaymentChoice = {
  id: PaymentChoiceId;
  label: string;
  description: string;
  /** What the order records when this choice is used. */
  method: PaymentMethod;
  status: PaymentStatus;
  available: boolean;
  unavailableReason?: string;
};

export type PaymentRequest = {
  orderId: string;
  /** Minor units (paise), so no floating-point rupees reach the provider. */
  amountInPaise: number;
  currency: "INR";
  customer: { name: string; email: string; phone: string };
  description: string;
};

export type PaymentOutcome = {
  status: Extract<PaymentStatus, "paid" | "pending" | "failed">;
  /** The provider's payment id, kept for reconciliation. */
  reference?: string;
  message?: string;
};

export interface PaymentGateway {
  id: string;
  label: string;
  start(request: PaymentRequest): Promise<PaymentOutcome>;
}

let cached: PaymentGateway | null | undefined;

/**
 * Returns the configured gateway, or null when the store has not connected one.
 *
 * YouPI-PG is wired up: set `VITE_YOUPI_BASE_URL` and `VITE_YOUPI_MERCHANT_KEY`
 * and the online option turns on by itself. Without them the option stays
 * visibly disabled rather than pretending a payment succeeded.
 *
 * To add a different provider, implement `PaymentGateway` and return it here.
 * Keep every secret key on the server — anything in a `VITE_` variable is
 * compiled into the page and is public.
 */
export function getConfiguredGateway(): PaymentGateway | null {
  if (cached !== undefined) return cached;

  // Test mode stands in for the gateway in development, so the flow can be
  // tried without a merchant account. It cannot be enabled in a production
  // build — see `payments-test-mode.ts`.
  if (isTestPaymentMode()) {
    cached = createTestGateway();
    return cached;
  }

  const youpi = readYoupiConfig();
  cached = youpi ? createYoupiGateway(youpi) : null;

  return cached;
}

export function isOnlinePaymentAvailable(): boolean {
  return getConfiguredGateway() !== null;
}

export function paymentChoicesFor(fulfilment: "pickup" | "delivery"): PaymentChoice[] {
  const gateway = getConfiguredGateway();

  const atStore: PaymentChoice = {
    id: fulfilment === "delivery" ? "pay_on_delivery" : "pay_on_collection",
    label: fulfilment === "delivery" ? "Pay on delivery" : "Pay when you collect",
    description:
      fulfilment === "delivery"
        ? "Cash, UPI or card when the order reaches you."
        : "Cash, UPI or card at the counter when you pick the order up.",
    method: "cash",
    status: "unpaid",
    available: true,
  };

  const online: PaymentChoice = {
    id: "pay_online",
    label: gateway ? `Pay now (${gateway.label})` : "Pay now online",
    description: gateway
      ? "UPI, cards and netbanking."
      : "Online payment is not connected for this store yet.",
    method: "online",
    status: "pending",
    available: gateway !== null,
    ...(gateway ? {} : { unavailableReason: "Not connected yet" }),
  };

  return [atStore, online];
}

export function toPaise(rupees: number): number {
  return Math.round(rupees * 100);
}
