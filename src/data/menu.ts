import { storeWeekday } from "@/lib/store-time";

// Edit prices and items here. Verify against the printed menu before publishing.
export const PHONE_DISPLAY = "073966 63154";
export const PHONE_TEL = "tel:+917396663154";
export const ADDRESS =
  "Krishna Nagar Main Rd, Beside Paradise, Brundavan Gardens, 1, St Line, Krishna Nagar, Guntur, Andhra Pradesh 522006";
export const MAPS_URL =
  "https://www.google.com/maps/dir/?api=1&destination=" +
  encodeURIComponent("Ice Age Creamery, Krishna Nagar Main Rd, Guntur 522006");
export const MAP_EMBED =
  "https://www.google.com/maps?q=" +
  encodeURIComponent("Ice Age Creamery Krishna Nagar Guntur") +
  "&output=embed";

export type MenuItem = { name: string; price: number; note?: string };
export type MenuCategory = { id: string; title: string; items: MenuItem[] };

export const weekendMenu: MenuCategory = {
  id: "weekend",
  title: "Weekend Desserts",
  items: [
    {
      name: "Mango Chocolate Sundae",
      price: 249,
      note: "Seasonal mango, chocolate ice cream, fudge",
    },
    { name: "San Sebastian Cheesecake — Classic", price: 229 },
    { name: "San Sebastian Cheesecake — Chocolate", price: 249 },
    { name: "San Sebastian Cheesecake — Biscoff", price: 269 },
    { name: "Bomboloni", price: 149, note: "Filled Italian doughnut" },
    { name: "Matilda Cake", price: 199, note: "Dense, fudgy chocolate layers" },
    { name: "Chocolate Feuilletine Crunch Cake", price: 219 },
    { name: "Magnum Cake", price: 229 },
    { name: "Matilda Cup", price: 149 },
    { name: "Viral Scoop Cookie with Ice Cream", price: 179 },
    { name: "Mango Matilda Cake", price: 229 },
    { name: "Tres Leches — Classic", price: 189 },
    { name: "Tres Leches — Chocolate", price: 209 },
  ],
};

export const mainMenu: MenuCategory[] = [
  {
    id: "waffles",
    title: "Belgian Waffles",
    items: [
      { name: "Classic Honey Butter", price: 129 },
      { name: "Dark Chocolate", price: 159 },
      { name: "Nutella", price: 189 },
      { name: "Lotus Biscoff", price: 199 },
    ],
  },
  {
    id: "waffle-sundaes",
    title: "Waffle Sundaes",
    items: [
      { name: "Choco Brownie Waffle Sundae", price: 219 },
      { name: "Red Velvet Waffle Sundae", price: 229 },
      { name: "Nutella Overload", price: 249 },
    ],
  },
  {
    id: "shakes",
    title: "Shakes",
    items: [
      { name: "Classic Vanilla", price: 129 },
      { name: "Strawberry", price: 139 },
      { name: "Belgian Chocolate", price: 159 },
      { name: "Oreo Cookie Crumble", price: 169 },
      { name: "KitKat", price: 179 },
    ],
  },
  {
    id: "sundaes",
    title: "Sundaes",
    items: [
      { name: "Hot Chocolate Fudge", price: 169 },
      { name: "Brownie Sundae", price: 199 },
      { name: "Death by Chocolate", price: 229 },
    ],
  },
  {
    id: "stone",
    title: "Stone Desserts",
    items: [
      { name: "Choco Brownie Stone", price: 189 },
      { name: "Mango Cream Stone", price: 179 },
      { name: "Dry Fruit Delight", price: 199 },
    ],
  },
  {
    id: "lava",
    title: "Lava Shorts",
    items: [
      { name: "Choco Lava Short", price: 129 },
      { name: "Lava with Ice Cream", price: 159 },
    ],
  },
  {
    id: "mocktails",
    title: "Refreshing Mocktails",
    items: [
      { name: "Blue Lagoon", price: 119 },
      { name: "Virgin Mojito", price: 119 },
      { name: "Watermelon Cooler", price: 129 },
    ],
  },
  {
    id: "jars",
    title: "Happiness Jars",
    items: [
      { name: "Chocolate Brownie Jar", price: 179 },
      { name: "Red Velvet Jar", price: 189 },
      { name: "Biscoff Jar", price: 199 },
    ],
  },
];

// ── Catalog lookups ───────────────────────────────────────────────
// The cart and the staff price check both resolve items through these, so a
// price only ever comes from this file — never from the customer's browser.

export const ALL_CATEGORIES: MenuCategory[] = [weekendMenu, ...mainMenu];

export type CatalogItem = MenuItem & {
  /** Stable identifier: `<categoryId>:<name>`. */
  sku: string;
  categoryId: string;
  categoryTitle: string;
};

export const CATALOG: CatalogItem[] = ALL_CATEGORIES.flatMap((cat) =>
  cat.items.map((item) => ({
    ...item,
    sku: `${cat.id}:${item.name}`,
    categoryId: cat.id,
    categoryTitle: cat.title,
  })),
);

const bySku = new Map(CATALOG.map((item) => [item.sku, item]));
const byName = new Map(CATALOG.map((item) => [item.name.toLowerCase(), item]));

export function findCatalogItem(sku: string): CatalogItem | undefined {
  return bySku.get(sku);
}

/** Fallback for counter orders, which are keyed by the printed item name. */
export function findCatalogItemByName(name: string): CatalogItem | undefined {
  return byName.get(name.trim().toLowerCase());
}

/** Weekend-only items are not orderable Monday to Friday. */
export function isAvailableToday(item: CatalogItem, now = new Date()): boolean {
  if (item.categoryId !== weekendMenu.id) return true;
  const day = storeWeekday(now);
  return day === "Sun" || day === "Sat";
}
