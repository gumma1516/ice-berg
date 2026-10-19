import { describe, expect, it } from "vitest";

import { generateOrderId } from "@/data/orders";
import { errorCode, errorMessage } from "@/lib/utils";

describe("generateOrderId", () => {
  it("encodes the order date so staff can read it off a ticket", () => {
    const id = generateOrderId(new Date(2026, 9, 19));

    expect(id).toMatch(/^IA-261019-[A-Z2-9]{12}$/);
  });

  it("does not collide when two tills create an order in the same moment", () => {
    const now = new Date();
    const ids = new Set(Array.from({ length: 2000 }, () => generateOrderId(now)));

    // Sequential ids derived from a loaded order count silently overwrote each
    // other; these must stay distinct.
    expect(ids.size).toBeGreaterThan(1990);
  });
});

describe("error helpers", () => {
  it("reads the message off an Error", () => {
    expect(errorMessage(new Error("Firestore unavailable"))).toBe("Firestore unavailable");
  });

  it("falls back when the thrown value carries nothing useful", () => {
    expect(errorMessage(undefined, "Could not save")).toBe("Could not save");
    expect(errorMessage({}, "Could not save")).toBe("Could not save");
  });

  it("reads a Firebase error code, and is empty when there is none", () => {
    expect(errorCode({ code: "auth/invalid-credential" })).toBe("auth/invalid-credential");
    expect(errorCode(new Error("boom"))).toBe("");
  });
});
