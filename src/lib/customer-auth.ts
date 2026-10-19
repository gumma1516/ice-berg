import { errorCode, errorMessage } from "./utils";
import { useCallback, useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  getAdditionalUserInfo,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile as updateAuthProfile,
  type User,
} from "firebase/auth";
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";

import {
  applyAuthPersistence,
  auth,
  CUSTOMERS_COLLECTION,
  db,
  firebaseProjectId,
  isFirebaseConfigured,
  requireAuth,
  requireDb,
} from "./firebase";

/**
 * Customer identity module.
 *
 * Rules of this module, in order of importance:
 *   1. Firebase Auth is the ONLY source of identity. A Firestore document is
 *      never treated as proof of who someone is.
 *   2. Passwords are never stored, cached, compared or logged here. Firebase
 *      Auth holds them; we never see them again after the sign-in call.
 *   3. The signed-in customer is whatever `onAuthStateChanged` reports — not
 *      whatever happens to sit in localStorage.
 */

export type CustomerTier = "Classic" | "Gold Scoop" | "Platinum Swirl";

export interface CustomerProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  favoriteFlavor?: string | undefined;
  memberSince: string;
  points: number;
  tier: CustomerTier;
  emailVerified?: boolean | undefined;
  authProvider?: "password" | "google" | undefined;
}

export interface RegisterInput {
  name: string;
  email: string;
  phone: string;
  password: string;
  favoriteFlavor?: string | undefined;
}

/** Points credited by the welcome bonus. Mirrored in `firestore.rules`. */
export const WELCOME_POINTS = 100;
const DEFAULT_TIER: CustomerTier = "Classic";

