import type { PaymentGateway, PaymentOutcome, PaymentRequest } from "./payments";

/**
 * YouPI-PG checkout (https://github.com/youpi-pg/YouPI-PG).
 *
 * A self-hosted UPI gateway: `youpi.js` opens a modal with a UPI QR code and
 * app deep links, and the customer pays the store's UPI account directly.
 *
 * What this file does NOT do is decide that a payment happened. The widget's
 * `handler` callback runs in the customer's browser, so it is treated as
 * "payment started" only. The order is settled by the signed webhook at
 * `/api/payments/youpi-webhook`, which checks the amount against the store's
 * own total before anything is marked paid.
 */

type YoupiPayOptions = {
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  handler: (response: YoupiHandlerResponse) => void;
  onClose: () => void;
};

type YoupiHandlerResponse = {
  status?: string;
  order_id?: string;
  amount_received?: number | string;
  utr?: string;
};

declare global {
  interface Window {
    Youpi?: { pay: (options: YoupiPayOptions) => void };
  }
}

const SCRIPT_ID = "youpi-pg-checkout";
const SCRIPT_TIMEOUT_MS = 15000;

export type YoupiConfig = {
  /** Base URL of the self-hosted gateway, e.g. https://pay.iceagecreamery.in */
  baseUrl: string;
  merchantKey: string;
  storeName: string;
};

export function readYoupiConfig(): YoupiConfig | null {
  const baseUrl = import.meta.env["VITE_YOUPI_BASE_URL"];
  const merchantKey = import.meta.env["VITE_YOUPI_MERCHANT_KEY"];

  if (!baseUrl || !merchantKey) return null;

  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    merchantKey,
    storeName: import.meta.env["VITE_STORE_NAME"] || "Ice Age Creamery",
  };
}

let loader: Promise<void> | null = null;

/** Loads `youpi.js` once, with the merchant key the gateway expects. */
function loadYoupiScript(config: YoupiConfig): Promise<void> {
  if (typeof document === "undefined") {
    return Promise.reject(new Error("The payment widget can only load in a browser."));
  }

  if (window.Youpi) return Promise.resolve();
  if (loader) return loader;

  loader = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("load failed")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = `${config.baseUrl}/youpi.js`;
    script.async = true;
    script.dataset["youpiKey"] = config.merchantKey;
    script.dataset["currency"] = "INR";

    const timer = window.setTimeout(() => {
      reject(new Error("The payment window took too long to load."));
    }, SCRIPT_TIMEOUT_MS);

    script.addEventListener(
      "load",
      () => {
        window.clearTimeout(timer);
        resolve();
      },
      { once: true },
    );

    script.addEventListener(
      "error",
      () => {
        window.clearTimeout(timer);
        script.remove();
        reject(new Error("Could not reach the payment gateway."));
      },
      { once: true },
    );

    document.head.appendChild(script);
  }).catch((err: unknown) => {
    // Allow a later attempt to retry the load.
    loader = null;
    throw err;
  });

  return loader;
}

export function createYoupiGateway(config: YoupiConfig): PaymentGateway {
  return {
    id: "youpi",
    label: "UPI",

    async start(request: PaymentRequest): Promise<PaymentOutcome> {
      await loadYoupiScript(config);

      const youpi = window.Youpi;
      if (!youpi) throw new Error("The payment window did not open. Please try again.");

      return new Promise<PaymentOutcome>((resolve) => {
        let settled = false;

        const finish = (outcome: PaymentOutcome) => {
          if (settled) return;
          settled = true;
          resolve(outcome);
        };

        youpi.pay({
          order_id: request.orderId,
          // The widget takes rupees; our own amount of record stays in paise.
          amount: request.amountInPaise / 100,
          currency: request.currency,
          name: config.storeName,
          description: request.description,

          handler: (response) => {
            const reported = (response.status ?? "").toUpperCase();

            if (reported !== "SUCCESS") {
              finish({
                status: "failed",
                message: "The payment did not go through. You can pay at the counter instead.",
              });
              return;
            }

            // Deliberately "pending", not "paid": the webhook confirms the
            // amount server-side before the order is settled.
            finish({
              status: "pending",
              ...(response.utr ? { reference: response.utr } : {}),
              message: "Payment received — the store is confirming it now.",
            });
          },

          onClose: () => {
            finish({
              status: "failed",
              message: "Payment window closed before the payment finished.",
            });
          },
        });
      });
    },
  };
}
