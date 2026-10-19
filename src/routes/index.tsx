import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, MapPin, Sparkles } from "lucide-react";
import hero from "@/assets/hero-sundae.jpg";
import cheesecake from "@/assets/cheesecake.jpg";
import matilda from "@/assets/matilda.jpg";
import waffle from "@/assets/waffle-shake.jpg";
import { MAPS_URL, weekendMenu } from "@/data/menu";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ice Age Creamery — Premium Dessert Café in Guntur" },
      {
        name: "description",
        content:
          "Ice creams, Belgian waffles, shakes, San Sebastian cheesecakes and Matilda cakes at Ice Age Creamery, Krishna Nagar, Guntur.",
      },
      { property: "og:title", content: "Ice Age Creamery — A Little Scoop of Happiness" },
      {
        property: "og:description",
        content:
          "Premium dessert café in Krishna Nagar, Guntur. Weekend specials, waffles, shakes and sundaes.",
      },
    ],
  }),
  component: Index,
});

const price = (n: string) => weekendMenu.items.find((i) => i.name === n)?.price;

const specials = [
  { img: hero, name: "Mango Chocolate Sundae", tag: "Seasonal", tone: "bg-caramel/30" },
  {
    img: cheesecake,
    name: "San Sebastian Cheesecake — Chocolate",
    tag: "Weekend only",
    tone: "bg-berry-soft",
  },
  { img: matilda, name: "Matilda Cake", tag: "Fan favourite", tone: "bg-secondary" },
];

const Sprinkle = ({ className }: { className: string }) => (
  <span className={`absolute h-2 w-6 rounded-full animate-float ${className}`} />
);

function Index() {
  return (
    <>
      <section className="relative overflow-hidden">
        <Sprinkle className="left-[8%] top-16 bg-accent" />
        <Sprinkle className="right-[45%] top-24 bg-secondary [animation-delay:1s]" />
        <Sprinkle className="left-[40%] bottom-16 bg-caramel [animation-delay:2s]" />
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-10 md:grid-cols-2 md:pt-20">
          <div className="animate-rise">
            <p className="inline-flex items-center gap-2 rounded-full bg-berry-soft px-4 py-1.5 text-sm font-medium text-accent">
              <Sparkles className="h-4 w-4" /> Krishna Nagar, Guntur
            </p>
            <h1 className="mt-6 text-5xl font-semibold leading-[0.95] sm:text-7xl">
              A little scoop of <em className="text-accent">happiness.</em>
            </h1>
            <p className="mt-6 max-w-md text-lg text-muted-foreground">
              Belgian waffles, thick shakes, sundaes and weekend-only cakes — made to be shared (or
              not).
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/menu"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3.5 font-semibold text-primary-foreground shadow-soft transition-transform hover:scale-105"
              >
                Explore the menu <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href={MAPS_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border-2 border-primary px-6 py-3 font-semibold transition-colors hover:bg-primary hover:text-primary-foreground"
              >
                <MapPin className="h-4 w-4" /> Directions
              </a>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-md animate-rise [animation-delay:.15s]">
            <div className="absolute -inset-4 blob bg-secondary" />
            <img
              src={hero}
              alt="Mango chocolate sundae"
              width={1024}
              height={1280}
              className="relative blob aspect-[4/5] w-full object-cover shadow-soft"
            />
            <div className="absolute -left-4 bottom-10 rotate-[-6deg] rounded-2xl bg-card px-4 py-3 shadow-soft animate-float">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                This weekend
              </p>
              <p className="font-display text-lg">Mango Choco Sundae</p>
            </div>
            <span className="absolute -right-2 top-6 h-12 w-12 rounded-full bg-accent animate-float [animation-delay:1.5s]" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-accent">
              Weekend Collection
            </p>
            <h2 className="mt-2 text-4xl font-semibold sm:text-5xl">Only on Saturdays & Sundays</h2>
          </div>
          <Link
            to="/menu"
            className="inline-flex items-center gap-1 font-semibold text-accent hover:gap-2 transition-all"
          >
            See all {weekendMenu.items.length} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {specials.map((s, i) => (
            <article
              key={s.name}
              className={`group overflow-hidden rounded-3xl ${s.tone} p-3 transition-transform hover:-translate-y-2 animate-rise`}
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <div className="overflow-hidden rounded-2xl">
                <img
                  src={s.img}
                  alt={s.name}
                  loading="lazy"
                  width={1024}
                  height={1024}
                  className="aspect-square w-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
              </div>
              <div className="flex items-start justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    {s.tag}
                  </p>
                  <h3 className="mt-1 text-xl font-semibold">{s.name}</h3>
                </div>
                <span className="shrink-0 rounded-full bg-card px-3 py-1 font-semibold">
                  ₹{price(s.name)}
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-10">
        <div className="grid items-center gap-8 overflow-hidden rounded-[2.5rem] bg-primary p-6 text-primary-foreground md:grid-cols-2 md:p-12">
          <div>
            <h2 className="text-4xl font-semibold sm:text-5xl">
              Waffles, shakes & happiness jars.
            </h2>
            <p className="mt-4 opacity-75">
              Eight categories, from Belgian waffles and stone desserts to lava shorts and
              mocktails.
            </p>
            <Link
              to="/menu"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3.5 font-semibold text-accent-foreground transition-transform hover:scale-105"
            >
              Browse the full menu <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <img
            src={waffle}
            alt="Belgian waffle with ice cream and strawberry shake"
            loading="lazy"
            width={1024}
            height={1024}
            className="rounded-3xl object-cover"
          />
        </div>
      </section>
    </>
  );
}
