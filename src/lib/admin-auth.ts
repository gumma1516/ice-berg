import { errorCode, errorMessage } from "./utils";
import { useCallback, useEffect, useState } from "react";
import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  browserSessionPersistence,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  type Auth,
  type User,
} from "firebase/auth";
import { doc, getDoc, getFirestore, type Firestore } from "firebase/firestore";

import {
  clearPreferredDb,
  firebaseConfig,
  isFirebaseConfigured,
  setPreferredDb,
  STAFF_COLLECTION,
} from "./firebase";

/**
 * Staff / admin identity module — deliberately separate from the customer one.
 *
 * It runs on its own Firebase app instance ("admin"), so a staff session and a
 * customer session can exist in the same browser without evicting each other,
 * and the admin session is tab-scoped: closing the tab signs staff out.
 *
 * Being signed in is NOT enough to reach the admin portal. A user is staff only
 * if the server says so, by either of:
 *   - a custom claim (`staff: true`, or `role: "admin" | "staff" | "manager"`), or
 *   - an active document at `staff/{uid}` in Firestore.
 * Claims are server-managed; staff records are managed by authorised admins.
 * A disabled staff record overrides any existing claim. Firestore enforces the
 * same condition for protected reads and writes.
 */

export const STAFF_ROLES = ["admin", "manager", "staff"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export interface StaffAccount {
  uid: string;
  email: string;
  name: string;
  role: StaffRole;
  source: "claim" | "firestore";
}

const ADMIN_APP_NAME = "admin";

let adminApp: FirebaseApp | null = null;
let adminAuthInstance: Auth | null = null;
let adminDbInstance: Firestore | null = null;

function ensureAdminApp(): { auth: Auth; db: Firestore } | null {
  if (!isFirebaseConfigured) return null;

  if (!adminApp) {
    try {
      adminApp = getApps().some((a) => a.name === ADMIN_APP_NAME)
        ? getApp(ADMIN_APP_NAME)
        : initializeApp(firebaseConfig, ADMIN_APP_NAME);
      adminAuthInstance = getAuth(adminApp);
      adminDbInstance = getFirestore(adminApp);
    } catch (err) {
      console.error("Could not initialise the admin Firebase instance:", err);
      return null;
    }
  }

  return adminAuthInstance && adminDbInstance
    ? { auth: adminAuthInstance, db: adminDbInstance }
    : null;
}

export function getAdminAuth(): Auth | null {
  return ensureAdminApp()?.auth ?? null;
}

export function getAdminDb(): Firestore | null {
  return ensureAdminApp()?.db ?? null;
}

function friendlyStaffError(err: unknown): Error {
  switch (errorCode(err)) {
    case "auth/invalid-email":
      return new Error("That staff email doesn't look right.");
    case "auth/missing-password":
      return new Error("Please enter your password.");
    case "auth/user-not-found":
    case "auth/invalid-credential":
    case "auth/wrong-password":
      return new Error("Incorrect staff email or password.");
    case "auth/user-disabled":
      return new Error("This staff account has been disabled.");
    case "auth/too-many-requests":
      return new Error("Too many attempts. Please wait a few minutes and try again.");
    case "auth/network-request-failed":
      return new Error("Network problem. Please check the connection and try again.");
    default:
      return new Error(errorMessage(err, "Could not sign in. Please try again."));
  }
}

// Custom claims are an untyped token payload.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function roleFromClaims(claims: any): StaffRole | null {
  if (claims.admin === true) return "admin";
  const claimed = typeof claims.role === "string" ? claims.role.toLowerCase() : null;
  if (claimed && (STAFF_ROLES as readonly string[]).includes(claimed)) {
    return claimed as StaffRole;
  }
  if (claims.staff === true) return "staff";
  return null;
}

/**
 * Resolves whether an authenticated user is staff. Returns null when they are
 * not — the caller must treat that as "no access".
 */
