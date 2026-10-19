import { errorMessage } from "@/lib/utils";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  IceCreamCone,
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  Phone,
  ArrowRight,
  Sparkles,
  Gift,
  CheckCircle2,
  AlertCircle,
  Heart,
} from "lucide-react";
import { useCustomerAuth } from "@/lib/customer-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Customer Registration — Ice Age Creamery" },
      {
        name: "description",
        content:
          "Register for an Ice Age Creamery account to get 100 free welcome points, secret weekend cake drops, and effortless orders.",
      },
      { property: "og:title", content: "Join Ice Age Creamery Club" },
    ],
  }),
  component: RegisterPage,
});

const POPULAR_FLAVORS = [
  "San Sebastian Cheesecake — Chocolate",
  "Mango Chocolate Sundae",
  "Matilda Cake",
  "Belgian Chocolate Waffle",
  "Nutella Waffle Sundae",
  "Lotus Biscoff Thick Shake",
  "Ferrero Rocher Happiness Jar",
  "Berry Blast Stone Dessert",
];

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

function RegisterPage() {
  const navigate = useNavigate();
  const { customer, register, loginWithGoogle, logout, loading } = useCustomerAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [favoriteFlavor, setFavoriteFlavor] = useState(POPULAR_FLAVORS[0]);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);

  const handleGoogleSignUp = async () => {
    setErrorMsg(null);
    setIsGoogleSubmitting(true);
    try {
      const res = await loginWithGoogle("signup");
      toast.success(`Welcome to the family, ${res.profile.name}! 🎉`, {
        description: res.isNewUser
          ? "Account created & 100 welcome points added to your account!"
          : "Logged in via Google. Your points are ready!",
      });
      navigate({ to: "/account" });
    } catch (err) {
      const msg = errorMessage(err, "Google registration failed.");
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setIsGoogleSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!name.trim()) {
      setErrorMsg("Please enter your full name.");
      return;
    }
    if (!/^(?:91)?[6-9]\d{9}$/.test(phone.replace(/\D/g, ""))) {
      setErrorMsg("Please enter a valid phone number (e.g. +91 98480 12345).");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setErrorMsg("Password must be at least 6 characters long.");
      return;
    }

    setIsSubmitting(true);
    try {
      const user = await register({
        name,
        email,
        phone,
        password,
        favoriteFlavor,
      });

      toast.success(`Welcome to the family, ${user.name}! 🎉`, {
        description: "Your account is ready and 100 Scoop Points are credited!",
      });

      navigate({ to: "/account" });
    } catch (err) {
      const msg = errorMessage(err, "Failed to create account. Please try again.");
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // If already logged in
  if (customer) {
    return (
      <div className="mx-auto max-w-xl px-5 py-16">
        <div className="rounded-3xl border border-border bg-card p-8 text-center shadow-soft animate-rise">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-berry-soft text-accent">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h1 className="font-display text-3xl font-semibold text-foreground">
            You already have an active session
          </h1>
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
                  toast.info("Signed out to create a new account.");
                } catch (err) {
                  toast.error(errorMessage(err, "Could not sign out. Please try again."));
                }
              }}
              className="inline-flex items-center justify-center rounded-full border border-border px-6 py-3 font-medium transition-colors hover:bg-muted"
            >
              Sign out & Register new
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[90vh] overflow-hidden px-5 py-12 md:py-16">
      {/* Ambient background glows */}
      <div className="pointer-events-none absolute -top-10 right-1/4 -z-10 h-80 w-96 rounded-full bg-berry-soft/60 blur-3xl" />
      <div className="pointer-events-none absolute bottom-10 left-10 -z-10 h-72 w-72 rounded-full bg-caramel/20 blur-3xl" />

      <div className="mx-auto max-w-lg">
        {/* Header */}
        <div className="text-center animate-rise">
          <Link
            to="/"
            aria-label="Ice Age Creamery home"
            className="inline-flex items-center gap-2 group"
          >
            <span className="grid h-12 w-12 place-items-center rounded-full bg-accent text-accent-foreground shadow-soft transition-transform group-hover:scale-110">
              <IceCreamCone className="h-6 w-6" />
            </span>
          </Link>
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-berry-soft px-3.5 py-1 text-xs font-semibold text-accent">
            <Gift className="h-3.5 w-3.5" />
            <span>Get 100 Free Welcome Points</span>
          </div>
          <h1 className="mt-2 font-display text-4xl font-semibold text-foreground sm:text-5xl">
            Join the Creamery Club.
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign up in seconds to unlock member-only prices, secret weekend dessert drops, and earn
            points on every scoop in Guntur.
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
                  {(errorMsg.includes("already registered") ||
                    errorMsg.includes("already exists") ||
                    errorMsg.includes("sign in")) && (
                    <Link
                      to="/login"
                      className="mt-2 inline-flex items-center gap-1 font-semibold underline hover:opacity-80 text-xs"
                    >
                      Click here to Sign In on the Login page →
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Google Sign Up Option */}
          <button
            type="button"
            onClick={handleGoogleSignUp}
            disabled={isSubmitting || isGoogleSubmitting || loading}
            className="flex w-full items-center justify-center gap-3 rounded-2xl border border-border bg-background/80 py-3 text-sm font-semibold text-foreground shadow-sm transition-all hover:bg-muted hover:border-accent/40 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
          >
            {isGoogleSubmitting ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
                <span>Connecting to Google...</span>
              </>
            ) : (
              <>
                <GoogleIcon className="h-4 w-4 shrink-0" />
                <span>Sign up with Google</span>
                <span className="ml-1 rounded-full bg-berry-soft px-2 py-0.5 text-[10px] font-semibold text-accent">
                  +100 Pts
                </span>
              </>
            )}
          </button>

          <div className="relative my-5 text-center text-xs text-muted-foreground">
            <span className="absolute inset-x-0 top-1/2 -z-10 h-px bg-border" />
            <span className="bg-card px-3 text-[11px] font-semibold uppercase tracking-wider">
              or register with email
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="register-name"
                className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Full Name
              </label>
              <div className="relative mt-1.5">
                <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  required
                  id="register-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ananya Reddy"
                  className="w-full rounded-2xl border border-input bg-background/70 py-3 pl-10 pr-4 text-sm text-foreground transition-all placeholder:text-muted-foreground/60 focus:border-accent focus:bg-background focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="register-phone"
                  className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Phone Number
                </label>
                <div className="relative mt-1.5">
                  <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="tel"
                    autoComplete="tel"
                    required
                    id="register-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full rounded-2xl border border-input bg-background/70 py-3 pl-10 pr-4 text-sm text-foreground transition-all placeholder:text-muted-foreground/60 focus:border-accent focus:bg-background focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="register-email"
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
                    id="register-email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ananya@example.com"
                    className="w-full rounded-2xl border border-input bg-background/70 py-3 pl-10 pr-4 text-sm text-foreground transition-all placeholder:text-muted-foreground/60 focus:border-accent focus:bg-background focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>
              </div>
            </div>

            <div>
              <label
                htmlFor="register-password"
                className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Password (min 6 characters)
              </label>
              <div className="relative mt-1.5">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  id="register-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a secure password"
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

            <div>
              <label
                htmlFor="register-favoriteFlavor"
                className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Favorite Dessert / Ice Cream Flavor
              </label>
              <div className="relative mt-1.5">
                <Heart className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-accent" />
                <select
                  id="register-favoriteFlavor"
                  value={favoriteFlavor}
                  onChange={(e) => setFavoriteFlavor(e.target.value)}
                  className="w-full rounded-2xl border border-input bg-background/70 py-3 pl-10 pr-4 text-sm text-foreground transition-all focus:border-accent focus:bg-background focus:outline-none focus:ring-2 focus:ring-accent/20"
                >
                  {POPULAR_FLAVORS.map((flavor) => (
                    <option key={flavor} value={flavor}>
                      {flavor}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || isGoogleSubmitting || loading}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 font-semibold text-primary-foreground shadow-soft transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  <span>Creating Your Account...</span>
                </>
              ) : (
                <>
                  <span>Create Account (+100 Points)</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Login prompt */}
          <div className="mt-6 border-t border-border pt-4 text-center">
            <p className="text-xs text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="font-semibold text-accent hover:underline">
                Sign in here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
