import { describe, expect, it } from "vitest";

import {
  decideSettlement,
  isTimestampFresh,
  paidPaise,
  verifyYoupiSignature,
} from "@/lib/server/youpi-webhook";

const SECRET = "whsec_test_ice_age";

async function sign(body: string, secret = SECRET): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `sha256=${hex}`;
}

function bytes(body: string): ArrayBuffer {
  return new TextEncoder().encode(body).buffer as ArrayBuffer;
}

const BODY = JSON.stringify({
  event: "SUCCESS",
  orderId: "IA-261019-ABCD",
  amount: "499.00",
  amountPaise: 49900,
  utr: "123456789012",
  paymentId: "a1b2c3",
});

describe("verifyYoupiSignature", () => {
  it("accepts a signature produced with the shared secret", async () => {
    expect(await verifyYoupiSignature(bytes(BODY), await sign(BODY), SECRET)).toBe(true);
  });

  it("rejects a body that was altered after signing", async () => {
    const signature = await sign(BODY);
    const tampered = BODY.replace('"amountPaise":49900', '"amountPaise":1');

    expect(await verifyYoupiSignature(bytes(tampered), signature, SECRET)).toBe(false);
  });

  it("rejects a signature made with a different secret", async () => {
    expect(await verifyYoupiSignature(bytes(BODY), await sign(BODY, "wrong"), SECRET)).toBe(false);
  });

  it("rejects malformed, missing or wrongly-prefixed headers", async () => {
    expect(await verifyYoupiSignature(bytes(BODY), null, SECRET)).toBe(false);
    expect(await verifyYoupiSignature(bytes(BODY), "sha256=zzzz", SECRET)).toBe(false);
    expect(await verifyYoupiSignature(bytes(BODY), "md5=abcd", SECRET)).toBe(false);
  });

  it("rejects everything when no secret is configured", async () => {
    expect(await verifyYoupiSignature(bytes(BODY), await sign(BODY), "")).toBe(false);
  });
});

describe("isTimestampFresh", () => {
  const now = Date.UTC(2026, 9, 19, 12, 0, 0);

  it("accepts a recent delivery in seconds or milliseconds", () => {
    expect(isTimestampFresh(String(Math.floor(now / 1000)), now)).toBe(true);
    expect(isTimestampFresh(String(now), now)).toBe(true);
  });

  it("refuses a replayed delivery from an hour ago", () => {
    expect(isTimestampFresh(String(now - 60 * 60 * 1000), now)).toBe(false);
  });

  it("does not block a delivery that carries no timestamp", () => {
    expect(isTimestampFresh(null, now)).toBe(true);
  });
});

describe("paidPaise", () => {
  it("prefers the integer paise field", () => {
    expect(paidPaise({ amountPaise: 49900, amount: "1.00" })).toBe(49900);
  });

  it("falls back to the rupee string", () => {
    expect(paidPaise({ amount: "499.00" })).toBe(49900);
  });

  it("returns null when there is nothing usable", () => {
    expect(paidPaise({})).toBeNull();
    expect(paidPaise({ amount: "not a number" })).toBeNull();
  });
});

describe("decideSettlement", () => {
  const base = {
    event: "SUCCESS",
    orderTotalRupees: 499,
    currentPaymentStatus: "pending",
    paidPaise: 49900,
  };

  it("marks an order paid when the amount matches the store's total", () => {
    expect(decideSettlement(base)).toEqual({ action: "mark_paid" });
  });

  it("refuses to settle an underpayment and reports both amounts", () => {
    expect(decideSettlement({ ...base, paidPaise: 100 })).toEqual({
      action: "flag_mismatch",
      expectedPaise: 49900,
      paidPaise: 100,
    });
  });

  it("refuses an overpayment too", () => {
    expect(decideSettlement({ ...base, paidPaise: 99900 }).action).toBe("flag_mismatch");
  });

  it("is idempotent — a repeated delivery changes nothing", () => {
    expect(decideSettlement({ ...base, currentPaymentStatus: "paid" })).toEqual({
      action: "already_paid",
    });
  });

  it("ignores non-success events and unusable data", () => {
    expect(decideSettlement({ ...base, event: "FAILED" }).action).toBe("ignore");
    expect(decideSettlement({ ...base, event: undefined }).action).toBe("ignore");
    expect(decideSettlement({ ...base, paidPaise: null }).action).toBe("ignore");
    expect(decideSettlement({ ...base, orderTotalRupees: null }).action).toBe("ignore");
  });
});
