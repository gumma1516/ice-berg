import { errorMessage } from "./utils";
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  browserLocalPersistence,
  browserSessionPersistence,
  setPersistence,
  type Auth,
} from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit as fsLimit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Firestore,
  type Unsubscribe,
} from "firebase/firestore";
import type { Order, OrderStatus } from "@/data/orders";

/**
 * Firebase web configuration.
 *
 * These values are *public* by design — a web API key only identifies the
 * project, it does not grant access. Access is granted by Firebase Auth and
 * enforced by the Firestore security rules in `firestore.rules`.
 *
 * Supply them through `.env` (see `.env.example`) so the same build can be
 * pointed at a staging or a production project.
 */
export const firebaseConfig = {
  apiKey: import.meta.env["VITE_FIREBASE_API_KEY"] ?? "",
  authDomain: import.meta.env["VITE_FIREBASE_AUTH_DOMAIN"] ?? "",
  projectId: import.meta.env["VITE_FIREBASE_PROJECT_ID"] ?? "",
  storageBucket: import.meta.env["VITE_FIREBASE_STORAGE_BUCKET"] ?? "",
  messagingSenderId: import.meta.env["VITE_FIREBASE_MESSAGING_SENDER_ID"] ?? "",
  appId: import.meta.env["VITE_FIREBASE_APP_ID"] ?? "",
  measurementId: import.meta.env["VITE_FIREBASE_MEASUREMENT_ID"] ?? "",
};

/** True only when the build actually carries a usable Firebase configuration. */
export const isFirebaseConfigured: boolean = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId,
);

export const firebaseProjectId: string = firebaseConfig.projectId || "not-configured";

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

if (isFirebaseConfigured) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]!;
    db = getFirestore(app);
    auth = getAuth(app);
  } catch (error) {
    console.error("Firebase initialization failed:", error);
    app = null;
    db = null;
    auth = null;
  }
} else if (typeof window !== "undefined") {
  console.error(
    "Firebase is not configured. Copy .env.example to .env and fill in the VITE_FIREBASE_* values.",
  );
}

if (typeof window !== "undefined" && app && firebaseConfig.measurementId) {
  import("firebase/analytics")
    .then(({ getAnalytics, isSupported }) =>
      isSupported().then((supported) => {
        if (supported && app) getAnalytics(app);
      }),
    )
    .catch(() => {
      /* analytics is optional — never block the app on it */
    });
}

export { app, db, auth };

/**
 * The admin module signs staff in on its own Firebase instance. While a staff
 * session is active it registers that instance here, so store writes carry the
 * staff ID token and satisfy the security rules.
 */
let preferredDb: Firestore | null = null;
let preferredActorUid: (() => string | null) | null = null;

export function setPreferredDb(instance: Firestore, getUid?: () => string | null): void {
  preferredDb = instance;
  preferredActorUid = getUid ?? null;
}

export function clearPreferredDb(): void {
  preferredDb = null;
  preferredActorUid = null;
}

/** The Firestore instance writes should go through right now. */
function activeDb(): Firestore | null {
  return preferredDb ?? db;
}

/** The uid to record as the actor on a write, if anyone is signed in. */
function actorUid(): string | null {
  return preferredActorUid?.() ?? auth?.currentUser?.uid ?? null;
}

/** Keep the session after the browser is closed, or only for this tab. */
export async function applyAuthPersistence(remember: boolean): Promise<void> {
  if (!auth) return;
  try {
    await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
  } catch (err) {
    console.warn("Could not set auth persistence:", err);
  }
}

export function requireDb(): Firestore {
  const instance = activeDb();
  if (!instance) {
    throw new Error(
      "The database is not available right now. Please check your connection and try again.",
    );
  }
  return instance;
}

export function requireAuth(): Auth {
  if (!auth) {
    throw new Error(
      "Sign-in is not available right now. Please check your connection and try again.",
    );
  }
  return auth;
}

