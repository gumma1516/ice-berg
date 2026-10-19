import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, IceCreamCone, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";

import { DELIVERY, quoteOrder } from "@/lib/checkout";
import { MAX_QUANTITY_PER_ITEM, useCart } from "@/lib/cart";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [{ title: "Your Cart — Ice Age Creamery" }, { name: "robots", content: "noindex" }],
  }),
  component: CartPage,
});

function CartPage() {
  const { lines, ready, subtotal, itemCount, setQuantity, remove, clear } = useCart();

  const quote = quoteOrder(lines, "pickup");
  const awayFromFreeDelivery = DELIVERY.freeAbove - subtotal;

  if (!ready) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-24 text-center">
        <span className="mx-auto block h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-md px-5 py-20 text-center animate-rise">
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-berry-soft text-accent">
          <ShoppingBag className="h-8 w-8" />
        </div>
        <h1 className="font-display text-3xl font-semibold text-foreground">Your cart is empty</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Pick a few desserts and we'll have them ready for pickup or send them over.
        </p>
        <Link
          to="/menu"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-soft transition-transform hover:scale-105"
        >
          <IceCreamCone className="h-4 w-4" />
          Browse the menu
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-12 animate-rise">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-accent">Your order</p>
          <h1 className="mt-2 font-display text-4xl font-semibold">
            {itemCount} {itemCount === 1 ? "item" : "items"}
          </h1>
        </div>
        <button
          onClick={clear}
          className="text-xs font-semibold text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          Clear cart
        </button>
      </div>

      <ul className="mt-8 space-y-3">
        {lines.map((line) => (
          <li
            key={line.sku}
            className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-foreground">{line.name}</p>
              <p className="text-xs text-muted-foreground">
                {line.categoryTitle} · ₹{line.price} each
              </p>
            </div>

            <div className="flex items-center gap-1 rounded-full border border-border bg-background p-1">
              <button
                onClick={() => setQuantity(line.sku, line.quantity - 1)}
                aria-label={`Reduce ${line.name}`}
                className="grid h-7 w-7 place-items-center rounded-full transition-colors hover:bg-muted"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="w-6 text-center text-sm font-semibold" aria-live="polite">
                {line.quantity}
              </span>
              <button
                onClick={() => setQuantity(line.sku, line.quantity + 1)}
                disabled={line.quantity >= MAX_QUANTITY_PER_ITEM}
                aria-label={`Add another ${line.name}`}
                className="grid h-7 w-7 place-items-center rounded-full transition-colors hover:bg-muted disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            <p className="w-16 text-right font-display font-bold">₹{line.lineTotal}</p>

            <button
              onClick={() => remove(line.sku)}
              aria-label={`Remove ${line.name}`}
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-8 rounded-3xl border border-border bg-card p-6">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-semibold">₹{quote.subtotal}</span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Delivery is ₹{DELIVERY.fee} inside {DELIVERY.city}, free over ₹{DELIVERY.freeAbove}.
          Pickup is always free — you choose at checkout.
        </p>

        {awayFromFreeDelivery > 0 && (
          <p className="mt-3 rounded-xl bg-berry-soft/60 px-3 py-2 text-xs font-medium text-accent">
            Add ₹{awayFromFreeDelivery} more for free delivery.
          </p>
        )}

        <Link
          to="/checkout"
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 font-semibold text-primary-foreground shadow-soft transition-transform hover:scale-[1.02]"
        >
          Checkout
          <ArrowRight className="h-4 w-4" />
        </Link>

        <Link
          to="/menu"
          className="mt-3 block text-center text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          Add more items
        </Link>
      </div>
    </div>
  );
}
