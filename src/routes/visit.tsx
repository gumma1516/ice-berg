import { createFileRoute } from "@tanstack/react-router";
import { MapPin, Phone } from "lucide-react";
import { ADDRESS, MAPS_URL, MAP_EMBED, PHONE_DISPLAY, PHONE_TEL } from "@/data/menu";

export const Route = createFileRoute("/visit")({
  head: () => ({
    meta: [
      { title: "Visit Ice Age Creamery — Krishna Nagar, Guntur" },
      {
        name: "description",
        content:
          "Find Ice Age Creamery beside Paradise, Krishna Nagar Main Rd, Guntur. Call 073966 63154 or get directions.",
      },
      { property: "og:title", content: "Visit Ice Age Creamery" },
      { property: "og:description", content: "Your next dessert stop in Krishna Nagar, Guntur." },
    ],
  }),
  component: Visit,
});

function Visit() {
  return (
    <div className="mx-auto max-w-6xl px-5 pt-12">
      <p className="text-sm font-semibold uppercase tracking-[0.3em] text-accent">Visit us</p>
      <h1 className="mt-2 text-5xl font-semibold sm:text-6xl">Your next dessert stop.</h1>
      <div className="mt-10 grid gap-6 md:grid-cols-[1fr_1.4fr]">
        <div className="space-y-4">
          <a
            href={MAPS_URL}
            target="_blank"
            rel="noreferrer"
            className="block rounded-3xl bg-secondary p-6 transition-transform hover:-translate-y-1"
          >
            <MapPin className="h-6 w-6" />
            <p className="mt-4 font-semibold">{ADDRESS}</p>
            <p className="mt-4 font-display text-xl text-accent">Get directions →</p>
          </a>
          <a
            href={PHONE_TEL}
            className="block rounded-3xl bg-berry-soft p-6 transition-transform hover:-translate-y-1"
          >
            <Phone className="h-6 w-6" />
            <p className="mt-4 font-display text-3xl">{PHONE_DISPLAY}</p>
            <p className="mt-2 text-muted-foreground">Tap to call & order</p>
          </a>
        </div>
        <iframe
          title="Ice Age Creamery map"
          src={MAP_EMBED}
          loading="lazy"
          className="min-h-[360px] w-full rounded-3xl border-0 shadow-soft"
        />
      </div>
    </div>
  );
}