export async function resolveStaffAccount(user: User): Promise<StaffAccount | null> {
  const db = getAdminDb();
  if (!db) return null;

  // Team deactivation applies even when an older token has a staff claim.
  // Own-record reads are allowed by the rules, including when no record exists.
  let data: Record<string, unknown> | null;
  try {
    const snap = await getDoc(doc(db, STAFF_COLLECTION, user.uid));
    data = snap.exists() ? snap.data() : null;
    if (data?.["active"] === false) return null;
  } catch (err) {
    console.warn("Staff lookup failed:", err);
    return null;
  }

  // 1. Custom claims (preferred: nothing in Firestore has to be readable).
  try {
    const token = await user.getIdTokenResult(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const role = roleFromClaims(token.claims as any);
    if (role) {
      return {
        uid: user.uid,
        email: user.email || "",
        name: user.displayName || user.email?.split("@")[0] || "Staff",
        role,
        source: "claim",
      };
    }
  } catch (err) {
    console.warn("Could not read the staff token claims:", err);
  }

  // 2. A staff document, so the owner can grant access from the Firebase
  //    console without deploying anything.
  if (!data) return null;
  const role = typeof data["role"] === "string" ? data["role"] : "staff";
  return {
    uid: user.uid,
    email: typeof data["email"] === "string" ? (data["email"] as string) : user.email || "",
    name: typeof data["name"] === "string" ? (data["name"] as string) : user.displayName || "Staff",
    role: ((STAFF_ROLES as readonly string[]).includes(role) ? role : "staff") as StaffRole,
    source: "firestore",
  };
}

export async function signInStaff(email: string, password: string): Promise<StaffAccount> {
  const auth = getAdminAuth();
  if (!auth) throw new Error("The admin portal is not configured. Check the Firebase settings.");

  // Staff sessions are tab-scoped on purpose: a shared counter device should
  // not stay signed in to the till after the browser is closed.
  try {
    await setPersistence(auth, browserSessionPersistence);
  } catch (err) {
    console.warn("Could not set the admin session persistence:", err);
  }

  let credential;
  try {
    credential = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
  } catch (err) {
    throw friendlyStaffError(err);
  }

  const staff = await resolveStaffAccount(credential.user);
  if (!staff) {
    await signOut(auth).catch(() => {});
    throw new Error(
      "This account is not authorised for the staff portal. Ask the store owner to grant access.",
    );
  }

  return staff;
}

export async function signOutStaff(): Promise<void> {
  const auth = getAdminAuth();
  if (!auth) return;
  try {
    await signOut(auth);
  } catch (err) {
    console.warn("Staff sign-out warning:", err);
  }
}

export async function sendStaffPasswordReset(email: string): Promise<void> {
  const auth = getAdminAuth();
  if (!auth) throw new Error("The admin portal is not configured.");
  try {
    await sendPasswordResetEmail(auth, email.trim().toLowerCase());
  } catch (err) {
    throw friendlyStaffError(err);
  }
}

export function useAdminAuth() {
  const [staff, setStaff] = useState<StaffAccount | null>(null);
  const [authReady, setAuthReady] = useState(!isFirebaseConfigured);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const auth = getAdminAuth();
    if (!auth) {
      setAuthReady(true);
      return;
    }

    let active = true;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        clearPreferredDb();
        if (active) {
          setStaff(null);
          setAuthReady(true);
        }
        return;
      }

      const resolved = await resolveStaffAccount(user);
      if (!active || auth.currentUser !== user) return;

      if (resolved) {
        // Route store writes through the staff-authenticated instance so the
        // rules see a staff token.
        const db = getAdminDb();
        if (db) setPreferredDb(db, () => getAdminAuth()?.currentUser?.uid ?? null);
      } else {
        clearPreferredDb();
      }

      setStaff(resolved);
      setAuthReady(true);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  /** Re-checks staff access for the current user, after their record changes. */
  const refresh = useCallback(async () => {
    const auth = getAdminAuth();
    const user = auth?.currentUser;

    if (!user) {
      clearPreferredDb();
      setStaff(null);
      return;
    }

    const resolved = await resolveStaffAccount(user);
    if (auth?.currentUser !== user) return;
    if (resolved) {
      const db = getAdminDb();
      if (db) setPreferredDb(db, () => getAdminAuth()?.currentUser?.uid ?? null);
    } else {
      clearPreferredDb();
    }
    setStaff(resolved);
    setAuthReady(true);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setBusy(true);
    try {
      return await signInStaff(email, password);
    } finally {
      setBusy(false);
    }
  }, []);

  const signOutAdmin = useCallback(async () => {
    await signOutStaff();
    clearPreferredDb();
    setStaff(null);
  }, []);

  return {
    staff,
    isStaff: !!staff,
    authReady,
    loading: busy,
    signIn,
    refresh,
    signOut: signOutAdmin,
    resetPassword: sendStaffPasswordReset,
    isFirebaseConfigured,
  };
}
