import {
  getDocument,
  getServiceAccount,
  patchDocument,
  readEnv,
  readFirestoreField,
  readFirestoreData,
  type ServerEnv,
} from "./firestore-admin";
import { validatedOnlineTotal } from "./order-pricing";

/**
 * YouPI-PG payment webhook.
 *
 * This endpoint is the only thing in the application allowed to mark an order
 * paid. The browser never can: a `handler()` callback from the checkout widget
 * is a hint, and the security rules refuse a customer-written `paymentStatus`.
 *
 * Every delivery is checked in this order, and any failure leaves the order
 * untouched for staff to settle at the counter:
 *   1. the HMAC-SHA256 signature over the raw bytes matches the shared secret,
 *   2. the optional delivery timestamp is recent (it is not signed, so this
 *      is a freshness hint, not replay protection),
 *   3. the order exists,
 *   4. the stored order is re-priced against the server's menu and fee policy,
 *   5. the amount paid matches and the order is not paid, refunded or cancelled,
 *   6. a version precondition prevents concurrent deliveries overwriting it.
 *
 * Docs: https://github.com/youpi-pg/YouPI-PG — "Webhook" section.
 */

export const YOUPI_WEBHOOK_PATH = "/api/payments/youpi-webhook";

/** How old a delivery may be before we refuse it. */
const MAX_SIGNATURE_AGE_MS = 5 * 60 * 1000;

export type YoupiWebhookPayload = {
  event?: string;
  orderId?: string;
  amount?: string;
  amountPaise?: number;
  utr?: string;
  paymentId?: string;
};

function hexToBytes(hex: string): Uint8Array | null {
  if (hex.length % 2 !== 0 || /[^0-9a-f]/i.test(hex)) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/** Constant-time comparison, so a wrong signature leaks nothing by timing. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

/**
 * Verifies the `X-Gateway-Signature` header (`sha256=<hex>`) against the raw
 * request body. Exported so it can be tested without a live gateway.
 */
export async function verifyYoupiSignature(
  rawBody: ArrayBuffer,
  signatureHeader: string | null,
  secret: string,
): Promise<boolean> {
  if (!signatureHeader || !secret) return false;

  const match = /^sha256=([0-9a-f]{64})$/i.exec(signatureHeader);
  const provided = match?.[1];
  if (!provided) return false;

  const providedBytes = hexToBytes(provided.trim());
  if (!providedBytes) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret) as unknown as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const expected = new Uint8Array(await crypto.subtle.sign("HMAC", key, rawBody));

  return timingSafeEqual(expected, providedBytes);
}

export function isTimestampFresh(
  header: string | null,
  now = Date.now(),
  maxAgeMs = MAX_SIGNATURE_AGE_MS,
): boolean {
  // The gateway may omit it; the signature is still the real protection.
  if (!header) return true;

  const numeric = Number(header);
  if (!Number.isFinite(numeric)) {
    const parsed = Date.parse(header);
    if (Number.isNaN(parsed)) return false;
    return Math.abs(now - parsed) <= maxAgeMs;
  }

  // Accept both seconds and milliseconds.
  const asMs = numeric > 1e12 ? numeric : numeric * 1000;
  return Math.abs(now - asMs) <= maxAgeMs;
}

/** Paise the gateway reports, from either field, or null when unusable. */
export function paidPaise(payload: YoupiWebhookPayload): number | null {
  if (
    typeof payload.amountPaise === "number" &&
    Number.isSafeInteger(payload.amountPaise) &&
    payload.amountPaise > 0
  ) {
    return payload.amountPaise;
  }
  if (typeof payload.amount === "string") {
    if (!/^\d+(?:\.\d{1,2})?$/.test(payload.amount)) return null;
    const fromRupees = Math.round(Number(payload.amount) * 100);
    if (Number.isSafeInteger(fromRupees) && fromRupees > 0) return fromRupees;
  }
  return null;
}

export type SettlementDecision =
  | { action: "mark_paid" }
  | { action: "already_paid" }
  | { action: "flag_mismatch"; expectedPaise: number; paidPaise: number }
  | { action: "ignore"; reason: string };

/**
 * Decides what a delivery means for an order. Pure, so the money rules are
 * testable: the gateway's amount is compared against the store's own total and
 * never simply believed.
 */
