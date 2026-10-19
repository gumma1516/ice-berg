import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import {
  Phone,
  MapPin,
  IceCreamCone,
  User,
  Sparkles,
  LogIn,
  Heart,
  ShoppingBag,
} from "lucide-react";
import { PHONE_TEL, PHONE_DISPLAY, MAPS_URL, ADDRESS } from "@/data/menu";
import { useCustomerAuth } from "@/lib/customer-auth";
import { useCart } from "@/lib/cart";

export function Logo() {
  return (
    <Link to="/" className="flex shrink-0 items-center gap-2">
      <span className="grid h-10 w-10 place-items-center rounded-full bg-accent text-lg text-accent-foreground">
        <IceCreamCone className="h-5 w-5" />
      </span>
      <span className="font-display text-lg font-semibold leading-none">
        Ice Age
        <span className="block text-xs font-sans tracking-[0.3em] text-muted-foreground uppercase">
          Creamery
        </span>
      </span>
    </Link>
  );
}

const linkCls = "rounded-full px-4 py-2 text-sm font-medium transition-colors hover:bg-muted";

function CartButton() {
  const { itemCount, ready } = useCart();

  return (
    <Link
      to="/cart"
      aria-label={itemCount > 0 ? `Cart, ${itemCount} items` : "Cart"}
      className="relative inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
    >
      <ShoppingBag className="h-4 w-4" />
      <span className="hidden sm:inline">Cart</span>
      {ready && itemCount > 0 && (
        <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">
          {itemCount}
        </span>
      )}
    </Link>
  );
}

