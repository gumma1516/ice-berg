import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { AlertCircle, Eye, EyeOff, IceCreamCone, Lock, Mail, ShieldCheck } from "lucide-react";

import { useAdminAuth } from "@/lib/admin-auth";
import { bootstrapOwner, completeOwnerSetup, getOwnerEmail, isOwnerEmail } from "@/lib/staff-admin";
import { errorMessage } from "@/lib/utils";

/**
 * Guards the whole staff portal.
 *
 * Nothing inside `/admin` renders until Firebase has confirmed a signed-in user
 * who is also authorised as staff. This is a convenience gate for the UI — the
 * data itself is protected by the Firestore rules, which require the same staff
 * identity for every read and write.
 */
export function AdminGate({ children }: { children: ReactNode }) {
  const { staff, authReady, loading, signIn, refresh, resetPassword, isFirebaseConfigured } =
    useAdminAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // First-run: claim the owner account from here instead of the Firebase console.
  const ownerEmail = getOwnerEmail();
  const [setupOpen, setSetupOpen] = useState(false);
  const [ownerName, setOwnerName] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [ownerConfirm, setOwnerConfirm] = useState("");
  const [settingUp, setSettingUp] = useState(false);

  if (!authReady) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f5f3f0]">
        <div className="flex flex-col items-center gap-3">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-[#1a1410] border-t-transparent" />
          <p className="text-sm text-[#1a1410]/60">Checking staff access…</p>
        </div>
      </div>
    );
  }

  if (staff) return <>{children}</>;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (!email.trim() || !password) {
      setError("Enter your staff email and password.");
      return;
    }

    try {
      await signIn(email, password);
    } catch (err) {
      const message = errorMessage(err, "Could not sign in.");

      // The owner's sign-in can exist without an admin record — created in the
      // Firebase console, or by a setup attempt that stopped halfway. Finish
      // the job here instead of sending them back to the console.
      if (isOwnerEmail(email) && message.includes("not authorised")) {
        try {
          await completeOwnerSetup({ email, password });
          await refresh();
          return;
        } catch (setupErr) {
          setError(errorMessage(setupErr, message));
          return;
        }
      }

      setError(message);
    }
  };

  const handleOwnerSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (!ownerEmail) return;

    if (ownerPassword !== ownerConfirm) {
      setError("The two passwords don't match.");
      return;
    }

    setSettingUp(true);
    try {
      await bootstrapOwner({ name: ownerName, email: ownerEmail, password: ownerPassword });
      await refresh();
    } catch (err) {
      setError(errorMessage(err, "Could not set up the owner account."));
    } finally {
      setSettingUp(false);
      setOwnerPassword("");
      setOwnerConfirm("");
    }
  };

  const handleReset = async () => {
    setError(null);
    setNotice(null);
    if (!email.trim()) {
      setError("Enter your staff email first, then request a reset link.");
      return;
    }
    try {
      await resetPassword(email);
      setNotice("Password reset link sent. Check the staff inbox.");
    } catch (err) {
      setError(errorMessage(err, "Could not send the reset link."));
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-[#1a1410] px-5 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent text-accent-foreground">
            <IceCreamCone className="h-6 w-6" />
          </span>
          <h1 className="mt-4 font-display text-2xl font-semibold text-white">Staff Portal</h1>
          <p className="mt-1 text-xs uppercase tracking-[0.25em] text-white/40">Ice Age Creamery</p>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-xl">
          {!isFirebaseConfigured && (
            <div className="mb-4 flex gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Firebase is not configured for this build. Set the <code>VITE_FIREBASE_*</code>{" "}
                environment variables before going live.
              </span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="staff-email" className="text-xs font-semibold text-[#1a1410]">
                Staff email
              </label>
              <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-black/10 bg-[#faf9f7] px-3">
                <Mail className="h-4 w-4 text-black/30" />
                <input
                  id="staff-email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="manager@iceagecreamery.in"
                  className="w-full bg-transparent py-3 text-sm outline-none"
                />
              </div>
            </div>

            <div>
              <label htmlFor="staff-password" className="text-xs font-semibold text-[#1a1410]">
                Password
              </label>
              <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-black/10 bg-[#faf9f7] px-3">
                <Lock className="h-4 w-4 text-black/30" />
                <input
                  id="staff-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-transparent py-3 text-sm outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="text-black/40 transition-colors hover:text-black/70"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="flex gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-700"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {notice && (
              <div className="rounded-xl bg-emerald-50 p-3 text-xs text-emerald-700">{notice}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1a1410] py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Signing in…</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  <span>Sign in to portal</span>
                </>
              )}
            </button>
          </form>

          {ownerEmail && !setupOpen && (
            <button
              type="button"
              onClick={() => {
                setSetupOpen(true);
                setError(null);
                setNotice(null);
              }}
              className="mt-4 w-full rounded-xl border border-dashed border-black/15 py-2.5 text-xs font-semibold text-[#1a1410]/70 transition-colors hover:bg-[#faf9f7]"
            >
              First time here? Set up the owner account
            </button>
          )}

          {ownerEmail && setupOpen && (
            <form
              onSubmit={handleOwnerSetup}
              className="mt-4 space-y-3 border-t border-black/10 pt-4"
            >
              <div>
                <p className="text-xs font-semibold text-[#1a1410]">Create the owner account</p>
                <p className="mt-1 text-[11px] leading-relaxed text-[#1a1410]/60">
                  This works once, only for <strong>{ownerEmail}</strong>. Afterwards the owner adds
                  the rest of the team from inside the portal.
                </p>
              </div>

              <input
                type="text"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="Owner's name"
                autoComplete="name"
                className="w-full rounded-xl border border-black/10 bg-[#faf9f7] px-3 py-2.5 text-sm outline-none"
              />
              <input
                type="password"
                value={ownerPassword}
                onChange={(e) => setOwnerPassword(e.target.value)}
                placeholder="Choose a password (8+ characters)"
                autoComplete="new-password"
                className="w-full rounded-xl border border-black/10 bg-[#faf9f7] px-3 py-2.5 text-sm outline-none"
              />
              <input
                type="password"
                value={ownerConfirm}
                onChange={(e) => setOwnerConfirm(e.target.value)}
                placeholder="Repeat the password"
                autoComplete="new-password"
                className="w-full rounded-xl border border-black/10 bg-[#faf9f7] px-3 py-2.5 text-sm outline-none"
              />

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={settingUp}
                  className="flex-1 rounded-xl bg-accent py-2.5 text-xs font-semibold text-accent-foreground transition hover:opacity-90 disabled:opacity-60"
                >
                  {settingUp ? "Setting up…" : "Create owner account"}
                </button>
                <button
                  type="button"
                  onClick={() => setSetupOpen(false)}
                  className="rounded-xl border border-black/10 px-3 py-2.5 text-xs font-semibold text-[#1a1410]/70"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          <div className="mt-4 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={handleReset}
              className="text-[#1a1410]/60 underline-offset-2 hover:underline"
            >
              Forgot password?
            </button>
            <Link to="/" className="text-[#1a1410]/60 underline-offset-2 hover:underline">
              Back to website
            </Link>
          </div>
        </div>

        <p className="mt-5 text-center text-[11px] leading-relaxed text-white/40">
          Staff accounts are created by the owner inside this portal. Customer accounts cannot
          access it.
        </p>
      </div>
    </div>
  );
}
