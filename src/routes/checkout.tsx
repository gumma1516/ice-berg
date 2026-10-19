import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Bike,
  CheckCircle2,
  Clock,
  CreditCard,
  Lock,
  ShoppingBag,
  Store,
} from "lucide-react";
import { toast } from "sonner";

import { ADDRESS } from "@/data/menu";
import type { DeliveryAddress, FulfilmentType, Order } from "@/data/orders";
import { useCart } from "@/lib/cart";
import {
  ASAP_SLOT,
  DELIVERY,
  placeOnlineOrder,
  quoteOrder,
  timeSlotsForToday,
  validateCheckout,
} from "@/lib/checkout";
import { useCustomerAuth } from "@/lib/customer-auth";
import {
  getConfiguredGateway,
  paymentChoicesFor,
  toPaise,
  type PaymentChoice,
} from "@/lib/payments";
import { errorMessage } from "@/lib/utils";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [{ title: "Checkout — Ice Age Creamery" }, { name: "robots", content: "noindex" }],
  }),
  component: CheckoutPage,
});

const inputCls =
  "mt-1 w-full rounded-xl border border-border bg-card p-3 text-sm outline-none focus:border-accent";

function CheckoutPage() {
  const { customer, authReady } = useCustomerAuth();
  const { lines, ready: cartReady, clear } = useCart();

  const [fulfilmentType, setFulfilmentType] = useState<FulfilmentType>("pickup");
  const [slot, setSlot] = useState(ASAP_SLOT);
  const [phone, setPhone] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [address, setAddress] = useState<Partial<DeliveryAddress>>({ city: DELIVERY.city });
  const [paymentId, setPaymentId] = useState<PaymentChoice["id"] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [placed, setPlaced] = useState<Order | null>(null);
  const [paymentNote, setPaymentNote] = useState<string | null>(null);

  const [slots, setSlots] = useState<string[]>([]);
  const submittingRef = useRef(false);
  useEffect(() => {
    const refresh = () => {
      const available = timeSlotsForToday();
      setSlots(available);
      setSlot((selected) => (available.includes(selected) ? selected : (available[0] ?? "")));
    };
    refresh();
    const timer = window.setInterval(refresh, 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const paymentChoices = useMemo(() => paymentChoicesFor(fulfilmentType), [fulfilmentType]);
  const payment =
    paymentChoices.find((choice) => choice.id === paymentId) ??
    paymentChoices.find((choice) => choice.available)!;

  const quote = quoteOrder(lines, fulfilmentType);
  const effectivePhone = phone ?? customer?.phone ?? "";

  // ── Order placed ────────────────────────────────────────────────
  if (placed) {
    const isDelivery = placed.fulfilment?.type === "delivery";
    return (
      <div className="mx-auto max-w-md px-5 py-16 text-center animate-rise">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-emerald-700">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h1 className="mt-5 font-display text-3xl font-semibold">Order placed</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The store will confirm it shortly and call you on {placed.phone} if anything needs
          checking.
        </p>

        {paymentNote && (
          <p className="mx-auto mt-4 max-w-sm rounded-2xl bg-berry-soft/60 px-4 py-3 text-xs font-medium text-accent">
            {paymentNote}
          </p>
        )}

        <div className="mt-6 rounded-3xl border border-border bg-card p-5 text-left text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Order number</span>
            <span className="font-display font-bold">{placed.id}</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-muted-foreground">{isDelivery ? "Delivery" : "Pickup"}</span>
            <span className="font-semibold">{placed.fulfilment?.slot}</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-muted-foreground">Total</span>
            <span className="font-display font-bold">₹{placed.total}</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-muted-foreground">Payment</span>
            <span className="font-semibold">
              {placed.paymentStatus === "paid"
                ? "Paid"
                : placed.paymentStatus === "pending"
                  ? "Confirming payment"
                  : "Pay on collection/delivery"}
            </span>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            to="/account"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-soft"
          >
            Track in my account
          </Link>
          <Link
            to="/menu"
            className="inline-flex items-center justify-center rounded-full border border-border px-6 py-3 font-semibold hover:bg-muted"
          >
            Order something else
          </Link>
        </div>
      </div>
    );
  }

  if (!authReady || !cartReady) {
    return (
      <div className="mx-auto max-w-md px-5 py-24 text-center">
        <span className="mx-auto block h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  // ── Sign-in required ────────────────────────────────────────────
  if (!customer) {
    return (
      <div className="mx-auto max-w-md px-5 py-20 text-center animate-rise">
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-berry-soft text-accent">
          <Lock className="h-7 w-7" />
        </div>
        <h1 className="font-display text-3xl font-semibold">Sign in to order</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your order is tied to your account so you can track it and collect loyalty points. Your
          cart is saved.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <div className="flex gap-2">
            <Link
              to="/login"
              className="flex-1 inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft"
            >
              Sign in
            </Link>
            <Link
              to="/register"
              className="flex-1 inline-flex items-center justify-center rounded-full border border-border px-5 py-2.5 text-sm font-semibold hover:bg-muted"
            >
              Create account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-md px-5 py-20 text-center animate-rise">
        <ShoppingBag className="mx-auto h-10 w-10 text-muted-foreground/60" />
        <h1 className="mt-4 font-display text-2xl font-semibold">Nothing to check out</h1>
        <Link
          to="/menu"
          className="mt-5 inline-flex rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground"
        >
          Browse the menu
        </Link>
      </div>
    );
  }

  const handlePlaceOrder = async () => {
    if (submittingRef.current) return;
    setProblems([]);

    const found = validateCheckout({
      lines,
      fulfilmentType,
      slot,
      address,
      phone: effectivePhone,
    });

    if (found.length > 0) {
      setProblems(found.map((problem) => problem.message));
      return;
    }

    if (!payment.available) {
      setProblems(["Choose a payment method."]);
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const order = await placeOnlineOrder({
        customer,
        lines,
        fulfilmentType,
        slot,
        phone: effectivePhone,
        notes,
        payment,
        ...(fulfilmentType === "delivery"
          ? {
              address: {
                line1: address.line1!.trim(),
                line2: address.line2?.trim(),
                area: address.area!.trim(),
                city: address.city?.trim() || DELIVERY.city,
                pincode: address.pincode!.trim(),
                landmark: address.landmark?.trim(),
              },
            }
          : {}),
      });

      // The order exists now. If the customer chose to pay online, open the
      // gateway for it — the webhook, not this browser, decides it is paid.
      if (payment.id === "pay_online") {
        const gateway = getConfiguredGateway();

        if (!gateway) {
          setPaymentNote("Online payment is unavailable, so please pay at the counter.");
        } else {
          try {
            const outcome = await gateway.start({
              orderId: order.id,
              amountInPaise: toPaise(order.total),
              currency: "INR",
              customer: {
                name: customer.name,
                email: customer.email,
                phone: effectivePhone,
              },
              description: `Order ${order.id} · Ice Age Creamery`,
            });

            setPaymentNote(
              outcome.status === "pending"
                ? (outcome.message ??
                    "Payment received — the store is confirming it before making your order.")
                : (outcome.message ??
                    "The payment did not complete. Your order is placed; please pay on collection."),
            );
          } catch (payErr) {
            setPaymentNote(
              `${errorMessage(payErr, "The payment window could not open.")} Your order is placed — please pay on collection.`,
            );
          }
        }
      }

      clear();
      setPlaced(order);
      toast.success(`Order ${order.id} sent to the store`);
    } catch (err) {
      const message = errorMessage(err, "Your order was not placed. Please try again.");
      setProblems([message]);
      toast.error("Order not placed", { description: message });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-5 py-12 animate-rise">
      <p className="text-sm font-semibold uppercase tracking-[0.3em] text-accent">Checkout</p>
      <h1 className="mt-2 font-display text-4xl font-semibold">Almost yours.</h1>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          {/* Pickup or delivery */}
          <section className="rounded-3xl border border-border bg-card p-6">
            <h2 className="font-display text-lg font-semibold">How would you like it?</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {(
                [
                  {
                    type: "pickup" as const,
                    icon: Store,
                    title: "Pickup",
                    blurb: "Collect at Krishna Nagar · free",
                  },
                  {
                    type: "delivery" as const,
                    icon: Bike,
                    title: "Delivery",
                    blurb: `₹${DELIVERY.fee} · free over ₹${DELIVERY.freeAbove}`,
                  },
                ] as const
              ).map((option) => (
                <button
                  key={option.type}
                  type="button"
                  onClick={() => setFulfilmentType(option.type)}
                  aria-pressed={fulfilmentType === option.type}
                  className={`rounded-2xl border p-4 text-left transition ${
                    fulfilmentType === option.type
                      ? "border-accent bg-berry-soft/50"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  <option.icon className="h-5 w-5 text-accent" />
                  <p className="mt-2 font-semibold">{option.title}</p>
                  <p className="text-xs text-muted-foreground">{option.blurb}</p>
                </button>
              ))}
            </div>

            {fulfilmentType === "pickup" && (
              <p className="mt-4 rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
                {ADDRESS}
              </p>
            )}
          </section>

          {/* Contact + time */}
          <section className="rounded-3xl border border-border bg-card p-6">
            <h2 className="font-display text-lg font-semibold">Contact & time</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="phone" className="text-xs font-semibold">
                  Phone number *
                </label>
                <input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  value={effectivePhone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="98480 12345"
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="slot" className="text-xs font-semibold">
                  <Clock className="mr-1 inline h-3 w-3" />
                  {fulfilmentType === "delivery" ? "Deliver at (IST)" : "Collect at (IST)"}
                </label>
                <select
                  id="slot"
                  value={slot}
                  onChange={(e) => setSlot(e.target.value)}
                  className={inputCls}
                  disabled={slots.length === 0}
                >
                  {slots.length === 0 && <option value="">Ordering closed for today</option>}
                  {slots.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label htmlFor="notes" className="text-xs font-semibold">
                Anything we should know?
              </label>
              <textarea
                id="notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Less sweet, no nuts, birthday candle…"
                className={inputCls}
              />
            </div>
          </section>

          {/* Delivery address */}
          {fulfilmentType === "delivery" && (
            <section className="rounded-3xl border border-border bg-card p-6">
              <h2 className="font-display text-lg font-semibold">Delivery address</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="line1" className="text-xs font-semibold">
                    Flat / house & street *
                  </label>
                  <input
                    id="line1"
                    value={address.line1 ?? ""}
                    onChange={(e) => setAddress((a) => ({ ...a, line1: e.target.value }))}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor="area" className="text-xs font-semibold">
                    Area / locality *
                  </label>
                  <input
                    id="area"
                    value={address.area ?? ""}
                    onChange={(e) => setAddress((a) => ({ ...a, area: e.target.value }))}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor="pincode" className="text-xs font-semibold">
                    Pincode *
                  </label>
                  <input
                    id="pincode"
                    inputMode="numeric"
                    maxLength={6}
                    value={address.pincode ?? ""}
                    onChange={(e) => setAddress((a) => ({ ...a, pincode: e.target.value }))}
                    className={inputCls}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="landmark" className="text-xs font-semibold">
                    Landmark
                  </label>
                  <input
                    id="landmark"
                    value={address.landmark ?? ""}
                    onChange={(e) => setAddress((a) => ({ ...a, landmark: e.target.value }))}
                    className={inputCls}
                  />
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                We currently deliver to {DELIVERY.city} pincodes{" "}
                {DELIVERY.serviceablePincodes.join(", ")}.
              </p>
            </section>
          )}

          {/* Payment */}
          <section className="rounded-3xl border border-border bg-card p-6">
            <h2 className="font-display text-lg font-semibold">Payment</h2>
            <div className="mt-4 space-y-3">
              {paymentChoices.map((choice) => (
                <button
                  key={choice.id}
                  type="button"
                  disabled={!choice.available}
                  onClick={() => setPaymentId(choice.id)}
                  aria-pressed={payment.id === choice.id}
                  className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition ${
                    payment.id === choice.id
                      ? "border-accent bg-berry-soft/50"
                      : "border-border hover:bg-muted"
                  } ${choice.available ? "" : "cursor-not-allowed opacity-60"}`}
                >
                  <CreditCard className="mt-0.5 h-5 w-5 text-accent" />
                  <span className="min-w-0">
                    <span className="block font-semibold">
                      {choice.label}
                      {!choice.available && choice.unavailableReason && (
                        <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {choice.unavailableReason}
                        </span>
                      )}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {choice.description}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>

        {/* Summary */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-3xl border border-border bg-card p-6">
            <h2 className="font-display text-lg font-semibold">Order summary</h2>

            <ul className="mt-4 space-y-2 text-sm">
              {lines.map((line) => (
                <li key={line.sku} className="flex justify-between gap-3">
                  <span className="min-w-0 truncate text-muted-foreground">
                    {line.quantity} × {line.name}
                  </span>
                  <span className="font-medium">₹{line.lineTotal}</span>
                </li>
              ))}
            </ul>

            <div className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>₹{quote.subtotal}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {fulfilmentType === "delivery" ? "Delivery" : "Pickup"}
                </span>
                <span>
                  {quote.deliveryFee === 0 ? (
                    <span className="font-semibold text-emerald-700">Free</span>
                  ) : (
                    `₹${quote.deliveryFee}`
                  )}
                </span>
              </div>
              <div className="flex justify-between border-t border-border pt-2 text-base">
                <span className="font-semibold">Total</span>
                <span className="font-display font-bold">₹{quote.total}</span>
              </div>
            </div>

            {problems.length > 0 && (
              <ul role="alert" className="mt-4 space-y-2 rounded-xl bg-red-50 p-3">
                {problems.map((problem) => (
                  <li key={problem} className="flex gap-2 text-xs text-red-700">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{problem}</span>
                  </li>
                ))}
              </ul>
            )}

            <button
              onClick={() => void handlePlaceOrder()}
              disabled={submitting || slots.length === 0}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 font-semibold text-primary-foreground shadow-soft transition-transform hover:scale-[1.02] disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  Placing order…
                </>
              ) : (
                <>Place order · ₹{quote.total}</>
              )}
            </button>

            <p className="mt-3 text-center text-[11px] leading-relaxed text-muted-foreground">
              The store confirms every order before it's made. You'll see it under{" "}
              <Link to="/account" className="underline">
                my account
              </Link>
              .
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