// ── Collections ───────────────────────────────────────────────────
export const ORDERS_COLLECTION = "orders";
export const CUSTOMERS_COLLECTION = "customers";
export const STAFF_COLLECTION = "staff";
const SETTINGS_COLLECTION = "store_settings";
const GENERAL_SETTINGS_DOC = "general";

/** How many recent orders the staff dashboard streams. Keeps reads bounded. */
const STAFF_ORDER_WINDOW = 300;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toOrder(id: string, data: any): Order {
  return {
    id,
    customerName: data.customerName || "Guest",
    phone: data.phone || "",
    items: Array.isArray(data.items) ? data.items : [],
    total: Number(data.total) || 0,
    status: (data.status as OrderStatus) || "pending",
    paymentMethod: data.paymentMethod || "upi",
    createdAt: data.createdAt?.toDate
      ? data.createdAt.toDate()
      : new Date(data.createdAt || Date.now()),
    notes: data.notes || undefined,
    customerId: data.customerId || null,
    customerEmail: data.customerEmail || null,
    channel: data.channel || "counter",
    paymentStatus: data.paymentStatus || "unpaid",
    subtotal: typeof data.subtotal === "number" ? data.subtotal : undefined,
    deliveryFee: typeof data.deliveryFee === "number" ? data.deliveryFee : undefined,
    fulfilment: data.fulfilment || undefined,
    paymentReference: data.paymentReference || undefined,
    paymentGatewayId: data.paymentGatewayId || undefined,
    paymentAmountMismatch: data.paymentAmountMismatch === true,
    paymentReportedPaise:
      typeof data.paymentReportedPaise === "number" ? data.paymentReportedPaise : undefined,
  };
}

/** The document body shared by counter and online orders. */
function orderPayload(order: Order) {
  return {
    customerName: order.customerName,
    phone: order.phone,
    items: order.items,
    subtotal: order.subtotal ?? order.total,
    deliveryFee: order.deliveryFee ?? 0,
    total: order.total,
    status: order.status,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus ?? "unpaid",
    channel: order.channel ?? "counter",
    fulfilment: order.fulfilment ?? null,
    createdAt: order.createdAt instanceof Date ? order.createdAt : new Date(order.createdAt),
    notes: order.notes || null,
    customerId: order.customerId || null,
    customerEmail: order.customerEmail || null,
  };
}

