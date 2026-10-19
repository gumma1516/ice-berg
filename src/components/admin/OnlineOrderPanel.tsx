import { AlertTriangle, Bike, CheckCircle2, ShieldCheck, Store } from "lucide-react";

import type { Order } from "@/data/orders";
import { verifyOrderPricing } from "@/lib/checkout";

/**
 * The staff-side view of an order a customer placed on the website.
 *
 * This is the integrity boundary: an online order arrives as
 * "Needs confirming" and its prices are re-calculated from the current menu
 * here. Staff see any mismatch before accepting the order, so a stale or
 * tampered cart never turns into a charge.
 */
export function OnlineOrderPanel({
  order,
  onConfirm,
  onReject,
  busy,
}: {
  order: Order;
  onConfirm?: () => void;
  onReject?: () => void;
  busy?: boolean;
}) {
  if (order.channel !== "online") return null;

  const check = verifyOrderPricing(order);
  const fulfilment = order.fulfilment;
  const isDelivery = fulfilment?.type === "delivery";
  const needsConfirming = order.status === "awaiting_confirmation";

  return (
    <div className="mt-5 space-y-3">
      {/* Fulfilment */}
      <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-4 text-xs">
        <div className="flex items-center gap-2 font-semibold text-violet-900">
          {isDelivery ? <Bike className="h-4 w-4" /> : <Store className="h-4 w-4" />}
          <span>{isDelivery ? "Delivery" : "Pickup"} · website order</span>
        </div>

        <div className="mt-2 space-y-1 text-violet-900/80">
          <div className="flex justify-between gap-3">
            <span>{isDelivery ? "Deliver at" : "Collect at"}</span>
            <span className="font-semibold">{fulfilment?.slot ?? "—"}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span>Payment</span>
            <span className="font-semibold uppercase">
              {order.paymentMethod} · {order.paymentStatus ?? "unpaid"}
            </span>
          </div>
          {order.paymentReference && (
            <div className="flex justify-between gap-3">
              <span>UPI reference</span>
              <span className="font-mono font-semibold">{order.paymentReference}</span>
            </div>
          )}
          {order.customerEmail && (
            <div className="flex justify-between gap-3">
              <span>Account</span>
              <span className="truncate font-semibold">{order.customerEmail}</span>
            </div>
          )}
        </div>

        {isDelivery && fulfilment?.address && (
          <address className="mt-3 border-t border-violet-200 pt-2 not-italic leading-relaxed text-violet-900">
            {fulfilment.address.line1}
            {fulfilment.address.line2 ? `, ${fulfilment.address.line2}` : ""}
            <br />
            {fulfilment.address.area}, {fulfilment.address.city} {fulfilment.address.pincode}
            {fulfilment.address.landmark && (
              <>
                <br />
                <span className="text-violet-900/70">Landmark: {fulfilment.address.landmark}</span>
              </>
            )}
          </address>
        )}
      </div>

      {/* Totals as the customer saw them */}
      <div className="rounded-xl bg-[#faf9f8] p-4 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Items</span>
          <span>₹{order.subtotal ?? order.total}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Delivery fee</span>
          <span>₹{order.deliveryFee ?? 0}</span>
        </div>
        <div className="mt-1 flex justify-between border-t border-border/50 pt-1 font-semibold">
          <span>Order total</span>
          <span>₹{order.total}</span>
        </div>
      </div>

      {order.paymentAmountMismatch && (
        <div className="rounded-xl bg-red-50 p-3 text-xs text-red-800">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" />
            <span>Payment amount does not match</span>
          </div>
          <p className="mt-1">
            The gateway reported ₹{((order.paymentReportedPaise ?? 0) / 100).toFixed(2)} against an
            order total of ₹{order.total}. The order has NOT been marked paid — settle the
            difference at the counter before handing it over.
          </p>
        </div>
      )}

      {/* Price verification */}
      {check.matches ? (
        <div className="flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Price check passed — every line matches today's menu and the total works out to ₹
            {check.expectedTotal}.
          </span>
        </div>
      ) : (
        <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" />
            <span>Price check needs a look</span>
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            {check.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
          <p className="mt-2 font-semibold">
            Today's menu total: ₹{check.expectedTotal}. Charge this amount, not the order total.
          </p>
        </div>
      )}

      {needsConfirming && (onConfirm || onReject) && (
        <div className="flex gap-2">
          {onConfirm && (
            <button
              onClick={onConfirm}
              disabled={busy}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-accent py-2.5 text-xs font-semibold text-accent-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              <CheckCircle2 className="h-4 w-4" />
              Accept & start making
            </button>
          )}
          {onReject && (
            <button
              onClick={onReject}
              disabled={busy}
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-60"
            >
              Reject
            </button>
          )}
        </div>
      )}
    </div>
  );
}
