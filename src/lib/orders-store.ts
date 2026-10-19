import { errorCode, errorMessage } from "./utils";
import { useCallback, useEffect, useState } from "react";
import { type Order, type OrderStatus } from "@/data/orders";
import {
  deleteOrderFromFirestore,
  firebaseProjectId,
  isFirebaseConfigured,
  saveOrderToFirestore,
  subscribeToCustomerOrders,
  subscribeToFirestoreOrders,
  updateOrderStatusInFirestore,
} from "./firebase";

/**
 * Order state.
 *
 * Firestore is the single source of truth. There is no localStorage mirror of
 * operational data: a stale cache on a counter tablet is worse than no cache,
 * and a write that failed must never look like it succeeded. Every mutation
 * rejects on failure so the calling screen can tell staff about it.
 */

export type OrdersError = { message: string; kind: "permission" | "network" | "unknown" };

function classifyError(err: unknown): OrdersError {
  const code: string = errorCode(err);
  if (code.includes("permission-denied")) {
    return {
      kind: "permission",
      message: "You don't have permission to view or change these orders. Please sign in again.",
    };
  }
  if (code.includes("unavailable") || code.includes("deadline")) {
    return {
      kind: "network",
      message: "Lost connection to the order database. Reconnecting…",
    };
  }
  return { kind: "unknown", message: errorMessage(err, "Could not reach the order database.") };
}

/** Staff view of the order book. */
export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [error, setError] = useState<OrdersError | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      setError({
        kind: "unknown",
        message: "Firebase is not configured for this build, so orders cannot be loaded.",
      });
      return;
    }

    const unsubscribe = subscribeToFirestoreOrders(
      (next) => {
        setOrders(next);
        setError(null);
        setLoading(false);
      },
      (err) => {
        setError(classifyError(err));
        setLoading(false);
      },
    );

    if (!unsubscribe) {
      setLoading(false);
      setError({ kind: "unknown", message: "Could not open the order stream." });
    }

    return () => unsubscribe?.();
  }, []);

  /** Creates an order. Rejects — and does not touch local state — on failure. */
  const addOrder = useCallback(async (order: Order) => {
    await saveOrderToFirestore(order);
  }, []);

  const updateOrderStatus = useCallback(async (orderId: string, newStatus: OrderStatus) => {
    await updateOrderStatusInFirestore(orderId, newStatus);
  }, []);

  /** Deletes every order currently loaded. Used by the store reset action. */
  const clearAllOrders = useCallback(async () => {
    const failures: string[] = [];
    for (const order of orders) {
      try {
        await deleteOrderFromFirestore(order.id);
      } catch (err) {
        console.error("Failed to delete order:", order.id, err);
        failures.push(order.id);
      }
    }
    if (failures.length > 0) {
      throw new Error(`${failures.length} order(s) could not be deleted. Please try again.`);
    }
  }, [orders]);

  return {
    orders,
    loading,
    error,
    isFirebaseConfigured,
    firebaseProjectId,
    addOrder,
    updateOrderStatus,
    clearAllOrders,
  };
}

/**
 * Customer view: only this customer's own orders.
 * The query is scoped by uid and the rules allow nothing wider.
 */
export function useMyOrders(customerId: string | null | undefined) {
  const [state, setState] = useState<{
    customerId: string | null;
    orders: Order[];
    loading: boolean;
    error: OrdersError | null;
  }>({ customerId: null, orders: [], loading: false, error: null });

  useEffect(() => {
    let active = true;
    const owner = customerId ?? null;
    if (!owner || !isFirebaseConfigured) {
      setState({
        customerId: owner,
        orders: [],
        loading: false,
        error: owner
          ? {
              kind: "unknown",
              message: "Order history is unavailable because Firebase is not configured.",
            }
          : null,
      });
      return;
    }

    setState({ customerId: owner, orders: [], loading: true, error: null });
    const unsubscribe = subscribeToCustomerOrders(
      owner,
      (orders) => {
        if (active) setState({ customerId: owner, orders, loading: false, error: null });
      },
      (err) => {
        if (active)
          setState({ customerId: owner, orders: [], loading: false, error: classifyError(err) });
      },
    );

    if (!unsubscribe)
      setState({
        customerId: owner,
        orders: [],
        loading: false,
        error: { kind: "unknown", message: "Could not load your order history." },
      });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [customerId]);

  // Do not expose the previous account's orders even for the render before the effect runs.
  return state.customerId === (customerId ?? null)
    ? state
    : { orders: [], loading: !!customerId, error: null };
}
