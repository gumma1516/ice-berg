import type { PaymentGateway, PaymentOutcome, PaymentRequest } from "./payments";

/**
 * Test-mode payment gateway.
 *
 * Stands in for YouPI-PG so the whole flow can be exercised without a merchant
 * account, a hosted gateway, or any real money: place an order, "pay", watch
 * the signed webhook settle it, and see it turn Paid in the staff portal.
 *
 * It is a harness, not a shortcut. The settlement half is the real thing — the
 * dev endpoint signs a genuine webhook payload and feeds it to the same
 * verification, amount-matching and idempotency code that a live gateway hits.
 * Only the "customer tapped pay" half is simulated.
 *
 * Turned on by `VITE_PAYMENT_MODE=test` and refused in production builds.
 */

export const TEST_PAYMENT_ENDPOINT = "/api/dev/simulate-payment";

export function isTestPaymentMode(): boolean {
  if (import.meta.env.PROD) return false;
  return import.meta.env["VITE_PAYMENT_MODE"] === "test";
}

type Choice = "success" | "underpay" | "fail" | "close";

/** A plain-DOM dialog, so the harness stays independent of the page's React tree. */
function askWhatToSimulate(request: PaymentRequest): Promise<Choice> {
  return new Promise((resolve) => {
    const rupees = (request.amountInPaise / 100).toFixed(2);

    const overlay = document.createElement("div");
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Test payment");
    overlay.style.cssText = [
      "position:fixed",
      "inset:0",
      "z-index:9999",
      "display:grid",
      "place-items:center",
      "background:rgba(0,0,0,.55)",
      "font-family:system-ui,-apple-system,sans-serif",
    ].join(";");

    overlay.innerHTML = `
      <div style="width:min(360px,92vw);background:#fff;border-radius:24px;padding:24px;box-shadow:0 20px 60px rgba(0,0,0,.3)">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
          <span style="background:#fde68a;color:#92400e;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:3px 8px;border-radius:999px">Test mode</span>
        </div>
        <p style="margin:12px 0 2px;font-size:13px;color:#6b7280">Paying</p>
        <p style="margin:0;font-size:30px;font-weight:700;color:#111">₹${rupees}</p>
        <p style="margin:6px 0 0;font-size:12px;color:#6b7280">Order ${request.orderId}</p>
        <p style="margin:14px 0 18px;font-size:12px;line-height:1.5;color:#6b7280">
          No money moves. Choosing an outcome sends a real signed webhook to this
          site, exactly as the live gateway would.
        </p>
        <button data-choice="success" style="width:100%;padding:12px;border:0;border-radius:12px;background:#111;color:#fff;font-size:14px;font-weight:600;cursor:pointer">Simulate a successful payment</button>
        <button data-choice="underpay" style="width:100%;margin-top:8px;padding:10px;border:1px solid #e5e7eb;border-radius:12px;background:#fff;font-size:13px;cursor:pointer">Simulate the wrong amount</button>
        <button data-choice="fail" style="width:100%;margin-top:8px;padding:10px;border:1px solid #e5e7eb;border-radius:12px;background:#fff;font-size:13px;cursor:pointer">Simulate a failed payment</button>
        <button data-choice="close" style="width:100%;margin-top:8px;padding:10px;border:0;background:none;color:#6b7280;font-size:13px;cursor:pointer">Close without paying</button>
      </div>
    `;

    const finish = (choice: Choice) => {
      overlay.remove();
      document.removeEventListener("keydown", onKey);
      resolve(choice);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish("close");
    };

    overlay.addEventListener("click", (e) => {
      const choice = (e.target as HTMLElement)
        .closest("[data-choice]")
        ?.getAttribute("data-choice");
      if (choice) finish(choice as Choice);
      else if (e.target === overlay) finish("close");
    });

    document.addEventListener("keydown", onKey);
    document.body.appendChild(overlay);
  });
}

type SimulateResponse = { ok?: boolean; settled?: string; error?: string; note?: string };

/** Asks the dev endpoint to sign and deliver a webhook for this order. */
async function deliverTestWebhook(
  request: PaymentRequest,
  amountPaise: number,
  event: "SUCCESS" | "FAILED",
): Promise<SimulateResponse> {
  const response = await fetch(TEST_PAYMENT_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ orderId: request.orderId, amountPaise, event }),
  });

  const body = (await response.json().catch(() => ({}))) as SimulateResponse;

  if (!response.ok) {
    throw new Error(
      body.error ?? `The test webhook was refused (${response.status}). Check the server log.`,
    );
  }

  return body;
}

export function createTestGateway(): PaymentGateway {
  return {
    id: "test",
    label: "test mode",

    async start(request: PaymentRequest): Promise<PaymentOutcome> {
      const choice = await askWhatToSimulate(request);

      if (choice === "close") {
        return { status: "failed", message: "Payment window closed before paying." };
      }

      if (choice === "fail") {
        return {
          status: "failed",
          message: "Test payment declined. Your order stands — pay on collection.",
        };
      }

      // Deliberately wrong by ₹1, to prove the amount check refuses to settle.
      const amountPaise =
        choice === "underpay" ? Math.max(request.amountInPaise - 100, 1) : request.amountInPaise;

      try {
        const result = await deliverTestWebhook(request, amountPaise, "SUCCESS");

        if (result.settled === "paid") {
          return {
            status: "pending",
            reference: "TEST-UTR",
            message: "Test payment settled. The order shows as paid in the staff portal.",
          };
        }

        return {
          status: "pending",
          reference: "TEST-UTR",
          message:
            result.note ??
            "The webhook was delivered but the order was not settled — check the staff portal.",
        };
      } catch (err) {
        return {
          status: "failed",
          message: (err as Error).message,
        };
      }
    },
  };
}