export function Header() {
  const { customer, isLoggedIn } = useCustomerAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const showCustomer = mounted && isLoggedIn && customer;

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-lg">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
        <Logo />

        <nav className="hidden items-center gap-1 md:flex">
          <Link
            to="/"
            className={linkCls}
            activeOptions={{ exact: true }}
            activeProps={{ className: "bg-muted font-semibold" }}
          >
            Home
          </Link>
          <Link
            to="/menu"
            className={linkCls}
            activeProps={{ className: "bg-muted font-semibold" }}
          >
            Menu
          </Link>
          <Link
            to="/visit"
            className={linkCls}
            activeProps={{ className: "bg-muted font-semibold" }}
          >
            Visit
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <CartButton />

          {showCustomer ? (
            <Link
              to="/account"
              className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-berry-soft px-3.5 py-1.5 text-xs font-semibold text-accent transition-all hover:bg-berry-soft/80 hover:scale-105"
            >
              <span className="grid h-5 w-5 place-items-center rounded-full bg-accent text-accent-foreground text-[10px]">
                <User className="h-3 w-3" />
              </span>
              <span className="max-w-[100px] truncate sm:max-w-[140px]">
                {customer.name.split(" ")[0]}
              </span>
              <span className="hidden items-center gap-0.5 rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] sm:inline-flex">
                <Sparkles className="h-2.5 w-2.5" /> {customer.points}p
              </span>
            </Link>
          ) : (
            <div className="flex items-center gap-1.5">
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>Sign In</span>
              </Link>
              <Link
                to="/register"
                className="hidden items-center gap-1 rounded-full bg-accent px-3.5 py-2 text-xs font-semibold text-accent-foreground shadow-soft transition-transform hover:scale-105 sm:inline-flex"
              >
                <Sparkles className="h-3 w-3" />
                <span>Join (+100 Pts)</span>
              </Link>
            </div>
          )}

          <a
            href={PHONE_TEL}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-soft transition-transform hover:scale-105 sm:px-4 sm:py-2.5 sm:text-sm"
          >
            <Phone className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Call to Order</span>
            <span className="sm:hidden">Call</span>
          </a>
        </div>
      </div>

      {/* Mobile nav subbar */}
      <nav className="flex items-center justify-center gap-1 border-t border-border/40 py-1.5 text-xs md:hidden">
        <Link
          to="/"
          className="rounded-full px-3 py-1 font-medium transition-colors hover:bg-muted"
          activeOptions={{ exact: true }}
          activeProps={{ className: "bg-muted font-semibold" }}
        >
          Home
        </Link>
        <Link
          to="/menu"
          className="rounded-full px-3 py-1 font-medium transition-colors hover:bg-muted"
          activeProps={{ className: "bg-muted font-semibold" }}
        >
          Menu
        </Link>
        <Link
          to="/visit"
          className="rounded-full px-3 py-1 font-medium transition-colors hover:bg-muted"
          activeProps={{ className: "bg-muted font-semibold" }}
        >
          Visit
        </Link>
        <Link
          to="/cart"
          className="rounded-full px-3 py-1 font-medium transition-colors hover:bg-muted"
          activeProps={{ className: "bg-muted font-semibold" }}
        >
          Cart
        </Link>
        {showCustomer ? (
          <Link
            to="/account"
            className="rounded-full px-3 py-1 font-medium text-accent hover:bg-muted"
            activeProps={{ className: "bg-berry-soft font-semibold" }}
          >
            My Account
          </Link>
        ) : (
          <>
            <Link
              to="/login"
              className="rounded-full px-3 py-1 font-medium transition-colors hover:bg-muted"
              activeProps={{ className: "bg-muted font-semibold" }}
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="rounded-full px-3 py-1 font-semibold text-accent hover:bg-muted"
              activeProps={{ className: "bg-berry-soft font-semibold" }}
            >
              Register
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}

export function Footer() {
  const { customer, isLoggedIn } = useCustomerAuth();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const showCustomer = mounted && isLoggedIn && customer;

  return (
    <footer className="mt-24 bg-primary text-primary-foreground">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-14 md:grid-cols-3">
        <div>
          <p className="font-display text-3xl">Ice Age Creamery</p>
          <p className="mt-2 text-sm opacity-70">A little scoop of happiness, in Guntur.</p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            {showCustomer ? (
              <Link
                to="/account"
                className="rounded-full bg-white/10 px-3 py-1.5 transition-colors hover:bg-white/20"
              >
                My Loyalty Account →
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="rounded-full bg-white/10 px-3 py-1.5 transition-colors hover:bg-white/20"
                >
                  Customer Login
                </Link>
                <Link
                  to="/register"
                  className="rounded-full bg-accent px-3 py-1.5 text-accent-foreground transition-transform hover:scale-105"
                >
                  Join Club (+100 Pts)
                </Link>
              </>
            )}
          </div>
        </div>
        <a
          href={MAPS_URL}
          target="_blank"
          rel="noreferrer"
          className="flex gap-3 text-sm opacity-90 hover:opacity-100"
        >
          <MapPin className="h-5 w-5 shrink-0 text-caramel" /> {ADDRESS}
        </a>
        <a
          href={PHONE_TEL}
          className="flex items-center gap-3 font-display text-2xl hover:text-caramel"
        >
          <Phone className="h-5 w-5" /> {PHONE_DISPLAY}
        </a>
      </div>
      <div className="mx-auto flex max-w-6xl items-center justify-between border-t border-white/10 px-5 py-6 text-xs opacity-75">
        <p>© {new Date().getFullYear()} Ice Age Creamery. All rights reserved.</p>
        <div className="flex gap-4">
          <Link to="/login" className="hover:underline hover:text-caramel">
            Customer Portal
          </Link>
          <span>•</span>
          <Link to="/admin" rel="nofollow" className="hover:underline hover:text-caramel">
            Staff sign-in
          </Link>
        </div>
      </div>
    </footer>
  );
}

export function MobileActions() {
  const { customer, isLoggedIn } = useCustomerAuth();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const showCustomer = mounted && isLoggedIn && customer;

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 grid grid-cols-3 gap-2 md:hidden">
      <a
        href={PHONE_TEL}
        className="flex items-center justify-center gap-1.5 rounded-full bg-accent py-3 text-xs font-semibold text-accent-foreground shadow-soft"
      >
        <Phone className="h-3.5 w-3.5" /> Call
      </a>
      <a
        href={MAPS_URL}
        target="_blank"
        rel="noreferrer"
        className="flex items-center justify-center gap-1.5 rounded-full bg-primary py-3 text-xs font-semibold text-primary-foreground shadow-soft"
      >
        <MapPin className="h-3.5 w-3.5" /> Map
      </a>
      <Link
        to={showCustomer ? "/account" : "/login"}
        className="flex items-center justify-center gap-1.5 rounded-full bg-caramel py-3 text-xs font-semibold text-foreground shadow-soft"
      >
        <User className="h-3.5 w-3.5" /> {showCustomer ? "Account" : "Sign In"}
      </Link>
    </div>
  );
}