/** Staff view: the most recent orders across the whole store. */
export function subscribeToFirestoreOrders(
  onUpdate: (orders: Order[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe | null {
  const database = activeDb();
  if (!database) return null;

  try {
    const q = query(
      collection(database, ORDERS_COLLECTION),
      orderBy("createdAt", "desc"),
      fsLimit(STAFF_ORDER_WINDOW),
    );

    return onSnapshot(
      q,
      (snapshot) => onUpdate(snapshot.docs.map((d) => toOrder(d.id, d.data()))),
      (error) => {
        console.error("Firestore orders subscription error:", error);
        onError?.(error);
      },
    );
  } catch (e) {
    console.error("Error setting up orders listener:", e);
    onError?.(e instanceof Error ? e : new Error(errorMessage(e)));
    return null;
  }
}

/**
 * Customer view: only the orders that belong to this signed-in customer.
 * The security rules allow exactly this query and nothing wider.
 */
export function subscribeToCustomerOrders(
  customerId: string,
  onUpdate: (orders: Order[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe | null {
  const database = activeDb();
  if (!database || !customerId) return null;

  try {
    const q = query(
      collection(database, ORDERS_COLLECTION),
      where("customerId", "==", customerId),
      fsLimit(50),
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const orders = snapshot.docs
          .map((d) => toOrder(d.id, d.data()))
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        onUpdate(orders);
      },
      (error) => {
        console.error("Firestore customer orders error:", error);
        onError?.(error);
      },
    );
  } catch (e) {
    onError?.(e instanceof Error ? e : new Error(errorMessage(e)));
    return null;
  }
}

/**
 * Looks up a registered customer's uid by email, so staff can attach a
 * counter order to a member account. Staff-only: the rules reject this query
 * for everyone else.
 */
export async function findCustomerIdByEmail(email: string): Promise<string | null> {
  const database = activeDb();
  if (!database) return null;

  const normalised = email.trim().toLowerCase();
  if (!normalised) return null;

  const snap = await getDocs(
    query(collection(database, CUSTOMERS_COLLECTION), where("email", "==", normalised), fsLimit(1)),
  );

  return snap.empty ? null : snap.docs[0]!.id;
}

/** Create an order. Rejects if the write fails — callers must surface that. */
export async function saveOrderToFirestore(order: Order): Promise<void> {
  const database = requireDb();

  await setDoc(doc(database, ORDERS_COLLECTION, order.id), {
    ...orderPayload(order),
    createdBy: actorUid(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Creates an order placed by a customer on the website.
 *
 * Always written through the customer's own session, so the security rules see
 * the customer's uid and can enforce that the order belongs to them, arrives
 * unpaid, and starts as `awaiting_confirmation` for the store to accept.
 */
export async function createOnlineOrderInFirestore(order: Order): Promise<void> {
  if (!db) {
    throw new Error(
      "We couldn't reach the store right now. Please check your connection and try again.",
    );
  }

  const uid = auth?.currentUser?.uid;
  if (!uid) throw new Error("Please sign in again to place your order.");

  await setDoc(doc(db, ORDERS_COLLECTION, order.id), {
    ...orderPayload(order),
    status: "awaiting_confirmation",
    paymentStatus: order.paymentStatus === "pending" ? "pending" : "unpaid",
    channel: "online",
    customerId: uid,
    createdBy: uid,
    updatedAt: serverTimestamp(),
  });
}

export async function updateOrderStatusInFirestore(
  orderId: string,
  status: OrderStatus,
): Promise<void> {
  const database = requireDb();
  await updateDoc(doc(database, ORDERS_COLLECTION, orderId), {
    status,
    updatedAt: serverTimestamp(),
    updatedBy: actorUid(),
  });
}

export async function deleteOrderFromFirestore(orderId: string): Promise<void> {
  const database = requireDb();
  await deleteDoc(doc(database, ORDERS_COLLECTION, orderId));
}

/** Connection check for the admin diagnostics panel. */
export async function testFirebaseConnection(): Promise<{
  success: boolean;
  latencyMs: number;
  docCount: number;
  message: string;
}> {
  const database = activeDb();
  if (!database) {
    return { success: false, latencyMs: 0, docCount: 0, message: "Firebase is not configured" };
  }
  const start = performance.now();
  try {
    const snap = await getDocs(
      query(collection(database, ORDERS_COLLECTION), orderBy("createdAt", "desc"), fsLimit(1)),
    );
    return {
      success: true,
      latencyMs: Math.round(performance.now() - start),
      docCount: snap.size,
      message: `Verified connected to ${firebaseProjectId}`,
    };
  } catch (err) {
    return {
      success: false,
      latencyMs: Math.round(performance.now() - start),
      docCount: 0,
      message: errorMessage(err, "Failed to reach Firestore"),
    };
  }
}

// ── Store settings ────────────────────────────────────────────────
// Store settings are a free-form key/value document edited by staff.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function saveStoreSettingsToFirestore(settings: Record<string, any>): Promise<void> {
  const database = requireDb();
  await setDoc(doc(database, SETTINGS_COLLECTION, GENERAL_SETTINGS_DOC), settings, {
    merge: true,
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getStoreSettingsFromFirestore(): Promise<Record<string, any> | null> {
  const database = activeDb();
  if (!database) return null;
  try {
    const snap = await getDoc(doc(database, SETTINGS_COLLECTION, GENERAL_SETTINGS_DOC));
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    console.error("Failed to load store settings from Firestore:", e);
    return null;
  }
}
