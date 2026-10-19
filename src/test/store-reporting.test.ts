import { describe, expect, it } from "vitest";
import { getDailyStats, getHourlyStats, type Order } from "@/data/orders";
import { CATALOG, isAvailableToday } from "@/data/menu";

const order = (createdAt: string, status: Order["status"] = "completed"): Order => ({
  id: "test",
  customerName: "Test",
  phone: "9999999999",
  items: [],
  total: 199,
  paymentMethod: "cash",
  status,
  createdAt: new Date(createdAt),
});

describe("store reporting", () => {
  it("groups midnight orders by India date and counts completed sales only", () => {
    const now = new Date("2026-10-18T19:00:00Z");
    const result = getDailyStats(
      [
        order("2026-10-18T18:29:00Z"),
        order("2026-10-18T18:31:00Z"),
        order("2026-10-18T18:40:00Z", "awaiting_confirmation"),
      ],
      2,
      now,
    );
    expect(result.map(({ date, revenue, orders }) => ({ date, revenue, orders }))).toEqual([
      { date: "2026-10-18", revenue: 199, orders: 1 },
      { date: "2026-10-19", revenue: 199, orders: 1 },
    ]);
  });

  it("places hourly activity in the store timezone", () => {
    expect(
      getHourlyStats([order("2026-10-19T06:00:00Z")]).find((row) => row.hour === 11)?.orders,
    ).toBe(1);
  });

  it("ends weekend availability at midnight in India", () => {
    const item = CATALOG.find((item) => item.categoryId === "weekend")!;
    expect(isAvailableToday(item, new Date("2026-10-18T18:29:00Z"))).toBe(true);
    expect(isAvailableToday(item, new Date("2026-10-18T18:30:00Z"))).toBe(false);
  });
});
