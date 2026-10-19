import { errorMessage } from "@/lib/utils";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  IceCreamCone,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Sparkles,
  Gift,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useCustomerAuth } from "@/lib/customer-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Customer Login — Ice Age Creamery" },
      {
        name: "description",
        content:
          "Log into your Ice Age Creamery account to view orders, loyalty points, and member specials.",
      },
      { property: "og:title", content: "Sign in to Ice Age Creamery" },
    ],
  }),
  component: LoginPage,
});

function GoogleIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

function LoginPage() {
  const navigate = useNavigate();
  const { customer, login, loginWithGoogle, logout, loading, resetPassword } = useCustomerAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setIsGoogleSubmitting(true);
    try {
      const res = await loginWithGoogle("signin");
      toast.success(`Welcome back, ${res.profile.name}! 🍨`, {
        description: `Signed in with Google. You have ${res.profile.points} Scoop Loyalty Points.`,
      });
      navigate({ to: "/account" });
    } catch (err) {
      const msg = errorMessage(err, "Google sign in failed.");
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setIsGoogleSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!email.trim() || !password) {
      setErrorMsg("Please enter both email and password.");
      return;
    }

    setIsSubmitting(true);
    try {
      const user = await login(email, password, rememberMe);
      toast.success(`Welcome back, ${user.name}! 🍨`, {
        description: `You have ${user.points} Scoop Loyalty Points.`,
      });
      navigate({ to: "/account" });
    } catch (err) {
      const msg = errorMessage(err, "Invalid credentials. Please try again.");
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    setErrorMsg(null);

    if (!email.trim()) {
      setErrorMsg("Enter your email address first, then tap “Forgot?” to get a reset link.");
      return;
    }

    try {
      await resetPassword(email);
      toast.success("Reset link sent", {
        description: `Check ${email.trim()} for a link to set a new password.`,
      });
    } catch (err) {
      const msg = errorMessage(err, "Could not send the reset link.");
      setErrorMsg(msg);
      toast.error(msg);
    }
  };

  // If already logged in, show quick welcome banner with button to account or logout
  if (customer) {
    return (
      <div className="mx-auto max-w-xl px-5 py-16">
        <div className="rounded-3xl border border-border bg-card p-8 text-center shadow-soft animate-rise">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-berry-soft text-accent">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h1 className="font-display text-3xl font-semibold text-foreground">You are logged in</h1>
          <p className="mt-2 text-muted-foreground">
            Signed in as <strong className="text-foreground">{customer.name}</strong> (
            {customer.email})
          </p>

          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-caramel/20 px-4 py-1.5 text-sm font-medium text-caramel">
            <Sparkles className="h-4 w-4" />
            <span>{customer.tier} Member</span>
            <span>•</span>
            <span>{customer.points} Points</span>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              to="/account"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-soft transition-transform hover:scale-105"
            >
              Go to My Account <ArrowRight className="h-4 w-4" />
            </Link>
            <button
              onClick={async () => {
                try {
                  await logout();
                  toast.info("Logged out successfully");
                } catch (err) {
                  toast.error(errorMessage(err, "Could not sign out. Please try again."));
                }
              }}
              className="inline-flex items-center justify-center rounded-full border border-border px-6 py-3 font-medium transition-colors hover:bg-muted"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[85vh] overflow-hidden px-5 py-12 md:py-16">
      {/* Decorative ambient elements */}
      <div className="pointer-events-none absolute -top-10 left-1/2 -z-10 h-72 w-96 -translate-x-1/2 rounded-full bg-berry-soft/60 blur-3xl" />
      <div className="pointer-events-none absolute bottom-10 right-10 -z-10 h-64 w-64 rounded-full bg-caramel/20 blur-3xl" />

      <div className="mx-auto max-w-md">
        {/* Header Branding */}
        <div className="text-center animate-rise">
          <Link to="/" className="inline-flex items-center gap-2 text-center group">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-accent text-accent-foreground shadow-soft transition-transform group-hover:scale-110">
              <IceCreamCone className="h-6 w-6" />
            </span>
          </Link>
          <span className="mt-3 block text-xs font-semibold uppercase tracking-[0.3em] text-accent">
            Customer Portal
          </span>
          <h1 className="mt-1 font-display text-4xl font-semibold text-foreground sm:text-5xl">
            Welcome back.
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to check your orders, redeem rewards, and enjoy member-exclusive scoops.
          </p>
        </div>

        {/* Card Form */}
        <div className="mt-8 rounded-3xl border border-border bg-card/90 p-6 shadow-soft backdrop-blur-md sm:p-8 animate-rise [animation-delay:.1s]">
          {errorMsg && (
            <div
              role="alert"
              className="mb-5 rounded-2xl bg-destructive/10 p-4 text-sm text-destructive"
            >
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="flex-1">
                  <p>{errorMsg}</p>
                  {(errorMsg.includes("Sign Up") ||
                    errorMsg.includes("sign up") ||
                    errorMsg.includes("register")) && (
                    <Link
                      to="/register"
                      className="mt-2 inline-flex items-center gap-1 font-semibold underline hover:opacity-80 text-xs"
                    >
                      Click here to Sign Up with Google (+100 Pts) →
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Google Sign In Option */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isSubmitting || isGoogleSubmitting || loading}
            className="flex w-full items-center justify-center gap-3 rounded-2xl border border-border bg-background/80 py-3 text-sm font-semibold text-foreground shadow-sm transition-all hover:bg-muted hover:border-accent/40 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
          >
            {isGoogleSubmitting ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
                <span>Signing in with Google...</span>
              </>
            ) : (
              <>
                <GoogleIcon className="h-4 w-4 shrink-0" />
                <span>Sign in with Google</span>
              </>
            )}
          </button>

          <div className="relative my-5 text-center text-xs text-muted-foreground">
            <span className="absolute inset-x-0 top-1/2 -z-10 h-px bg-border" />
            <span className="bg-card px-3 text-[11px] font-semibold uppercase tracking-wider">
              or sign in with email
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="login-email"
                className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Email Address
              </label>
              <div className="relative mt-1.5">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="email"
                  autoComplete="email"
                  required
                  id="login-email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-2xl border border-input bg-background/70 py-3 pl-10 pr-4 text-sm text-foreground transition-all placeholder:text-muted-foreground/60 focus:border-accent focus:bg-background focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor="login-password"
                  className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Password
                </label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-xs text-accent hover:underline"
                >
                  Forgot?
                </button>
              </div>
              <div className="relative mt-1.5">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  id="login-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-2xl border border-input bg-background/70 py-3 pl-10 pr-11 text-sm text-foreground transition-all placeholder:text-muted-foreground/60 focus:border-accent focus:bg-background focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-accent focus:ring-accent accent-accent"
                />
                Remember me on this device
              </label>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || isGoogleSubmitting || loading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 font-semibold text-primary-foreground shadow-soft transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Register Prompt */}
          <div className="mt-6 rounded-2xl bg-berry-soft/50 p-4 text-center">
            <p className="text-xs text-muted-foreground">Don't have an Ice Age account yet?</p>
            <Link
              to="/register"
              className="mt-1 inline-flex items-center gap-1.5 font-semibold text-accent hover:underline text-sm"
            >
              <Gift className="h-4 w-4" />
              <span>Create Account (+100 Free Bonus Points)</span>
            </Link>
          </div>
        </div>

        {/* Member Benefits Perks */}
        <div className="mt-8 grid grid-cols-3 gap-3 text-center text-xs text-muted-foreground">
          <div className="rounded-2xl border border-border/60 bg-card/60 p-3">
            <Gift className="mx-auto h-4 w-4 text-accent mb-1" />
            <p className="font-semibold text-foreground">100 Pts</p>
            <p className="text-[10px]">Welcome Bonus</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card/60 p-3">
            <Sparkles className="mx-auto h-4 w-4 text-caramel mb-1" />
            <p className="font-semibold text-foreground">Weekend</p>
            <p className="text-[10px]">Secret Drops</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card/60 p-3">
            <ShieldCheck className="mx-auto h-4 w-4 text-emerald-600 mb-1" />
            <p className="font-semibold text-foreground">Fast Track</p>
            <p className="text-[10px]">Instant Counter</p>
          </div>
        </div>
      </div>
    </div>
  );
}