function memberSinceLabel(date = new Date()): string {
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function tierFor(points: number): CustomerTier {
  if (points >= 1000) return "Platinum Swirl";
  if (points >= 300) return "Gold Scoop";
  return "Classic";
}

/** Turns a Firebase Auth error into something a customer can act on. */
function friendlyAuthError(
  err: unknown,
  context: "login" | "register" | "google" | "reset",
): Error {
  const code: string = errorCode(err);

  switch (code) {
    case "auth/invalid-email":
      return new Error("That email address doesn't look right. Please check it and try again.");
    case "auth/missing-password":
      return new Error("Please enter your password.");
    case "auth/weak-password":
      return new Error("Please choose a password with at least 6 characters.");

    case "auth/email-already-in-use":
      return new Error(
        "An account with this email already exists. Please sign in instead, or use “Forgot password”.",
      );

    case "auth/user-not-found":
      return new Error("No account found with this email. Please register first.");
    case "auth/wrong-password":
      return new Error("Incorrect password. Please try again or reset your password.");

    // Firebase returns this single code for both “no such user” and “wrong
    // password” while email-enumeration protection is enabled.
    case "auth/invalid-credential":
      return new Error(
        "We couldn't sign you in. Check your email and password — if you haven't registered yet, create an account first.",
      );

    case "auth/user-disabled":
      return new Error("This account has been disabled. Please contact the store.");
    case "auth/too-many-requests":
      return new Error("Too many attempts. Please wait a few minutes and try again.");
    case "auth/network-request-failed":
      return new Error("Network problem. Please check your connection and try again.");

    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return new Error("Google sign-in was closed before it finished.");
    case "auth/popup-blocked":
      return new Error(
        "Your browser blocked the Google sign-in popup. Please allow popups and retry.",
      );
    case "auth/account-exists-with-different-credential":
      return new Error(
        "This email is already registered with a password. Please sign in with your email and password.",
      );
    case "auth/unauthorized-domain":
      return new Error(
        "This website domain is not authorised in Firebase (Authentication → Settings → Authorized domains).",
      );
    case "auth/operation-not-allowed":
      return new Error(
        context === "google"
          ? "Google sign-in is not enabled for this project yet."
          : "Email and password sign-in is not enabled for this project yet.",
      );

    default:
      return new Error(errorMessage(err, "Something went wrong. Please try again."));
  }
}

/** Read profile data defensively; Firebase Auth remains the identity source. */
function profileFromDoc(
  id: string,
  data: Record<string, unknown>,
  user?: User | null,
): CustomerProfile {
  const text = (key: string) => (typeof data[key] === "string" ? (data[key] as string) : "");
  const points =
    typeof data["points"] === "number" && Number.isFinite(data["points"]) && data["points"] >= 0
      ? data["points"]
      : 0;
  const tier = text("tier");
  const provider = text("authProvider");
  return {
    id,
    name: text("name") || user?.displayName || "Customer",
    email: user?.email || text("email"),
    phone: text("phone"),
    favoriteFlavor: text("favoriteFlavor") || undefined,
    memberSince: text("memberSince") || memberSinceLabel(),
    points,
    tier:
      tier === "Classic" || tier === "Gold Scoop" || tier === "Platinum Swirl"
        ? tier
        : tierFor(points),
    emailVerified: user?.emailVerified,
    authProvider: provider === "password" || provider === "google" ? provider : undefined,
  };
}

/** Fallback profile used when the Firestore document can't be read. */
function profileFromUser(user: User): CustomerProfile {
  return {
    id: user.uid,
    name: user.displayName || user.email?.split("@")[0] || "Customer",
    email: (user.email || "").toLowerCase(),
    phone: user.phoneNumber || "",
    memberSince: memberSinceLabel(),
    points: 0,
    tier: DEFAULT_TIER,
    emailVerified: user.emailVerified,
  };
}

/**
 * Creates the customer document for a freshly created Auth user.
 * Never writes a password. The shape here must satisfy `firestore.rules`.
 */
async function createCustomerDocument(
  user: User,
  input: {
    name: string;
    phone: string;
    favoriteFlavor?: string | undefined;
    provider: "password" | "google";
  },
): Promise<CustomerProfile> {
  const database = requireDb();
  const profile: CustomerProfile = {
    id: user.uid,
    name: input.name,
    email: (user.email || "").toLowerCase(),
    phone: input.phone,
    favoriteFlavor: input.favoriteFlavor || "Belgian Chocolate",
    memberSince: memberSinceLabel(),
    points: WELCOME_POINTS,
    tier: DEFAULT_TIER,
    emailVerified: user.emailVerified,
    authProvider: input.provider,
  };

  await setDoc(doc(database, CUSTOMERS_COLLECTION, user.uid), {
    name: profile.name,
    email: profile.email,
    phone: profile.phone,
    favoriteFlavor: profile.favoriteFlavor,
    memberSince: profile.memberSince,
    points: WELCOME_POINTS,
    tier: DEFAULT_TIER,
    authProvider: input.provider,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return profile;
}

async function loadCustomerProfile(user: User): Promise<CustomerProfile | null> {
  if (!db) return null;
  const snap = await getDoc(doc(db, CUSTOMERS_COLLECTION, user.uid));
  return snap.exists() ? profileFromDoc(snap.id, snap.data(), user) : null;
}

// ── Registration ──────────────────────────────────────────────────

/**
 * Registers a new customer.
 *
 * Firebase Auth decides whether the email is already taken — that check is
 * server-side and cannot be bypassed from the browser. If the email exists,
 * registration fails and the customer is told to sign in instead.
 */
export async function registerCustomer(input: RegisterInput): Promise<CustomerProfile> {
  const authInstance = requireAuth();
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  const phone = input.phone.trim();

  let credential;
  try {
    credential = await createUserWithEmailAndPassword(authInstance, email, input.password);
  } catch (err) {
    throw friendlyAuthError(err, "register");
  }

  const user = credential.user;

  try {
    await updateAuthProfile(user, { displayName: name });
  } catch (err) {
    console.warn("Could not set the display name:", err);
  }

  let profile: CustomerProfile;
  try {
    profile = await createCustomerDocument(user, {
      name,
      phone,
      favoriteFlavor: input.favoriteFlavor,
      provider: "password",
    });
  } catch (err) {
    // The Auth user exists but the profile write failed. Surface it plainly
    // rather than pretending the account is ready.
    console.error("Failed to create the customer profile document:", err);
    throw new Error(
      "Your sign-in was created but your profile could not be saved. Please sign in again — if it keeps failing, contact the store.",
    );
  }

  // Best-effort: a failed verification mail must not fail the registration.
  sendEmailVerification(user).catch((err) =>
    console.warn("Could not send the verification email:", err),
  );

  return profile;
}

// ── Sign in ───────────────────────────────────────────────────────

/**
 * Signs a customer in with email and password.
 *
 * Firebase Auth verifies the credentials. Only after that do we read the
 * customer's own profile document. There is no Firestore-first path and no
 * local password fallback — an unregistered email cannot get in.
 */
export async function loginCustomer(
  email: string,
  password: string,
  remember = true,
): Promise<CustomerProfile> {
  const authInstance = requireAuth();
  const emailNorm = email.trim().toLowerCase();

  await applyAuthPersistence(remember);

  let credential;
  try {
    credential = await signInWithEmailAndPassword(authInstance, emailNorm, password);
  } catch (err) {
    throw friendlyAuthError(err, "login");
  }

  const user = credential.user;
  const existing = await loadCustomerProfile(user).catch((err) => {
    console.warn("Could not load the customer profile:", err);
    return null;
  });

  if (existing) return existing;

  // Authenticated, but no profile yet (e.g. an account created before this
  // module, or an interrupted registration). Create it now.
  try {
    return await createCustomerDocument(user, {
      name: user.displayName || emailNorm.split("@")[0] || "Customer",
      phone: user.phoneNumber || "",
      provider: "password",
    });
  } catch (err) {
    console.warn("Could not backfill the customer profile:", err);
    return profileFromUser(user);
  }
}

/** Signs in (or registers) a customer through Google. */
export async function signInWithGoogle(
  _mode: "signin" | "signup" = "signin",
): Promise<{ profile: CustomerProfile; isNewUser: boolean }> {
  const authInstance = requireAuth();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  await applyAuthPersistence(true);

  let result;
  try {
    result = await signInWithPopup(authInstance, provider);
  } catch (err) {
    throw friendlyAuthError(err, "google");
  }

  const user = result.user;
  const isNewUser = getAdditionalUserInfo(result)?.isNewUser ?? false;

  const existing = await loadCustomerProfile(user).catch(() => null);
  if (existing) return { profile: existing, isNewUser: false };

  try {
    const profile = await createCustomerDocument(user, {
      name: user.displayName || user.email?.split("@")[0] || "Customer",
      phone: user.phoneNumber || "",
      provider: "google",
    });
    return { profile, isNewUser: true };
  } catch (err) {
    console.warn("Could not create the Google customer profile:", err);
    return { profile: profileFromUser(user), isNewUser };
  }
}

export async function logoutCustomer(): Promise<void> {
  if (!auth) return;
  await signOut(auth);
}

export async function sendPasswordReset(email: string): Promise<void> {
  const authInstance = requireAuth();
  try {
    await sendPasswordResetEmail(authInstance, email.trim().toLowerCase());
  } catch (err) {
    throw friendlyAuthError(err, "reset");
  }
}

/**
 * Updates the fields a customer is allowed to change about themselves.
 * Points and tier are deliberately not writable here — the rules reject them.
 */
export async function updateCustomerProfile(updates: {
  name?: string;
  phone?: string;
  favoriteFlavor?: string;
}): Promise<void> {
  const database = requireDb();
  const user = requireAuth().currentUser;
  if (!user) throw new Error("Please sign in again to update your profile.");

  const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (updates.name !== undefined) payload["name"] = updates.name.trim();
  if (updates.phone !== undefined) payload["phone"] = updates.phone.trim();
  if (updates.favoriteFlavor !== undefined) payload["favoriteFlavor"] = updates.favoriteFlavor;

  await updateDoc(doc(database, CUSTOMERS_COLLECTION, user.uid), payload);

  if (updates.name) {
    await updateAuthProfile(user, { displayName: updates.name.trim() }).catch(() => {});
  }
}

// ── React binding ─────────────────────────────────────────────────

export function useCustomerAuth() {
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [authReady, setAuthReady] = useState(!isFirebaseConfigured);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!auth) {
      setAuthReady(true);
      return;
    }

    let profileUnsub: (() => void) | null = null;
    let identityVersion = 0;

    const stopProfileListener = () => {
      profileUnsub?.();
      profileUnsub = null;
    };

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      stopProfileListener();
      const version = ++identityVersion;

      if (!user) {
        setCustomer(null);
        setAuthReady(true);
        return;
      }

      // Show something immediately, then keep it in sync with Firestore so
      // points and tier updates land without a refresh.
      setCustomer((prev) => (prev?.id === user.uid ? prev : profileFromUser(user)));

      if (!db) {
        setAuthReady(true);
        return;
      }

      profileUnsub = onSnapshot(
        doc(db, CUSTOMERS_COLLECTION, user.uid),
        (snap) => {
          if (version !== identityVersion) return;
          if (snap.exists()) setCustomer(profileFromDoc(snap.id, snap.data(), user));
          setAuthReady(true);
        },
        (err) => {
          if (version !== identityVersion) return;
          console.warn("Customer profile listener error:", err);
          setAuthReady(true);
        },
      );
    });

    return () => {
      identityVersion++;
      stopProfileListener();
      unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string, password: string, remember = true) => {
    setBusy(true);
    try {
      return await loginCustomer(email, password, remember);
    } finally {
      setBusy(false);
    }
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    setBusy(true);
    try {
      return await registerCustomer(input);
    } finally {
      setBusy(false);
    }
  }, []);

  const loginWithGoogle = useCallback(async (mode: "signin" | "signup" = "signin") => {
    setBusy(true);
    try {
      return await signInWithGoogle(mode);
    } finally {
      setBusy(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await logoutCustomer();
  }, []);

  return {
    customer,
    isLoggedIn: !!customer,
    /** True while a sign-in/registration call is running. */
    loading: busy,
    /** False until Firebase has reported the initial auth state. */
    authReady,
    login,
    register,
    loginWithGoogle,
    logout,
    resetPassword: sendPasswordReset,
    updateProfile: updateCustomerProfile,
    isFirebaseConfigured,
    firebaseProjectId,
  };
}
