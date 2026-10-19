import { findCatalogItem } from "@/data/menu";
import { quoteOrder } from "@/lib/order-pricing";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** A Firestore customer write is untrusted, even after it passes security rules. */
export function validatedOnlineTotal(order: Record<string, unknown>): number | null {
  if (order["channel"] !== "online" || order["paymentMethod"] !== "online") return null;
  const items = order["items"];
  if (!Array.isArray(items) || items.length === 0 || items.length > 50) return null;
  const fulfilment = order["fulfilment"];
  if (!isRecord(fulfilment)) return null;
  const type = fulfilment["type"];
  if (type !== "pickup" && type !== "delivery") return null;

  const lines: { price: number; quantity: number }[] = [];
  for (const item of items) {
    if (!isRecord(item) || typeof item["sku"] !== "string") return null;
    const catalog = findCatalogItem(item["sku"]);
    if (!catalog || item["price"] !== catalog.price || item["name"] !== catalog.name) return null;
    const quantity = item["quantity"];
    if (
      typeof quantity !== "number" ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 20
    ) {
      return null;
    }
    lines.push({ price: catalog.price, quantity });
  }

  const quote = quoteOrder(lines, type);
  if (
    order["subtotal"] !== quote.subtotal ||
    order["deliveryFee"] !== quote.deliveryFee ||
    order["total"] !== quote.total
  ) {
    return null;
  }
  return quote.total > 0 && Number.isSafeInteger(quote.total * 100) ? quote.total : null;
}
