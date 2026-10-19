import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { KeyRound, Plus, ShieldCheck, UserPlus, Users, X } from "lucide-react";
import { toast } from "sonner";

import { STAFF_ROLES, useAdminAuth, type StaffRole } from "@/lib/admin-auth";
import {
  changeStaffRole,
  createStaffMember,
  listStaff,
  passwordProblem,
  resetStaffPassword,
  setStaffActive,
  type StaffMember,
} from "@/lib/staff-admin";
import { errorMessage } from "@/lib/utils";

export const Route = createFileRoute("/admin/team")({
  head: () => ({
    meta: [{ title: "Team — Ice Age Admin" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: AdminTeamPage,
});

const ROLE_BLURB: Record<StaffRole, string> = {
  admin: "Everything, including adding staff and deleting orders.",
  manager: "Orders, analytics and store settings.",
  staff: "Orders and the day-to-day counter screens.",
};

const inputCls =
  "mt-1 w-full rounded-xl border border-border bg-[#faf9f8] p-2.5 text-sm outline-none focus:border-accent";

function AdminTeamPage() {
  const { staff: me } = useAdminAuth();
  const isAdmin = me?.role === "admin";

  const [team, setTeam] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<StaffRole>("staff");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTeam(await listStaff());
      setLoadError(null);
    } catch (err) {
      setLoadError(errorMessage(err, "Could not load the team."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    const issue = passwordProblem(password);
    if (issue) {
      toast.error("Choose a stronger password", { description: issue });
      return;
    }

    setSaving(true);
    try {
      const created = await createStaffMember({ name, email, password, role });

      toast.success(`${created.name} can now sign in`, {
        description: `Give them this email and password — they can change it with “Forgot password”.`,
      });

      setIsAddOpen(false);
      setName("");
      setEmail("");
      setPassword("");
      setRole("staff");
      await load();
    } catch (err) {
      toast.error("Staff member not added", { description: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (member: StaffMember) => {
    try {
      await setStaffActive(member.uid, !member.active);
      toast.success(
        member.active ? `${member.name} can no longer sign in` : `${member.name} restored`,
      );
      await load();
    } catch (err) {
      toast.error("Could not change access", { description: errorMessage(err) });
    }
  };

  const handleRoleChange = async (member: StaffMember, next: StaffRole) => {
    try {
      await changeStaffRole(member.uid, next);
      toast.success(`${member.name} is now ${next}`);
      await load();
    } catch (err) {
      toast.error("Could not change the role", { description: errorMessage(err) });
    }
  };

  const handleResetPassword = async (member: StaffMember) => {
    try {
      await resetStaffPassword(member.email);
      toast.success(`Password reset link sent to ${member.email}`);
    } catch (err) {
      toast.error("Could not send the reset link", { description: errorMessage(err) });
    }
  };

  if (!isAdmin) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <ShieldCheck className="mx-auto h-8 w-8 text-muted-foreground/60" />
        <h2 className="mt-3 font-display text-xl font-semibold">Admins only</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ask the store owner if you need to add or change staff accounts.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-accent" />
            <h2 className="font-display text-2xl font-bold">Team</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Add staff here — they sign in at this portal. Customer accounts can never reach it.
          </p>
        </div>

        <button
          onClick={() => setIsAddOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground shadow-sm transition hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Add staff member
        </button>
      </div>

      {loadError && (
        <div className="rounded-xl bg-amber-50 p-4 text-xs text-amber-900">{loadError}</div>
      )}

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {loading ? (
          <div className="p-10 text-center">
            <span className="mx-auto block h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          </div>
        ) : team.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No staff accounts yet.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {team.map((member) => (
              <li
                key={member.uid}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold">{member.name}</span>
                    {member.uid === me?.uid && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                        You
                      </span>
                    )}
                    {!member.active && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-700">
                        Disabled
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={member.role}
                    onChange={(e) => void handleRoleChange(member, e.target.value as StaffRole)}
                    disabled={member.uid === me?.uid}
                    title={ROLE_BLURB[member.role]}
                    className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-semibold capitalize outline-none disabled:opacity-60"
                  >
                    {STAFF_ROLES.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() => void handleResetPassword(member)}
                    className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium transition hover:bg-muted"
                  >
                    <KeyRound className="h-3.5 w-3.5" /> Reset password
                  </button>

                  <button
                    onClick={() => void handleToggleActive(member)}
                    disabled={member.uid === me?.uid}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition disabled:opacity-40 ${
                      member.active
                        ? "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                        : "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    }`}
                  >
                    {member.active ? "Disable" : "Enable"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Disabling removes portal access immediately. Their sign-in still exists in Firebase, so
        enabling them again restores access without a new password.
      </p>

      {/* Add staff dialog */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-accent" />
                <h3 className="font-display text-lg font-semibold">Add a staff member</h3>
              </div>
              <button onClick={() => setIsAddOpen(false)} aria-label="Close">
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            <form onSubmit={handleAdd} className="mt-5 space-y-4">
              <div>
                <label htmlFor="staff-name" className="text-xs font-semibold">
                  Name *
                </label>
                <input
                  id="staff-name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Kiran Kumar"
                  className={inputCls}
                />
              </div>

              <div>
                <label htmlFor="staff-email" className="text-xs font-semibold">
                  Email *
                </label>
                <input
                  id="staff-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="kiran@iceagecreamery.in"
                  className={inputCls}
                />
              </div>

              <div>
                <label htmlFor="staff-password" className="text-xs font-semibold">
                  Temporary password *
                </label>
                <input
                  id="staff-password"
                  type="text"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters, with a number"
                  className={inputCls}
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Give it to them in person. They can set their own with “Forgot password?” on the
                  sign-in screen.
                </p>
              </div>

              <div>
                <label htmlFor="staff-role" className="text-xs font-semibold">
                  Role
                </label>
                <select
                  id="staff-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as StaffRole)}
                  className={`${inputCls} capitalize`}
                >
                  {STAFF_ROLES.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-muted-foreground">{ROLE_BLURB[role]}</p>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-accent px-6 py-2.5 text-sm font-semibold text-accent-foreground shadow-md transition hover:opacity-90 disabled:opacity-60"
                >
                  {saving ? "Creating…" : "Create account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
