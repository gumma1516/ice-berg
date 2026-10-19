import { readEnv, type ServerEnv } from "./firestore-admin";
import { handleYoupiWebhook } from "./youpi-webhook";

/**
 * Test-mode payment endpoint.
 *
 * Signs a webhook payload with the store's real webhook secret and feeds it to
 * the real settlement handler, so a test run exercises signature verification,
 * the amount check, and idempotency exactly as a live gateway would.
 *
 * Independent guards keep it local to development:
 *   1. `ALLOW_TEST_PAYMENTS` must be exactly "true",
 *   2. the bundle must not be a production build,
 *   3. `NODE_ENV` must be explicitly "development" or "test",
 *   4. the request must target localhost and carry a matching Origin.
 *
 * This marks database orders paid without moving money. Use only an isolated
 * development Firebase project, never production service-account credentials.
 */

export const SIMULATE_PAYMENT_PATH = "/api/dev/simulate-payment";

type SimulateBody = {
  orderId?: string;
  amountPaise?: number;
  event?: "SUCCESS" | "FAILED";
};

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function isEnabled(env: ServerEnv | undefined): boolean {
  if (import.meta.env.PROD) return false;
  if (readEnv(env, "ALLOW_TEST_PAYMENTS") !== "true") return false;
  return ["development", "test"].includes(readEnv(env, "NODE_ENV") ?? "");
}

/** Only this site's own pages may drive the simulator. */
function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const url = new URL(request.url);
    return (
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
      new URL(origin).origin === url.origin
    );
  } catch {
    return false;
  }
}

async function hmacHex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret) as unknown as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(body) as unknown as ArrayBuffer,
  );
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function handleSimulatePayment(request: Request, env?: ServerEnv): Promise<Response> {
  if (request.method !== "POST") return json(405, { error: "Method not allowed" });

  if (!isEnabled(env)) {
    return json(404, { error: "Not found" });
  }

  if (!isSameOrigin(request)) {
    return json(403, { error: "Cross-origin requests are not allowed here" });
  }

  const secret = readEnv(env, "YOUPI_WEBHOOK_SECRET");
  if (!secret) {
    return json(503, {
      error: "Set YOUPI_WEBHOOK_SECRET (any value in test mode) to simulate a payment.",
    });
  }

  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return json(400, { error: "Body is not valid JSON" });
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return json(400, { error: "Body must be a JSON object" });
  }
  const body = parsed as SimulateBody;
  const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(orderId))
    return json(400, { error: "Missing or invalid orderId" });

  const amountPaise = body.amountPaise;
  if (typeof amountPaise !== "number" || !Number.isSafeInteger(amountPaise) || amountPaise <= 0) {
    return json(400, { error: "Missing or invalid amountPaise" });
  }
  if (body.event !== undefined && body.event !== "SUCCESS" && body.event !== "FAILED") {
    return json(400, { error: "Invalid event" });
  }

  // Build the payload a live gateway would send.
  const payload = JSON.stringify({
    event: body.event ?? "SUCCESS",
    orderId,
    amount: (amountPaise / 100).toFixed(2),
    amountPaise: Math.round(amountPaise),
    utr: `TEST${Date.now().toString().slice(-8)}`,
    paymentId: `test-${crypto.randomUUID()}`,
  });

  const signature = `sha256=${await hmacHex(secret, payload)}`;

  const webhookRequest = new Request(new URL("/api/payments/youpi-webhook", request.url), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-gateway-signature": signature,
      "x-gateway-event": body.event ?? "SUCCESS",
      "x-gateway-delivery-id": crypto.randomUUID(),
      "x-gateway-timestamp": String(Date.now()),
    },
    body: payload,
  });

  const result = await handleYoupiWebhook(webhookRequest, env);
  const outcome = (await result.json().catch(() => ({}))) as { note?: string; error?: string };

  if (!result.ok) {
    return json(result.status, {
      error: outcome.error ?? "The webhook refused the test delivery.",
      hint:
        result.status === 503
          ? "Add FIREBASE_SERVICE_ACCOUNT_JSON so the webhook can write to Firestore."
          : undefined,
    });
  }

  return json(200, {
    ok: true,
    settled: outcome.note ? "not_settled" : "paid",
    note: outcome.note,
  });
}
