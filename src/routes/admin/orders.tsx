import { errorMessage } from "@/lib/utils";
import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  Search,
  Filter,
  Plus,
  Phone,
  Printer,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  CreditCard,
  Banknote,
  QrCode,
  Eye,
  X,
  FileText,
  Calendar,
  Database,
  Trash2,
  Sparkles,
  ShoppingBag,
} from "lucide-react";
import {
  generateOrderId,
  ORDER_STATUS_CONFIG,
  type Order,
  type OrderStatus,
  type PaymentMethod,
  type OrderItem,
} from "@/data/orders";
import { useOrders } from "@/lib/orders-store";
import { findCustomerIdByEmail } from "@/lib/firebase";
import { OnlineOrderPanel } from "@/components/admin/OnlineOrderPanel";
import { mainMenu, weekendMenu } from "@/data/menu";
import { toast } from "sonner";

type TimeFilter = "all" | "today" | "week";

export const Route = createFileRoute("/admin/orders")({
  head: () => ({
    meta: [{ title: "Order Management — Ice Age Admin" }],
  }),
  component: AdminOrdersPage,
});

const allAvailableItems = [
  ...weekendMenu.items.map((i) => ({ ...i, category: weekendMenu.title })),
  ...mainMenu.flatMap((cat) => cat.items.map((i) => ({ ...i, category: cat.title }))),
];

