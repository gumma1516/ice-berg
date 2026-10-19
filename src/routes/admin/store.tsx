import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Store,
  UtensilsCrossed,
  Clock,
  Sparkles,
  Save,
  Plus,
  Trash2,
  Edit2,
  Search,
  CheckCircle2,
  AlertTriangle,
  Megaphone,
  Percent,
  X,
  Phone,
  MapPin,
  Database,
  Cloud,
  Server,
  Zap,
} from "lucide-react";
import { mainMenu, weekendMenu, ADDRESS, PHONE_DISPLAY, PHONE_TEL, MAPS_URL } from "@/data/menu";
import {
  firebaseConfig,
  isFirebaseConfigured,
  firebaseProjectId,
  testFirebaseConnection,
  saveStoreSettingsToFirestore,
  getStoreSettingsFromFirestore,
} from "@/lib/firebase";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/store")({
  head: () => ({
    meta: [{ title: "Store Customization — Ice Age Admin" }],
  }),
  component: AdminStorePage,
});

const STORE_TABS = [
  { id: "menu", label: "Menu & Pricing Catalog", icon: UtensilsCrossed },
  { id: "info", label: "Store Info & Contact", icon: Store },
  { id: "promo", label: "Announcements & Promos", icon: Megaphone },
  { id: "timings", label: "Hours & Schedules", icon: Clock },
  { id: "firebase", label: "Firebase & Cloud", icon: Database },
] as const;

type StoreTabId = (typeof STORE_TABS)[number]["id"];

type EditableItem = {
  id: string;
  name: string;
  price: number;
  category: string;
  desc?: string | undefined;
  available: boolean;
  tag?: string | undefined;
};

const initialItems: EditableItem[] = [
  ...weekendMenu.items.map((i, idx) => ({
    id: `wm-${idx}`,
    name: i.name,
    price: i.price,
    category: weekendMenu.title,
    desc: i.note,
    available: true,
    tag: "Weekend Special",
  })),
  ...mainMenu.flatMap((cat, catIdx) =>
    cat.items.map((i, iIdx) => ({
      id: `m-${catIdx}-${iIdx}`,
      name: i.name,
      price: i.price,
      category: cat.title,
      desc: i.note,
      available: true,
      tag: undefined as string | undefined,
    })),
  ),
];

