import { useCallback, useEffect, useState } from "react";

import { findCatalogItem, type CatalogItem } from "@/data/menu";

/**
 * The cart.
 *
 * Only skus and quantities are stored. Every price shown, and the total that
 * reaches the store, is resolved from the menu catalog at read time — so a
 * stale cart cannot carry an old price, and an edited cart cannot invent one.
 * Lives in localStorage: a cart is a per-device convenience, not store data.
 */

const STORAGE_KEY = "ice_age_cart_v1";
const CART_EVENT = "ice_age_cart_change";

/** What we persist. */
type StoredLine = { sku: string; quantity: number };

/** What the UI renders. */
export type CartLine = {
  sku: string;
  name: string;
  price: number;
  quantity: number;
  lineTotal: number;
  categoryTitle: string;
  note?: string | undefined;
};

export const MAX_QUANTITY_PER_ITEM = 20;

// Keep the cart usable for this tab when browser storage is blocked or full.
let fallback: StoredLine[] | null = null;

function normalizeLines(value: unknown): StoredLine[] {
  if (!Array.isArray(value)) return [];
  const quantities = new Map<string, number>();
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const { sku, quantity } = entry as { sku?: unknown; quantity?: unknown };
    if (
      typeof sku !== "string" ||
      !findCatalogItem(sku) ||
      typeof quantity !== "number" ||
      !Number.isFinite(quantity)
    )
      continue;
    const count = Math.max(0, Math.trunc(quantity));
    if (count)
      quantities.set(sku, Math.min((quantities.get(sku) ?? 0) + count, MAX_QUANTITY_PER_ITEM));
  }
  return Array.from(quantities, ([sku, quantity]) => ({ sku, quantity }));
}

function readStored(): StoredLine[] {
  if (typeof window === "undefined") return [];
  if (fallback) return fallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeLines(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

function writeStored(lines: StoredLine[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    fallback = null;
  } catch {
    fallback = lines;
  }
  window.dispatchEvent(new CustomEvent(CART_EVENT));
}

function toLines(stored: StoredLine[]): CartLine[] {
  return stored.flatMap((entry) => {
    const item = findCatalogItem(entry.sku);
    if (!item) return [];
    return [
      {
        sku: item.sku,
        name: item.name,
        price: item.price,
        quantity: entry.quantity,
        lineTotal: item.price * entry.quantity,
        categoryTitle: item.categoryTitle,
        note: item.note,
      },
    ];
  });
}

export function cartSubtotal(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.lineTotal, 0);
}

export function cartItemCount(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

export function useCart() {
  // Start empty so the server-rendered markup matches the first client render,
  // then hydrate from storage.
  const [stored, setStored] = useState<StoredLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setStored(readStored());
    setReady(true);

    const sync = () => setStored(readStored());
    window.addEventListener(CART_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CART_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const commit = useCallback((next: StoredLine[]) => {
    const normalized = normalizeLines(next);
    setStored(normalized);
    writeStored(normalized);
  }, []);

  const add = useCallback(
    (item: Pick<CatalogItem, "sku">, quantity = 1) => {
      if (!Number.isFinite(quantity) || quantity < 1 || !findCatalogItem(item.sku)) return;
      quantity = Math.trunc(quantity);
      const current = readStored();
      const existing = current.find((line) => line.sku === item.sku);
      const next = existing
        ? current.map((line) =>
            line.sku === item.sku
              ? {
                  ...line,
                  quantity: Math.min(line.quantity + quantity, MAX_QUANTITY_PER_ITEM),
                }
              : line,
          )
        : [...current, { sku: item.sku, quantity: Math.min(quantity, MAX_QUANTITY_PER_ITEM) }];
      commit(next);
    },
    [commit],
  );

  const setQuantity = useCallback(
    (sku: string, quantity: number) => {
      if (!Number.isFinite(quantity)) return;
      const clamped = Math.min(Math.max(Math.trunc(quantity), 0), MAX_QUANTITY_PER_ITEM);
      const current = readStored();
      commit(
        clamped <= 0
          ? current.filter((line) => line.sku !== sku)
          : current.map((line) => (line.sku === sku ? { ...line, quantity: clamped } : line)),
      );
    },
    [commit],
  );

  const remove = useCallback((sku: string) => setQuantity(sku, 0), [setQuantity]);

  const clear = useCallback(() => commit([]), [commit]);

  const lines = toLines(stored);

  return {
    lines,
    /** False until the cart has been read from storage on the client. */
    ready,
    itemCount: cartItemCount(lines),
    subtotal: cartSubtotal(lines),
    add,
    setQuantity,
    remove,
    clear,
  };
}