function AdminOrdersPage() {
  const {
    orders,
    addOrder,
    updateOrderStatus,
    clearAllOrders,
    isFirebaseConfigured,
    firebaseProjectId,
  } = useOrders();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");

  // Selected Order for Modal
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // New Order Form State
  const [newCustName, setNewCustName] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [newCustEmail, setNewCustEmail] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [newPaymentMethod, setNewPaymentMethod] = useState<PaymentMethod>("upi");
  const [newNotes, setNewNotes] = useState("");
  const [selectedItems, setSelectedItems] = useState<{ [name: string]: number }>({});

  // Filtered orders
  const filteredOrders = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    return orders.filter((order) => {
      // Search
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        order.id.toLowerCase().includes(q) ||
        order.customerName.toLowerCase().includes(q) ||
        order.phone.includes(q) ||
        order.items.some((i) => i.name.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      // Status
      if (statusFilter !== "all" && order.status !== statusFilter) return false;

      // Payment
      if (paymentFilter !== "all" && order.paymentMethod !== paymentFilter) return false;

      // Time
      if (timeFilter === "today") {
        if (order.createdAt.toISOString().split("T")[0] !== todayStr) return false;
      } else if (timeFilter === "week") {
        if (order.createdAt < sevenDaysAgo) return false;
      }

      return true;
    });
  }, [orders, searchQuery, statusFilter, paymentFilter, timeFilter]);

  // Status counts
  const statusCounts = useMemo(() => {
    return {
      all: orders.length,
      awaiting_confirmation: orders.filter((o) => o.status === "awaiting_confirmation").length,
      pending: orders.filter((o) => o.status === "pending").length,
      preparing: orders.filter((o) => o.status === "preparing").length,
      ready: orders.filter((o) => o.status === "ready").length,
      completed: orders.filter((o) => o.status === "completed").length,
      cancelled: orders.filter((o) => o.status === "cancelled").length,
    };
  }, [orders]);

  const handleUpdateStatus = async (orderId: string, newStatus: OrderStatus) => {
    try {
      await updateOrderStatus(orderId, newStatus);
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder((prev) => (prev ? { ...prev, status: newStatus } : null));
      }
      toast.success(`Order ${orderId} marked as ${ORDER_STATUS_CONFIG[newStatus].label}`);
    } catch (err) {
      toast.error("Could not update the order", {
        description: errorMessage(err, "The change was not saved. Please try again."),
      });
    }
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    if (!newCustName.trim()) {
      toast.error("Please enter a customer name");
      return;
    }
    const orderItems: OrderItem[] = Object.entries(selectedItems)
      .filter(([_, qty]) => qty > 0)
      .map(([name, quantity]) => {
        const itemObj = allAvailableItems.find((i) => i.name === name);
        return {
          name,
          quantity,
          price: itemObj ? itemObj.price : 200,
        };
      });

    if (orderItems.length === 0) {
      toast.error("Please add at least one item to the order");
      return;
    }

    const total = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const email = newCustEmail.trim().toLowerCase();
    setIsSaving(true);

    try {
      // Link the order to a registered account when an email is given, so the
      // customer can see it in their own order history.
      let customerId: string | null = null;
      if (email) {
        customerId = await findCustomerIdByEmail(email);
        if (!customerId) {
          toast.info("No registered account for that email", {
            description: "The order will be saved as a walk-in order.",
          });
        }
      }

      const newOrder: Order = {
        id: generateOrderId(),
        customerName: newCustName.trim(),
        phone: newCustPhone.trim() || "Walk-in Guest",
        items: orderItems,
        total,
        status: "pending",
        paymentMethod: newPaymentMethod,
        createdAt: new Date(),
        notes: newNotes.trim() || undefined,
        customerId,
        customerEmail: email || null,
      };

      await addOrder(newOrder);

      setIsCreateOpen(false);
      setNewCustName("");
      setNewCustPhone("");
      setNewCustEmail("");
      setNewNotes("");
      setSelectedItems({});
      toast.success(`Order #${newOrder.id} saved to Firebase.`);
    } catch (err) {
      // The order was NOT saved. Keep the form open with the items intact.
      toast.error("Order was not saved", {
        description: errorMessage(err, "Nothing was charged or sent to the kitchen. Please retry."),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrintKOT = (order: Order) => {
    toast.info(`Printing Kitchen Order Ticket for ${order.id}...`);
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-2xl font-bold">Order Management</h2>
            {isFirebaseConfigured ? (
              <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                <Database className="h-3 w-3" /> Firebase Live
              </span>
            ) : (
              <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-800">
                <Database className="h-3 w-3" /> Firebase Ready
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Track, filter, and progress kitchen orders from placement to pickup
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {orders.length > 0 && (
            <button
              onClick={() => {
                if (
                  window.confirm(
                    "Delete every loaded order? This cannot be undone and removes them from Firebase.",
                  )
                ) {
                  clearAllOrders()
                    .then(() => toast.info("All loaded orders deleted."))
                    .catch((err: unknown) =>
                      toast.error("Some orders were not deleted", {
                        description: errorMessage(err, "Please try again."),
                      }),
                    );
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
            >
              <Trash2 className="h-3.5 w-3.5" /> Clear Orders
            </button>
          )}

          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground shadow-sm transition hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> New Walk-in / Phone Order
          </button>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex overflow-x-auto border-b border-border pb-1">
        {[
          { id: "all", label: "All Orders", count: statusCounts.all },
          {
            id: "awaiting_confirmation",
            label: "Website orders",
            count: statusCounts.awaiting_confirmation,
            color: "text-violet-600",
          },
          { id: "pending", label: "Pending", count: statusCounts.pending, color: "text-amber-600" },
          {
            id: "preparing",
            label: "Preparing",
            count: statusCounts.preparing,
            color: "text-blue-600",
          },
          { id: "ready", label: "Ready", count: statusCounts.ready, color: "text-emerald-600" },
          { id: "completed", label: "Completed", count: statusCounts.completed },
          {
            id: "cancelled",
            label: "Cancelled",
            count: statusCounts.cancelled,
            color: "text-red-500",
          },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setStatusFilter(tab.id)}
            className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              statusFilter === tab.id
                ? "border-accent text-accent font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                statusFilter === tab.id
                  ? "bg-accent/20 text-accent font-bold"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-black/5 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by order ID (IA-1010), customer name, phone, item..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-border bg-[#faf9f8] py-2 pl-9 pr-4 text-sm outline-none transition focus:border-accent focus:bg-white"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Payment Method filter */}
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="rounded-xl border border-border bg-[#faf9f8] px-3 py-2 text-xs font-medium outline-none transition focus:border-accent"
          >
            <option value="all">All Payment Methods</option>
            <option value="upi">UPI (GPay / PhonePe)</option>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
          </select>

          {/* Time range */}
          <select
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value as TimeFilter)}
            className="rounded-xl border border-border bg-[#faf9f8] px-3 py-2 text-xs font-medium outline-none transition focus:border-accent"
          >
            <option value="all">All Time</option>
            <option value="today">Today Only</option>
            <option value="week">Past 7 Days</option>
          </select>

          {(searchQuery ||
            statusFilter !== "all" ||
            paymentFilter !== "all" ||
            timeFilter !== "all") && (
            <button
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("all");
                setPaymentFilter("all");
                setTimeFilter("all");
              }}
              className="rounded-xl bg-muted px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Orders Table */}
      <div className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-[#faf9f8] text-xs font-semibold uppercase text-muted-foreground">
              <tr>
                <th className="px-5 py-3.5">Order ID & Time</th>
                <th className="px-5 py-3.5">Customer</th>
                <th className="px-5 py-3.5">Items</th>
                <th className="px-5 py-3.5">Payment</th>
                <th className="px-5 py-3.5">Total</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-muted-foreground">
                    <div className="max-w-sm mx-auto space-y-3">
                      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-50 text-amber-700 mx-auto">
                        <ShoppingBag className="h-6 w-6" />
                      </div>
                      <p className="text-sm font-semibold text-foreground">
                        {orders.length === 0 ? "No Orders in Queue" : "No orders match filters"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {orders.length === 0
                          ? "Incoming walk-in counter and phone orders will appear here and sync across kitchen tablets in real time."
                          : "Try resetting your search query or status filter."}
                      </p>
                      {orders.length === 0 && (
                        <div className="pt-2">
                          <button
                            onClick={() => setIsCreateOpen(true)}
                            className="rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground shadow-sm hover:opacity-90"
                          >
                            <Plus className="inline mr-1 h-3.5 w-3.5" /> Place First Order
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const cfg = ORDER_STATUS_CONFIG[order.status];
                  return (
                    <tr key={order.id} className="transition hover:bg-[#faf9f8]/60">
                      {/* ID & Date */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-bold text-foreground">
                            {order.id}
                          </span>
                          {order.channel === "online" && (
                            <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-violet-700">
                              {order.fulfilment?.type === "delivery" ? "Delivery" : "Pickup"}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {order.createdAt.toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                          })}{" "}
                          •{" "}
                          {order.createdAt.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </td>

                      {/* Customer */}
                      <td className="px-5 py-4">
                        <div className="font-medium text-foreground">{order.customerName}</div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {order.phone}
                        </div>
                      </td>

                      {/* Items */}
                      <td className="px-5 py-4">
                        <div className="max-w-xs space-y-0.5">
                          {order.items.slice(0, 2).map((item, idx) => (
                            <div key={idx} className="truncate text-xs text-foreground">
                              <span className="font-semibold text-accent">{item.quantity}x</span>{" "}
                              {item.name}
                            </div>
                          ))}
                          {order.items.length > 2 && (
                            <div className="text-[11px] text-muted-foreground">
                              +{order.items.length - 2} more items
                            </div>
                          )}
                          {order.notes && (
                            <div className="truncate text-[11px] italic text-amber-600">
                              "{order.notes}"
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Payment */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5 text-xs capitalize text-muted-foreground">
                          {order.paymentMethod === "upi" && (
                            <span className="flex items-center gap-1 font-medium text-emerald-700">
                              <QrCode className="h-3.5 w-3.5" /> UPI
                            </span>
                          )}
                          {order.paymentMethod === "cash" && (
                            <span className="flex items-center gap-1 font-medium text-amber-700">
                              <Banknote className="h-3.5 w-3.5" /> Cash
                            </span>
                          )}
                          {order.paymentMethod === "card" && (
                            <span className="flex items-center gap-1 font-medium text-blue-700">
                              <CreditCard className="h-3.5 w-3.5" /> Card
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Total */}
                      <td className="px-5 py-4">
                        <span className="font-display font-bold text-foreground">
                          ₹{order.total}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        <div className="relative inline-block">
                          <select
                            value={order.status}
                            onChange={(e) =>
                              handleUpdateStatus(order.id, e.target.value as OrderStatus)
                            }
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wider outline-none cursor-pointer ${cfg.bg} ${cfg.color}`}
                          >
                            <option value="awaiting_confirmation">Needs confirming</option>
                            <option value="pending">Pending</option>
                            <option value="preparing">Preparing</option>
                            <option value="ready">Ready</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedOrder(order)}
                            title="View Full Ticket"
                            className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handlePrintKOT(order)}
                            title="Print KOT"
                            className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                          >
                            <Printer className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <button
              onClick={() => setSelectedOrder(null)}
              className="absolute right-4 top-4 rounded-lg p-1 text-muted-foreground hover:bg-muted"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2">
              <span className="font-mono text-lg font-bold">{selectedOrder.id}</span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase ${
                  ORDER_STATUS_CONFIG[selectedOrder.status].bg
                } ${ORDER_STATUS_CONFIG[selectedOrder.status].color}`}
              >
                {ORDER_STATUS_CONFIG[selectedOrder.status].label}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Placed on{" "}
              {selectedOrder.createdAt.toLocaleString("en-IN", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>

            {/* Stepper */}
            <div className="mt-5 grid grid-cols-4 gap-1 text-center text-xs">
              {(["pending", "preparing", "ready", "completed"] as OrderStatus[]).map((st) => {
                const steps = ["pending", "preparing", "ready", "completed"];
                const currentIdx = steps.indexOf(selectedOrder.status);
                const stepIdx = steps.indexOf(st);
                const isPassed = stepIdx <= currentIdx && selectedOrder.status !== "cancelled";

                return (
                  <div key={st} className="flex flex-col items-center gap-1.5">
                    <div
                      className={`h-2 w-full rounded-full ${
                        isPassed ? "bg-accent" : "bg-gray-200"
                      }`}
                    />
                    <span
                      className={`capitalize ${isPassed ? "font-bold text-accent" : "text-muted-foreground"}`}
                    >
                      {st}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Customer Box */}
            <div className="mt-6 rounded-xl bg-[#faf9f8] p-4 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Customer:</span>
                <span className="font-semibold">{selectedOrder.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Phone:</span>
                <span className="font-semibold">{selectedOrder.phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payment Method:</span>
                <span className="font-semibold uppercase">{selectedOrder.paymentMethod}</span>
              </div>
              {selectedOrder.notes && (
                <div className="flex justify-between border-t border-border/40 pt-1 mt-1 text-amber-700">
                  <span>Special Note:</span>
                  <span className="font-medium italic">{selectedOrder.notes}</span>
                </div>
              )}
            </div>

            {/* Website order: fulfilment, price check and confirmation */}
            <OnlineOrderPanel
              order={selectedOrder}
              busy={isSaving}
              onConfirm={() => void handleUpdateStatus(selectedOrder.id, "preparing")}
              onReject={() => {
                if (
                  window.confirm("Reject this website order and tell the customer it's cancelled?")
                ) {
                  void handleUpdateStatus(selectedOrder.id, "cancelled");
                }
              }}
            />

            {/* Items */}
            <div className="mt-4 max-h-48 overflow-y-auto divide-y divide-border text-xs">
              {selectedOrder.items.map((item, idx) => (
                <div key={idx} className="flex justify-between py-2">
                  <span>
                    <span className="font-bold text-accent">{item.quantity}x</span> {item.name}
                  </span>
                  <span className="font-medium">₹{item.price * item.quantity}</span>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
              <span className="text-sm font-semibold">Total Amount</span>
              <span className="font-display text-xl font-bold">₹{selectedOrder.total}</span>
            </div>

            {/* Actions */}
            <div className="mt-6 flex flex-wrap gap-2">
              {selectedOrder.status === "pending" && (
                <button
                  onClick={() => handleUpdateStatus(selectedOrder.id, "preparing")}
                  className="flex-1 rounded-xl bg-blue-600 py-2.5 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  Start Preparing
                </button>
              )}
              {selectedOrder.status === "preparing" && (
                <button
                  onClick={() => handleUpdateStatus(selectedOrder.id, "ready")}
                  className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  Mark Order Ready
                </button>
              )}
              {selectedOrder.status === "ready" && (
                <button
                  onClick={() => handleUpdateStatus(selectedOrder.id, "completed")}
                  className="flex-1 rounded-xl bg-primary py-2.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
                >
                  Complete & Handover
                </button>
              )}
              <button
                onClick={() => handlePrintKOT(selectedOrder)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-xs font-semibold hover:bg-muted"
              >
                <Printer className="h-4 w-4" /> Print KOT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Order Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <button
              onClick={() => setIsCreateOpen(false)}
              className="absolute right-4 top-4 rounded-lg p-1 text-muted-foreground hover:bg-muted"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="font-display text-xl font-bold">Create New Order</h3>
            <p className="text-xs text-muted-foreground">
              Add walk-in counter order or phone booking
            </p>

            <form onSubmit={handleCreateOrder} className="mt-5 space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-foreground">Customer Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh V"
                    value={newCustName}
                    onChange={(e) => setNewCustName(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-border bg-[#faf9f8] p-2.5 text-sm outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground">Phone Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 9876543210"
                    value={newCustPhone}
                    onChange={(e) => setNewCustPhone(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-border bg-[#faf9f8] p-2.5 text-sm outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">
                  Member Email{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional — links the order to their account)
                  </span>
                </label>
                <input
                  type="email"
                  placeholder="customer@example.com"
                  value={newCustEmail}
                  onChange={(e) => setNewCustEmail(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-border bg-[#faf9f8] p-2.5 text-sm outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">Payment Method</label>
                <div className="mt-1 flex gap-2">
                  {(["upi", "cash", "card"] as PaymentMethod[]).map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setNewPaymentMethod(method)}
                      className={`flex-1 rounded-xl border py-2 text-xs font-semibold uppercase transition ${
                        newPaymentMethod === method
                          ? "border-accent bg-accent/10 text-accent font-bold"
                          : "border-border text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              {/* Menu items selection */}
              <div>
                <label className="text-xs font-semibold text-foreground">
                  Select Menu Delights
                </label>
                <div className="mt-2 max-h-56 space-y-2 overflow-y-auto rounded-xl border border-border p-2">
                  {allAvailableItems.map((item) => {
                    const qty = selectedItems[item.name] || 0;
                    return (
                      <div
                        key={item.name}
                        className="flex items-center justify-between rounded-lg p-2 transition hover:bg-muted/50"
                      >
                        <div className="pr-2">
                          <p className="text-xs font-semibold">{item.name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {item.category} • ₹{item.price}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {qty > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedItems((prev) => ({
                                  ...prev,
                                  [item.name]: Math.max(0, qty - 1),
                                }))
                              }
                              className="grid h-7 w-7 place-items-center rounded-lg bg-muted text-xs font-bold hover:bg-gray-200"
                            >
                              -
                            </button>
                          )}
                          <span className="w-5 text-center text-xs font-bold">{qty}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedItems((prev) => ({
                                ...prev,
                                [item.name]: qty + 1,
                              }))
                            }
                            className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-xs font-bold text-accent-foreground hover:opacity-90"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">Kitchen Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Extra hot chocolate sauce, birthday candle"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-border bg-[#faf9f8] p-2.5 text-sm outline-none focus:border-accent"
                />
              </div>

              <div className="flex items-center justify-between border-t border-border pt-4">
                <div>
                  <p className="text-xs text-muted-foreground">Total Estimate</p>
                  <p className="font-display text-xl font-bold">
                    ₹
                    {Object.entries(selectedItems).reduce((sum, [name, qty]) => {
                      const item = allAvailableItems.find((i) => i.name === name);
                      return sum + (item ? item.price * qty : 0);
                    }, 0)}
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-xl bg-accent px-6 py-2.5 text-sm font-semibold text-accent-foreground shadow-md transition hover:opacity-90 disabled:opacity-60"
                >
                  {isSaving ? "Saving…" : "Place Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