function AdminStorePage() {
  const [activeTab, setActiveTab] = useState<StoreTabId>("menu");

  // Menu State
  const [items, setItems] = useState<EditableItem[]>(initialItems);
  const [menuSearch, setMenuSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EditableItem | null>(null);

  // New Item Fields
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemCategory, setNewItemCategory] = useState(mainMenu[0]?.title || "Belgian Waffles");
  const [newItemDesc, setNewItemDesc] = useState("");
  const [newItemTag, setNewItemTag] = useState("");

  // Store Info State
  const [storeName, setStoreName] = useState("Ice Age Creamery");
  const [tagline, setTagline] = useState("A little scoop of happiness, in Guntur.");
  const [phone, setPhone] = useState(PHONE_DISPLAY);
  const [address, setAddress] = useState(ADDRESS);
  const [mapsUrl, setMapsUrl] = useState(MAPS_URL);
  const [storeStatus, setStoreStatus] = useState<"open" | "busy" | "closed">("open");

  // Announcements & Promo State (Zero preloaded dummy data)
  const [bannerActive, setBannerActive] = useState(false);
  const [bannerText, setBannerText] = useState("");
  const [promos, setPromos] = useState<Array<{ code: string; discount: string; active: boolean }>>(
    [],
  );
  const [isAddCouponOpen, setIsAddCouponOpen] = useState(false);
  const [newCouponCode, setNewCouponCode] = useState("");
  const [newCouponDiscount, setNewCouponDiscount] = useState("");

  // Timings State
  const [timings, setTimings] = useState({
    weekdayOpen: "11:00 AM",
    weekdayClose: "10:30 PM",
    weekendOpen: "11:00 AM",
    weekendClose: "11:00 PM",
  });

  // Load real store settings from Firestore on mount
  useEffect(() => {
    if (isFirebaseConfigured) {
      getStoreSettingsFromFirestore()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .then((data: any) => {
          if (data) {
            if (data.storeName) setStoreName(data.storeName);
            if (data.tagline) setTagline(data.tagline);
            if (data.phone) setPhone(data.phone);
            if (data.address) setAddress(data.address);
            if (data.mapsUrl) setMapsUrl(data.mapsUrl);
            if (data.storeStatus) setStoreStatus(data.storeStatus);
            if (data.bannerText !== undefined) setBannerText(data.bannerText);
            if (data.bannerActive !== undefined) setBannerActive(data.bannerActive);
            if (Array.isArray(data.promos)) setPromos(data.promos);
            if (data.timings) setTimings(data.timings);
          }
        })
        .catch((e) => console.warn("Failed to load store settings:", e));
    }
  }, []);

  // Firebase Live Test State
  const [isTestingFirebase, setIsTestingFirebase] = useState(false);
  const [firebasePingResult, setFirebasePingResult] = useState<{
    tested: boolean;
    success: boolean;
    latencyMs: number;
    docCount: number;
    message: string;
  } | null>(null);

  const handleRunFirebaseTest = async () => {
    setIsTestingFirebase(true);
    toast.info("Connecting to Google Cloud Firestore...");
    const res = await testFirebaseConnection();
    setIsTestingFirebase(false);
    setFirebasePingResult({ tested: true, ...res });
    if (res.success) {
      toast.success(
        `Connected to ${firebaseProjectId}! (${res.latencyMs}ms ping, ${res.docCount} orders in cloud)`,
      );
    } else {
      toast.error(`Connection check failed: ${res.message}`);
    }
  };

  const categories = ["all", weekendMenu.title, ...mainMenu.map((c) => c.title)];

  const filteredItems = items.filter((item) => {
    const matchQuery =
      item.name.toLowerCase().includes(menuSearch.toLowerCase()) ||
      (item.desc && item.desc.toLowerCase().includes(menuSearch.toLowerCase()));
    const matchCategory = selectedCategory === "all" || item.category === selectedCategory;
    return matchQuery && matchCategory;
  });

  const toggleItemAvailability = (id: string) => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.id === id) {
          const nextVal = !i.available;
          toast.info(`${i.name} marked as ${nextVal ? "In Stock" : "Sold Out"}`);
          return { ...i, available: nextVal };
        }
        return i;
      }),
    );
  };

  const handleSavePrice = (id: string, newPrice: number) => {
    if (isNaN(newPrice) || newPrice <= 0) return;
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, price: newPrice } : i)));
    toast.success("Price updated successfully!");
  };

  const handleAddNewItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !newItemPrice) {
      toast.error("Please provide both item name and price");
      return;
    }

    const created: EditableItem = {
      id: `custom-${Date.now()}`,
      name: newItemName.trim(),
      price: parseInt(newItemPrice, 10),
      category: newItemCategory,
      desc: newItemDesc.trim() || undefined,
      tag: newItemTag.trim() || undefined,
      available: true,
    };

    setItems([created, ...items]);
    setIsAddItemOpen(false);
    setNewItemName("");
    setNewItemPrice("");
    setNewItemDesc("");
    setNewItemTag("");
    toast.success(`"${created.name}" added to menu catalog!`);
  };

  const handleDeleteItem = (id: string, name: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    toast.success(`"${name}" removed from menu.`);
  };

  const handleSaveStoreInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isFirebaseConfigured) {
        await saveStoreSettingsToFirestore({
          storeName,
          tagline,
          phone,
          address,
          mapsUrl,
          storeStatus,
        });
      }
      toast.success("Store details saved to Firebase & local storage!");
    } catch {
      toast.error("Failed to save to cloud Firestore.");
    }
  };

  const handleSaveTimings = async () => {
    try {
      if (isFirebaseConfigured) {
        await saveStoreSettingsToFirestore({ timings });
      }
      toast.success("Operating hours saved to Firebase!");
    } catch {
      toast.error("Failed to save timings to Firestore.");
    }
  };

  const handleSaveBanner = async () => {
    try {
      if (isFirebaseConfigured) {
        await saveStoreSettingsToFirestore({ bannerActive, bannerText });
      }
      toast.success("Announcement banner updated in Firebase!");
    } catch {
      toast.error("Failed to save banner to Firestore.");
    }
  };

  const handleAddCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCouponCode.trim() || !newCouponDiscount.trim()) {
      toast.error("Please provide both coupon code and discount");
      return;
    }
    const updated = [
      ...promos,
      {
        code: newCouponCode.trim().toUpperCase(),
        discount: newCouponDiscount.trim(),
        active: true,
      },
    ];
    setPromos(updated);
    setIsAddCouponOpen(false);
    setNewCouponCode("");
    setNewCouponDiscount("");
    if (isFirebaseConfigured) {
      await saveStoreSettingsToFirestore({ promos: updated });
    }
    toast.success(`Coupon ${newCouponCode.toUpperCase()} added to Firebase!`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-display text-2xl font-bold">Store Customization</h2>
          <p className="text-xs text-muted-foreground">
            Configure live menu offerings, pricing, operating schedules, banners, and store metadata
          </p>
        </div>

        {/* Live Status Pill */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Store Status:</span>
          <select
            value={storeStatus}
            onChange={(e) => {
              const val = e.target.value as "open" | "busy" | "closed";
              setStoreStatus(val);
              toast.success(`Store status changed to ${val.toUpperCase()}`);
            }}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold uppercase tracking-wider outline-none cursor-pointer ${
              storeStatus === "open"
                ? "bg-emerald-100 text-emerald-800"
                : storeStatus === "busy"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-red-100 text-red-800"
            }`}
          >
            <option value="open">🟢 Open (Normal)</option>
            <option value="busy">🟡 Busy (High Wait)</option>
            <option value="closed">🔴 Closed</option>
          </select>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex overflow-x-auto border-b border-border">
        {STORE_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex shrink-0 items-center gap-2 border-b-2 px-5 py-3 text-sm font-medium transition ${
                activeTab === tab.id
                  ? "border-accent text-accent font-semibold"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ──────────────────────────────────────────────────────────
          TAB 1: MENU & PRICING
      ────────────────────────────────────────────────────────── */}
      {activeTab === "menu" && (
        <div className="space-y-5">
          {/* Controls Bar */}
          <div className="flex flex-col gap-3 rounded-2xl border border-black/5 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search dish by name, chocolate, waffles, sundae..."
                value={menuSearch}
                onChange={(e) => setMenuSearch(e.target.value)}
                className="w-full rounded-xl border border-border bg-[#faf9f8] py-2 pl-9 pr-4 text-sm outline-none transition focus:border-accent focus:bg-white"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="rounded-xl border border-border bg-[#faf9f8] px-3 py-2 text-xs font-medium outline-none transition focus:border-accent"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c === "all" ? "All Categories" : c}
                  </option>
                ))}
              </select>

              <button
                onClick={() => setIsAddItemOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground shadow-sm transition hover:opacity-90"
              >
                <Plus className="h-4 w-4" /> Add New Dessert
              </button>
            </div>
          </div>

          {/* Menu Catalog Table */}
          <div className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-[#faf9f8] text-xs font-semibold uppercase text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3.5">Delight & Category</th>
                    <th className="px-5 py-3.5">Description</th>
                    <th className="px-5 py-3.5">Price (₹)</th>
                    <th className="px-5 py-3.5">Availability</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-muted-foreground">
                        No dishes match your filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => (
                      <tr key={item.id} className="transition hover:bg-[#faf9f8]/60">
                        {/* Name & Tag */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">{item.name}</span>
                            {item.tag && (
                              <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-bold text-accent">
                                {item.tag}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">{item.category}</span>
                        </td>

                        {/* Description */}
                        <td className="px-5 py-3.5">
                          <p className="max-w-xs truncate text-xs text-muted-foreground">
                            {item.desc || "—"}
                          </p>
                        </td>

                        {/* Price with quick inline edit */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-display text-xs text-muted-foreground">₹</span>
                            <input
                              type="number"
                              defaultValue={item.price}
                              onBlur={(e) => handleSavePrice(item.id, parseInt(e.target.value, 10))}
                              className="w-20 rounded-lg border border-border bg-[#faf9f8] px-2 py-1 text-xs font-bold text-foreground outline-none transition focus:border-accent focus:bg-white"
                            />
                          </div>
                        </td>

                        {/* In Stock toggle */}
                        <td className="px-5 py-3.5">
                          <button
                            onClick={() => toggleItemAvailability(item.id)}
                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition ${
                              item.available
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-gray-100 text-gray-500 line-through"
                            }`}
                          >
                            <span
                              className={`h-2 w-2 rounded-full ${
                                item.available ? "bg-emerald-500" : "bg-gray-400"
                              }`}
                            />
                            {item.available ? "In Stock" : "Sold Out"}
                          </button>
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-3.5 text-right">
                          <button
                            onClick={() => handleDeleteItem(item.id, item.name)}
                            title="Delete Item"
                            className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────
          TAB 2: STORE INFO & CONTACT
      ────────────────────────────────────────────────────────── */}
      {activeTab === "info" && (
        <form onSubmit={handleSaveStoreInfo} className="space-y-6">
          <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm space-y-5">
            <h3 className="font-display text-lg font-bold">Public Café Profile</h3>
            <p className="text-xs text-muted-foreground">
              These details appear on your customer-facing website footer, headers, and SEO tags
            </p>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-foreground">Café Display Name</label>
                <input
                  type="text"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-border bg-[#faf9f8] p-2.5 text-sm outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">Tagline</label>
                <input
                  type="text"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-border bg-[#faf9f8] p-2.5 text-sm outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">
                  Phone Number for Orders
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-border bg-[#faf9f8] p-2.5 text-sm outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">
                  Google Maps Direction URL
                </label>
                <input
                  type="text"
                  value={mapsUrl}
                  onChange={(e) => setMapsUrl(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-border bg-[#faf9f8] p-2.5 text-sm outline-none focus:border-accent"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-foreground">
                  Physical Café Address
                </label>
                <textarea
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-border bg-[#faf9f8] p-2.5 text-sm outline-none focus:border-accent"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground shadow-sm transition hover:opacity-90"
              >
                <Save className="h-4 w-4" /> Save Café Profile
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ──────────────────────────────────────────────────────────
          TAB 3: ANNOUNCEMENTS & PROMOTIONS
      ────────────────────────────────────────────────────────── */}
      {activeTab === "promo" && (
        <div className="space-y-6">
          {/* Top Announcement Bar */}
          <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-lg font-bold">Store Announcement Banner</h3>
                <p className="text-xs text-muted-foreground">
                  Displays at the very top of the customer website for special deals & seasonal news
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={bannerActive}
                  onChange={(e) => {
                    setBannerActive(e.target.checked);
                    toast.success(`Announcement banner ${e.target.checked ? "enabled" : "hidden"}`);
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
              </label>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground">
                Banner Announcement Text
              </label>
              <input
                type="text"
                value={bannerText}
                onChange={(e) => setBannerText(e.target.value)}
                placeholder="e.g. 🍨 Buy 1 Get 1 on Belgian Waffles this Friday!"
                className="mt-1 w-full rounded-xl border border-border bg-[#faf9f8] p-2.5 text-sm outline-none focus:border-accent"
              />
            </div>

            <div className="rounded-xl bg-[#faf9f8] p-3 text-xs text-muted-foreground flex items-center justify-between">
              <span>
                <strong>Live Preview:</strong>{" "}
                {bannerActive && bannerText ? bannerText : "Banner is currently disabled"}
              </span>
              <button
                type="button"
                onClick={handleSaveBanner}
                className="rounded-lg bg-accent px-3.5 py-1.5 text-xs font-semibold text-accent-foreground shadow-sm hover:opacity-90"
              >
                Save & Publish Banner
              </button>
            </div>
          </div>

          {/* Promo Coupons */}
          <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-display text-lg font-bold">Discount Coupons & Offers</h3>
                <p className="text-xs text-muted-foreground">
                  Manage active promo discount codes for counter cashiers and callers
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddCouponOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-xs font-semibold text-accent-foreground shadow-sm hover:opacity-90"
              >
                <Plus className="h-3.5 w-3.5" /> Add New Coupon
              </button>
            </div>

            {promos.length === 0 ? (
              <div className="rounded-xl bg-[#faf9f8] p-8 text-center text-xs text-muted-foreground">
                <Percent className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="font-semibold text-foreground text-sm">No Active Discount Coupons</p>
                <p className="mt-1">
                  Preloaded dummy coupons have been cleared. Click "Add New Coupon" above to create
                  promotional discount codes.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {promos.map((p, idx) => (
                  <div key={p.code} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-bold bg-muted px-2.5 py-1 rounded-lg">
                        {p.code}
                      </span>
                      <span className="text-xs font-medium text-foreground">{p.discount}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={async () => {
                          const updated = promos.map((item, i) =>
                            i === idx ? { ...item, active: !item.active } : item,
                          );
                          setPromos(updated);
                          if (isFirebaseConfigured) {
                            await saveStoreSettingsToFirestore({ promos: updated });
                          }
                          toast.success(`Coupon ${p.code} status updated`);
                        }}
                        className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                          p.active ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-400"
                        }`}
                      >
                        {p.active ? "Active" : "Disabled"}
                      </button>
                      <button
                        onClick={async () => {
                          const updated = promos.filter((_, i) => i !== idx);
                          setPromos(updated);
                          if (isFirebaseConfigured) {
                            await saveStoreSettingsToFirestore({ promos: updated });
                          }
                          toast.success(`Coupon ${p.code} deleted`);
                        }}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────
          TAB 4: HOURS & SCHEDULES
      ────────────────────────────────────────────────────────── */}
      {activeTab === "timings" && (
        <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm space-y-5">
          <h3 className="font-display text-lg font-bold">Operating Hours & Schedules</h3>
          <p className="text-xs text-muted-foreground">
            Opening and closing timings displayed across Google listing and website
          </p>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="rounded-xl border border-border p-4 space-y-3">
              <h4 className="text-xs font-bold uppercase text-foreground">
                Monday – Friday (Weekdays)
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Opening Time</label>
                  <input
                    type="text"
                    value={timings.weekdayOpen}
                    onChange={(e) => setTimings({ ...timings, weekdayOpen: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-border bg-[#faf9f8] p-2 text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Closing Time</label>
                  <input
                    type="text"
                    value={timings.weekdayClose}
                    onChange={(e) => setTimings({ ...timings, weekdayClose: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-border bg-[#faf9f8] p-2 text-xs font-semibold"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border p-4 space-y-3 bg-[#faf7f2]">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase text-amber-900">
                  Saturday – Sunday (Weekends)
                </h4>
                <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                  Peak Hours
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Opening Time</label>
                  <input
                    type="text"
                    value={timings.weekendOpen}
                    onChange={(e) => setTimings({ ...timings, weekendOpen: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-border bg-white p-2 text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Closing Time</label>
                  <input
                    type="text"
                    value={timings.weekendClose}
                    onChange={(e) => setTimings({ ...timings, weekendClose: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-border bg-white p-2 text-xs font-semibold"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleSaveTimings}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground shadow-sm transition hover:opacity-90"
            >
              <Save className="h-4 w-4" /> Save Operating Hours to Cloud
            </button>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────
          TAB 5: FIREBASE & CLOUD CONFIG
      ────────────────────────────────────────────────────────── */}
      {activeTab === "firebase" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm space-y-5">
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
              <div>
                <h3 className="font-display text-lg font-bold flex items-center gap-2">
                  <Database className="h-5 w-5 text-accent" /> Firebase Cloud Infrastructure
                </h3>
                <p className="text-xs text-muted-foreground">
                  Connected to Google Cloud Firestore with real-time bidirectional WebSocket syncing
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                  </span>
                  Connected & Live
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-border bg-[#faf9f8] p-4 space-y-1">
                <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                  Project ID
                </p>
                <p className="font-mono text-sm font-bold text-foreground">{firebaseProjectId}</p>
                <p className="text-[11px] text-muted-foreground">Google Cloud Project identifier</p>
              </div>

              <div className="rounded-xl border border-border bg-[#faf9f8] p-4 space-y-1">
                <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                  Auth Domain
                </p>
                <p className="font-mono text-sm font-bold text-foreground">
                  {firebaseConfig.authDomain}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Firebase authentication callback domain
                </p>
              </div>

              <div className="rounded-xl border border-border bg-[#faf9f8] p-4 space-y-1">
                <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                  Storage Bucket
                </p>
                <p className="font-mono text-sm font-bold text-foreground">
                  {firebaseConfig.storageBucket}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Cloud Storage for menu item photos
                </p>
              </div>

              <div className="rounded-xl border border-border bg-[#faf9f8] p-4 space-y-1">
                <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                  Measurement / Analytics
                </p>
                <p className="font-mono text-sm font-bold text-foreground">
                  {firebaseConfig.measurementId || "Active"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Google Analytics 4 traffic tracking
                </p>
              </div>
            </div>

            {/* Cloud Collections Info */}
            <div className="rounded-xl border border-border p-4 space-y-3">
              <h4 className="text-xs font-bold uppercase text-foreground">
                Active Firestore Collections
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between rounded-lg bg-[#faf9f8] p-2.5">
                  <span className="font-mono font-semibold">/orders</span>
                  <span className="text-muted-foreground">
                    Real-time order progression (Pending → Completed)
                  </span>
                  <span className="text-emerald-700 font-medium">onSnapshot Active</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-[#faf9f8] p-2.5">
                  <span className="font-mono font-semibold">/store_settings</span>
                  <span className="text-muted-foreground">
                    Operating hours, announcement banners, coupons
                  </span>
                  <span className="text-emerald-700 font-medium">Synced</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-[#faf9f8] p-2.5">
                  <span className="font-mono font-semibold">/customers</span>
                  <span className="text-muted-foreground">
                    Customer registrations, profiles & loyalty points
                  </span>
                  <span className="text-emerald-700 font-medium">Firestore Live</span>
                </div>
              </div>
            </div>

            {firebasePingResult && (
              <div
                className={`rounded-xl p-3 text-xs flex items-center justify-between ${
                  firebasePingResult.success
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-red-50 text-red-800 border border-red-200"
                }`}
              >
                <span>
                  <strong>
                    {firebasePingResult.success ? "✓ Handshake Passed:" : "✗ Failed:"}
                  </strong>{" "}
                  {firebasePingResult.message}
                </span>
                <span className="font-mono font-semibold">
                  {firebasePingResult.latencyMs}ms roundtrip
                </span>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground">
                Credentials loaded from <code className="bg-muted px-1.5 py-0.5 rounded">.env</code>{" "}
                & Firebase client SDK.
              </p>
              <button
                type="button"
                disabled={isTestingFirebase}
                onClick={handleRunFirebaseTest}
                className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground shadow-sm hover:opacity-90 disabled:opacity-50"
              >
                <Zap className={`h-4 w-4 ${isTestingFirebase ? "animate-spin" : ""}`} />
                {isTestingFirebase ? "Testing Ping..." : "Test Cloud Connection"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add New Dessert Modal */}
      {isAddItemOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <button
              onClick={() => setIsAddItemOpen(false)}
              className="absolute right-4 top-4 rounded-lg p-1 text-muted-foreground hover:bg-muted"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="font-display text-xl font-bold">Add Dessert to Catalog</h3>
            <p className="text-xs text-muted-foreground">Add a new delight to the live menu</p>

            <form onSubmit={handleAddNewItem} className="mt-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-foreground">Delight Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Lotus Biscoff Belgian Waffle"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-border bg-[#faf9f8] p-2.5 text-sm outline-none focus:border-accent"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground">Price (₹) *</label>
                  <input
                    type="number"
                    required
                    placeholder="260"
                    value={newItemPrice}
                    onChange={(e) => setNewItemPrice(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-border bg-[#faf9f8] p-2.5 text-sm outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground">Category</label>
                  <select
                    value={newItemCategory}
                    onChange={(e) => setNewItemCategory(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-border bg-[#faf9f8] p-2.5 text-xs font-medium outline-none focus:border-accent"
                  >
                    {categories
                      .filter((c) => c !== "all")
                      .map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">Short Description</label>
                <input
                  type="text"
                  placeholder="e.g. Crisp waffle with warm Belgian chocolate & speculoos crunch"
                  value={newItemDesc}
                  onChange={(e) => setNewItemDesc(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-border bg-[#faf9f8] p-2.5 text-sm outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">
                  Highlight Badge (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Chef's Pick, New, Bestseller"
                  value={newItemTag}
                  onChange={(e) => setNewItemTag(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-border bg-[#faf9f8] p-2.5 text-sm outline-none focus:border-accent"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddItemOpen(false)}
                  className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-accent px-5 py-2 text-xs font-semibold text-accent-foreground shadow-sm hover:opacity-90"
                >
                  Add Delight
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add New Coupon Modal */}
      {isAddCouponOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <button
              onClick={() => setIsAddCouponOpen(false)}
              className="absolute right-4 top-4 rounded-lg p-1 text-muted-foreground hover:bg-muted"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="font-display text-xl font-bold">Create Coupon</h3>
            <p className="text-xs text-muted-foreground">Add a promotional discount code</p>

            <form onSubmit={handleAddCoupon} className="mt-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-foreground">Promo Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SUMMER20"
                  value={newCouponCode}
                  onChange={(e) => setNewCouponCode(e.target.value.toUpperCase())}
                  className="mt-1 w-full uppercase font-mono rounded-xl border border-border bg-[#faf9f8] p-2.5 text-sm outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">
                  Discount Description *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 20% OFF on orders over ₹400"
                  value={newCouponDiscount}
                  onChange={(e) => setNewCouponDiscount(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-border bg-[#faf9f8] p-2.5 text-sm outline-none focus:border-accent"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddCouponOpen(false)}
                  className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-accent px-5 py-2 text-xs font-semibold text-accent-foreground shadow-sm hover:opacity-90"
                >
                  Save Coupon
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