export function decideSettlement(input: {
  event: string | undefined;
  orderTotalRupees: number | null;
  currentPaymentStatus: string | null;
  paidPaise: number | null;
}): SettlementDecision {
  if (input.event !== "SUCCESS") {
    return { action: "ignore", reason: `event is ${input.event ?? "missing"}` };
  }
  if (input.currentPaymentStatus === "refunded") {
    return { action: "ignore", reason: "order was refunded" };
  }
  if (
    input.orderTotalRupees === null ||
    !Number.isFinite(input.orderTotalRupees) ||
    input.orderTotalRupees <= 0
  ) {
    return { action: "ignore", reason: "order has no valid total" };
  }
  if (input.paidPaise === null || !Number.isSafeInteger(input.paidPaise) || input.paidPaise <= 0) {
    return { action: "ignore", reason: "delivery carried no usable amount" };
  }
  if (input.currentPaymentStatus === "paid") {
    return { action: "already_paid" };
  }

  const expectedPaise = Math.round(input.orderTotalRupees * 100);
  if (!Number.isSafeInteger(expectedPaise))
    return { action: "ignore", reason: "order total is out of range" };
  if (input.paidPaise !== expectedPaise) {
    return { action: "flag_mismatch", expectedPaise, paidPaise: input.paidPaise };
  }

  return { action: "mark_paid" };
}

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function handleYoupiWebhook(request: Request, env?: ServerEnv): Promise<Response> {
  if (request.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const secret = readEnv(env, "YOUPI_WEBHOOK_SECRET");
  if (!secret) {
    console.error("YOUPI_WEBHOOK_SECRET is not set; refusing the payment webhook.");
    return json(503, { error: "Payment webhook is not configured" });
  }

  // Read the bytes before parsing: the signature covers the raw body.
  const rawBody = await request.arrayBuffer();

  const signatureOk = await verifyYoupiSignature(
    rawBody,
    request.headers.get("x-gateway-signature"),
    secret,
  );
  if (!signatureOk) {
    console.warn("Rejected a payment webhook with an invalid signature.");
    return json(401, { error: "Invalid signature" });
  }

  if (!isTimestampFresh(request.headers.get("x-gateway-timestamp"))) {
    console.warn("Rejected a stale payment webhook delivery.");
    return json(401, { error: "Stale delivery" });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(rawBody));
  } catch {
    return json(400, { error: "Body is not valid JSON" });
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return json(400, { error: "Body must be a JSON object" });
  }
  const payload = parsed as YoupiWebhookPayload;
  const orderId = typeof payload.orderId === "string" ? payload.orderId.trim() : "";
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(orderId))
    return json(400, { error: "Missing or invalid orderId" });
  if (
    (payload.utr != null && (typeof payload.utr !== "string" || payload.utr.length > 256)) ||
    (payload.paymentId != null &&
      (typeof payload.paymentId !== "string" || payload.paymentId.length > 256))
  ) {
    return json(400, { error: "Invalid payment reference" });
  }

  const account = getServiceAccount(env);
  if (!account) {
    // Signature was valid, so this is our misconfiguration, not a bad caller.
    console.error("No Firebase service account configured; cannot settle the payment.");
    return json(503, { error: "Payment settlement is not configured" });
  }

  const path = `orders/${encodeURIComponent(orderId)}`;

  try {
    const document = await getDocument(account, path);
    if (!document) {
      console.warn(`Payment webhook referenced unknown order ${orderId}.`);
      return json(404, { error: "Unknown order" });
    }

    const currentPaymentStatus = readFirestoreField(document, "paymentStatus");
    if (currentPaymentStatus === "paid")
      return json(200, { ok: true, note: "Order was already settled" });
    if (
      currentPaymentStatus === "refunded" ||
      readFirestoreField(document, "status") === "cancelled"
    ) {
      return json(200, { ok: true, note: "Order requires manual payment review" });
    }
    const total = validatedOnlineTotal(readFirestoreData(document));
    if (total === null) {
      console.error(
        `Refusing payment settlement for ${orderId}: stored pricing does not match the server catalog.`,
      );
      return json(200, { ok: true, note: "Order pricing requires staff review" });
    }
    if (!document.updateTime) throw new Error("Firestore returned no document version.");
    const decision = decideSettlement({
      event: payload.event,
      orderTotalRupees: typeof total === "number" ? total : null,
      currentPaymentStatus: typeof currentPaymentStatus === "string" ? currentPaymentStatus : null,
      paidPaise: paidPaise(payload),
    });

    switch (decision.action) {
      case "already_paid":
        return json(200, { ok: true, note: "Order was already settled" });

      case "ignore":
        console.warn(`Ignoring payment webhook for ${orderId}: ${decision.reason}`);
        return json(200, { ok: true, note: decision.reason });

      case "flag_mismatch":
        // Never mark an order paid for the wrong amount. Record it and let
        // staff settle it at the counter.
        await patchDocument(
          account,
          path,
          {
            paymentStatus: "pending",
            paymentAmountMismatch: true,
            paymentReportedPaise: decision.paidPaise,
            paymentExpectedPaise: decision.expectedPaise,
            paymentReference: payload.utr ?? null,
            paymentGatewayId: payload.paymentId ?? null,
            paymentUpdatedAt: new Date(),
          },
          document.updateTime,
        );
        console.error(
          `Payment amount mismatch on ${orderId}: paid ${decision.paidPaise} paise, expected ${decision.expectedPaise}.`,
        );
        return json(200, { ok: true, note: "Amount mismatch recorded for staff review" });

      case "mark_paid":
        await patchDocument(
          account,
          path,
          {
            paymentStatus: "paid",
            paymentMethod: "online",
            paymentReference: payload.utr ?? null,
            paymentGatewayId: payload.paymentId ?? null,
            paymentAmountMismatch: false,
            paymentUpdatedAt: new Date(),
          },
          document.updateTime,
        );
        return json(200, { ok: true });
    }
  } catch (err) {
    // A 5xx tells the gateway to retry, which is what we want for a transient
    // Firestore or token failure.
    console.error("Failed to settle a payment webhook:", err);
    return json(500, { error: "Could not settle the payment" });
  }
}
