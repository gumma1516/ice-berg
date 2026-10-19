import { deleteApp, getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  inMemoryPersistence,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { collection, doc, getDocs, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";

import { getAdminAuth, getAdminDb, STAFF_ROLES, type StaffRole } from "./admin-auth";
import { firebaseConfig, isFirebaseConfigured, STAFF_COLLECTION } from "./firebase";

/**
 * Staff account management, run from the portal instead of the Firebase console.
 *
 * Creating a Firebase Auth user normally signs the creator in as the new user.
 * To avoid throwing the owner out of their own session, every new account is
 * created on a short-lived third Firebase app ("provisioning") which is signed
 * out and disposed of immediately afterwards.
 *
 * Authority still comes from the server: the `staff/{uid}` document is what
 * grants portal access, and the security rules only let an **admin** write it.
 */

const PROVISIONING_APP_NAME = "staff-provisioning";

export type StaffMember = {
  uid: string;
  name: string;
  email: string;
  role: StaffRole;
  active: boolean;
  createdAt?: string | undefined;
};

/**
 * The one email allowed to claim the owner account on first run, from
 * `VITE_ADMIN_OWNER_EMAIL`. The security rules carry the same address — that
 * copy is the authority; this one only decides what the portal offers to show.
 */
export function getOwnerEmail(): string | null {
  const email = import.meta.env["VITE_ADMIN_OWNER_EMAIL"];
  return email ? email.trim().toLowerCase() : null;
}

export function isOwnerEmail(email: string): boolean {
  const owner = getOwnerEmail();
  return owner !== null && email.trim().toLowerCase() === owner;
}

export function isValidRole(role: string): role is StaffRole {
  return (STAFF_ROLES as readonly string[]).includes(role);
}

/** At least 8 characters, with a letter and a digit. */
export function passwordProblem(password: string): string | null {
  if (password.length < 8) return "Use at least 8 characters.";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return "Use at least one letter and one number.";
  }
  return null;
}

function friendlyProvisioningError(err: unknown): Error {
  const code = (err as { code?: string })?.code ?? "";

  switch (code) {
    case "auth/email-already-in-use":
      return new Error(
        "An account with this email already exists. If they're already staff, ask them to sign in; otherwise reset their password.",
      );
    case "auth/invalid-email":
      return new Error("That email address doesn't look right.");
    case "auth/weak-password":
      return new Error("Firebase rejected that password. Use at least 6 characters.");
    case "auth/operation-not-allowed":
      return new Error("Email and password sign-in is not enabled for this Firebase project yet.");
    case "permission-denied":
      return new Error(
        "Your account is not allowed to add staff. Only an admin can, and the security rules must be deployed.",
      );
    default:
      return new Error(
        (err as { message?: string })?.message ?? "Could not create the account. Please try again.",
      );
  }
}

/**
 * Creates the Auth user on a throwaway app instance, so the caller's own
 * session is untouched. Returns the new user's uid.
 */
async function createAuthUserWithoutSwitchingSession(input: {
  email: string;
  password: string;
  name: string;
}): Promise<string> {
  if (!isFirebaseConfigured) throw new Error("Firebase is not configured.");

  let app: FirebaseApp | null = null;

  try {
    app = getApps().some((a) => a.name === PROVISIONING_APP_NAME)
      ? getApp(PROVISIONING_APP_NAME)
      : initializeApp(firebaseConfig, PROVISIONING_APP_NAME);

    const auth = getAuth(app);
    await setPersistence(auth, inMemoryPersistence);
    const credential = await createUserWithEmailAndPassword(auth, input.email, input.password);

    await updateProfile(credential.user, { displayName: input.name }).catch(() => {});
    await signOut(auth).catch(() => {});

    return credential.user.uid;
  } catch (err) {
    throw friendlyProvisioningError(err);
  } finally {
    if (app) await deleteApp(app).catch(() => {});
  }
}

export type NewStaffInput = {
  name: string;
  email: string;
  password: string;
  role: StaffRole;
};

/**
 * Adds a staff member: creates their sign-in, then the `staff/{uid}` record
 * that actually grants access. Callable only by an admin — the rules enforce it.
 */
export async function createStaffMember(input: NewStaffInput): Promise<StaffMember> {
  const db = getAdminDb();
  if (!db) throw new Error("The admin portal is not connected to Firebase.");

  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();

  if (!name) throw new Error("Enter the staff member's name.");
  if (name.length > 80) throw new Error("Use a name of 80 characters or fewer.");
  if (!isValidRole(input.role)) throw new Error("Choose a valid role.");

  const passwordIssue = passwordProblem(input.password);
  if (passwordIssue) throw new Error(passwordIssue);

  const uid = await createAuthUserWithoutSwitchingSession({
    email,
    password: input.password,
    name,
  });

  try {
    await setDoc(doc(db, STAFF_COLLECTION, uid), {
      name,
      email,
      role: input.role,
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    // The sign-in exists but carries no access. Say so plainly rather than
    // leaving a half-made account looking successful.
    throw new Error(
      `The sign-in was created but the staff record was not saved (${
        (err as { message?: string })?.message ?? "permission denied"
      }). ${name} cannot get in until an admin retries.`,
    );
  }

  return { uid, name, email, role: input.role, active: true };
}

/**
 * First-run setup: creates the owner's sign-in, signs them in, and writes their
 * admin record — all from the portal, so nothing has to be done by hand in the
 * Firebase console.
 *
 * The security rules allow this exactly once and only for the configured owner
 * verified email: a `staff/{uid}` document may be self-created only after the
 * owner proves access to that inbox.
 * Every other staff account is created by an admin through `createStaffMember`.
 */
export async function bootstrapOwner(input: {
  name: string;
  email: string;
  password: string;
}): Promise<StaffMember> {
  const email = input.email.trim().toLowerCase();

  if (!isOwnerEmail(email)) {
    throw new Error("This email is not the configured owner address for this store.");
  }

  const db = getAdminDb();
  if (!db) throw new Error("The admin portal is not connected to Firebase.");

  const passwordIssue = passwordProblem(input.password);
  if (passwordIssue) throw new Error(passwordIssue);

  const name = input.name.trim() || "Owner";
  if (name.length > 80) throw new Error("Use a name of 80 characters or fewer.");

  // The sign-in may already exist — created in the Firebase console, or by an
  // earlier attempt that stopped before the admin record was written. That is
  // not an error here: we just move on to claiming the record, which still
  // requires the correct password.
  try {
    await createAuthUserWithoutSwitchingSession({ email, password: input.password, name });
  } catch (err) {
    if (!/already exists/i.test((err as { message?: string })?.message ?? "")) throw err;
  }

  return completeOwnerSetup({ email, password: input.password, name });
}

/**
 * Signs the owner in and writes their admin record.
 *
 * Used both by first-run setup and to repair an owner sign-in that exists
 * without a staff record. It is safe to expose: the rules accept a
 * self-created staff record only for the configured owner address, and this
 * still requires that account's password and verification of its email.
 */
export async function completeOwnerSetup(input: {
  email: string;
  password: string;
  name?: string | undefined;
}): Promise<StaffMember> {
  const email = input.email.trim().toLowerCase();

  if (!isOwnerEmail(email)) {
    throw new Error("This email is not the configured owner address for this store.");
  }

  const db = getAdminDb();
  const auth = getAdminAuth();
  if (!db || !auth) throw new Error("The admin portal is not connected to Firebase.");

  // Sign in as the owner, because only their own session may write their record.
  await setPersistence(auth, browserSessionPersistence);

  let uid: string;
  let displayName: string;
  let owner: User;
  try {
    const credential = await signInWithEmailAndPassword(auth, email, input.password);
    owner = credential.user;
    uid = credential.user.uid;
    displayName = input.name?.trim() || credential.user.displayName || "Owner";
  } catch (err) {
    throw new Error(
      `Could not sign in as the owner (${
        (err as { message?: string })?.message ?? "unknown error"
      }). Check the password — if this account already existed, use the password it was created with.`,
    );
  }

  if (!owner.emailVerified) {
    try {
      await sendEmailVerification(owner);
    } finally {
      await signOut(auth);
    }
    throw new Error(
      "Verify your owner email before setup can finish. We sent a verification link to your inbox; open it, then sign in to the staff portal again.",
    );
  }

  // Refresh the token so Firestore sees the verified-email claim.
  await owner.getIdToken(true);

  try {
    await setDoc(doc(db, STAFF_COLLECTION, uid), {
      name: displayName,
      email,
      role: "admin",
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    await signOut(auth).catch(() => {});
    throw new Error(
      `Signed in, but the admin record was refused (${
        (err as { message?: string })?.message ?? "permission denied"
      }). Deploy firestore.rules with ownerEmail() set to ${email}.`,
    );
  }

  return { uid, name: displayName, email, role: "admin", active: true };
}

export async function listStaff(): Promise<StaffMember[]> {
  const db = getAdminDb();
  if (!db) return [];

  const snapshot = await getDocs(collection(db, STAFF_COLLECTION));

  return snapshot.docs
    .map((docSnap) => {
      const data = docSnap.data() as Record<string, unknown>;
      const role = typeof data["role"] === "string" ? data["role"].toLowerCase() : "staff";

      return {
        uid: docSnap.id,
        name: (data["name"] as string) || "Staff",
        email: (data["email"] as string) || "",
        role: (isValidRole(role) ? role : "staff") as StaffRole,
        active: data["active"] !== false,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Turns portal access on or off. Deactivating is how staff are removed. */
export async function setStaffActive(uid: string, active: boolean): Promise<void> {
  const db = getAdminDb();
  if (!db) throw new Error("The admin portal is not connected to Firebase.");

  const currentUid = getAdminAuth()?.currentUser?.uid;
  if (uid === currentUid && !active) {
    throw new Error("You can't deactivate your own account.");
  }

  await updateDoc(doc(db, STAFF_COLLECTION, uid), { active, updatedAt: serverTimestamp() });
}

export async function changeStaffRole(uid: string, role: StaffRole): Promise<void> {
  const db = getAdminDb();
  if (!db) throw new Error("The admin portal is not connected to Firebase.");

  if (!isValidRole(role)) throw new Error("Choose a valid role.");

  const currentUid = getAdminAuth()?.currentUser?.uid;
  if (uid === currentUid && role !== "admin") {
    throw new Error("You can't remove your own admin access.");
  }

  await updateDoc(doc(db, STAFF_COLLECTION, uid), { role, updatedAt: serverTimestamp() });
}

/** Sends a staff member a link to set a new password. */
export async function resetStaffPassword(email: string): Promise<void> {
  const auth = getAdminAuth();
  if (!auth) throw new Error("The admin portal is not connected to Firebase.");

  await sendPasswordResetEmail(auth, email.trim().toLowerCase());
}
