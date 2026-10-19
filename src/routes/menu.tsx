import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Plus, ShoppingBag } from "lucide-react";
import { toast } from "sonner";

import { ALL_CATEGORIES, isAvailableToday } from "@/data/menu";
import { useCart } from "@/lib/cart";

export const Route = createFileRoute("/menu")({
  head: () => ({
    meta: [
      { title: "Menu — Ice Age Creamery, Guntur" },
      {
        name: "description",
        content:
          "Full menu: weekend desserts, Belgian waffles, waffle sundaes, shakes, sundaes, stone desserts, lava shorts, mocktails and happiness jars.",
      },
      { property: "og:title", content: "Ice Age Creamery Menu" },
      { property: "og:description", content: "Browse every dessert with prices in rupees." },
    ],
  }),
  component: MenuPage,
});

const all = ALL_CATEGORIES;

function MenuPage() {
  const [active, setActive] = useState<string>("all");
  const { add, itemCount, ready } = useCart();
  const [justAdded, setJustAdded] = useState<string | null>(null);

  const addToCart = (sku: string, name: string) => {
    add({ sku });
    setJustAdded(sku);
    window.setTimeout(() => setJustAdded((current) => (current === sku ? null : current)), 1200);
    toast.success(`${name} added to your cart`);
  };

  const shown = active === "all" ? all : all.filter((c) => c.id === active);
  return (
    <div className="mx-auto max-w-6xl px-5 pt-12">
      <p className="text-sm font-semibold uppercase tracking-[0.3em] text-accent">The Menu</p>
      <h1 className="mt-2 text-5xl font-semibold sm:text-6xl">Made to explore.</h1>

      <div className="sticky top-[7.5rem] z-30 -mx-5 mt-8 overflow-x-auto bg-background/90 px-5 py-3 backdrop-blur md:top-[4.25rem]">
        <div className="flex w-max gap-2">
          {[{ id: "all", title: "All" }, ...all].map((c) => (
            <button
              key={c.id}
              onClick={() => setActive(c.id)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${active === c.id ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-berry-soft"}`}
            >
              {c.title}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 space-y-14">
        {shown.map((cat) => (
          <section key={cat.id} className="animate-rise">
            <div className="flex items-baseline gap-3">
              <h2 className="text-3xl font-semibold">{cat.title}</h2>
              {cat.id === "weekend" && (
                <span className="rounded-full bg-berry-soft px-3 py-1 text-xs font-semibold text-accent">
                  Sat & Sun
                </span>
              )}
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {cat.items.map((it) => {
                const sku = `${cat.id}:${it.name}`;
                const orderable = isAvailableToday({
                  ...it,
                  sku,
                  categoryId: cat.id,
                  categoryTitle: cat.title,
                });

                return (
                  <div
                    key={it.name}
                    className="flex items-start justify-between gap-4 rounded-2xl border border-border bg-card p-5 transition-all hover:-translate-y-1 hover:shadow-soft"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold">{it.name}</p>
                      {it.note && <p className="mt-1 text-sm text-muted-foreground">{it.note}</p>}
                      {!orderable && (
                        <p className="mt-1 text-xs font-medium text-accent">
                          Saturdays & Sundays only
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <span className="font-display text-lg text-accent">₹{it.price}</span>
                      <button
                        type="button"
                        onClick={() => addToCart(sku, it.name)}
                        disabled={!orderable}
                        aria-label={`Add ${it.name} to cart`}
                        className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {justAdded === sku ? (
                          <>
                            <Check className="h-3.5 w-3.5" /> Added
                          </>
                        ) : (
                          <>
                            <Plus className="h-3.5 w-3.5" /> Add
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      <p className="mt-12 text-sm text-muted-foreground">
        Prices in ₹, inclusive of taxes. Availability may vary.
      </p>

      {ready && itemCount > 0 && (
        <div className="sticky bottom-4 z-30 mt-8 flex justify-center">
          <Link
            to="/cart"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg transition-transform hover:scale-105"
          >
            <ShoppingBag className="h-4 w-4" />
            View cart · {itemCount} {itemCount === 1 ? "item" : "items"}
          </Link>
        </div>
      )}
    </div>
  );
}
