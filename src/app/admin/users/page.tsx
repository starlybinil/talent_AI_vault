import { Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/session";
import { cancelPendingGrant, createEmployerOrg, deleteUser, grantRole, revokeRole, setUserActive } from "@/app/admin/actions";
import { ActionForm, SubmitButton } from "@/components/ui/forms";
import { Badge, Card, Input, Label, PageHeader, Select, buttonClass } from "@/components/ui";
import { ROLES, ROLE_LABEL, type Role } from "@/lib/rbac";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Users & roles" };

type U = {
  id: string;
  email: string | null;
  full_name: string | null;
  active: boolean;
  created_at: string;
  user_roles: Array<{ id: string; role: Role; employer_org_id: string | null }>;
};

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string; role?: string }> }) {
  const sp = await searchParams;
  const session = await requirePermission("users.manage", "/admin/users");
  const supabase = await createClient();
  let query = supabase.from("profiles").select("id, email, full_name, active, created_at, user_roles(id, role, employer_org_id)").order("created_at", { ascending: false }).limit(200);
  const term = (sp.q ?? "").replace(/[^\p{L}\p{N}@.\-_ ]/gu, "").trim();
  if (term) query = query.or(`email.ilike.%${term}%,full_name.ilike.%${term}%`);
  const [{ data: users }, { data: orgs }, { data: pending }] = await Promise.all([
    query,
    supabase.from("employer_orgs").select("id, name").order("name"),
    supabase.from("pending_role_grants").select("id, email, role, employer_org_id, created_at").order("created_at", { ascending: false }),
  ]);
  const orgName = Object.fromEntries((orgs ?? []).map((o) => [o.id, o.name]));
  let rows = (users ?? []) as U[];
  if (sp.role && (ROLES as readonly string[]).includes(sp.role)) rows = rows.filter((u) => u.user_roles.some((r) => r.role === sp.role));

  return (
    <div>
      <PageHeader eyebrow="IT administration" title="Users & roles" description="Grant staff and employer access. If the person has no account yet, the role is saved and applied automatically when they register with that email." />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="font-black">Grant a role</h2>
          <ActionForm action={grantRole} resetOnSuccess className="mt-4 grid gap-3">
            <div>
              <Label htmlFor="grant-email">Email (existing account or someone yet to register)</Label>
              <Input id="grant-email" name="email" type="email" required placeholder="person@company.com" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Role</Label>
                <Select name="role" required>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Employer org (employer role only)</Label>
                <Select name="employer_org_id">
                  <option value="">—</option>
                  {(orgs ?? []).map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <SubmitButton variant="dark" className="justify-self-start">Grant role</SubmitButton>
          </ActionForm>
          {(pending ?? []).length > 0 && (
            <div className="mt-6 border-t border-ink/10 pt-5">
              <h3 className="text-sm font-black">Waiting for these people to register</h3>
              <p className="mt-1 text-xs text-ink/50">They get these roles (instead of Applicant) when they create an account with this email.</p>
              <ul className="mt-3 divide-y divide-ink/5">
                {(pending ?? []).map((g) => (
                  <li key={g.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate font-bold">{g.email}</span>
                      <span className="text-xs text-ink/50">
                        {ROLE_LABEL[g.role as Role]}
                        {g.employer_org_id ? ` · ${orgName[g.employer_org_id] ?? "employer"}` : ""} · invited {formatDate(g.created_at)}
                      </span>
                    </span>
                    <ActionForm action={cancelPendingGrant} confirm={`Cancel the pending ${ROLE_LABEL[g.role as Role]} role for ${g.email}?`}>
                      <input type="hidden" name="grant_id" value={g.id} />
                      <SubmitButton size="sm" variant="ghost" pendingText="…">
                        Cancel
                      </SubmitButton>
                    </ActionForm>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
        <Card>
          <h2 className="font-black">Employer organizations</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {(orgs ?? []).map((o) => (
              <li key={o.id}>
                <Badge>{o.name}</Badge>
              </li>
            ))}
          </ul>
          <ActionForm action={createEmployerOrg} resetOnSuccess className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div>
              <Label>Name</Label>
              <Input name="name" required placeholder="Company name" />
            </div>
            <div>
              <Label>Email domain</Label>
              <Input name="domain" placeholder="company.com" />
            </div>
            <SubmitButton variant="dark">Add</SubmitButton>
          </ActionForm>
        </Card>
      </div>

      <Card className="mt-6 p-4">
        <form method="get" className="flex flex-wrap gap-3">
          <div className="relative min-w-60 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 mt-0.5 h-4 w-4 -translate-y-1/2 text-ink/40" />
            <Input name="q" defaultValue={sp.q} placeholder="Search by name or email" className="pl-9" aria-label="Search users" />
          </div>
          <Select name="role" defaultValue={sp.role ?? ""} className="w-48" aria-label="Role">
            <option value="">All roles</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </Select>
          <button className={buttonClass("dark", "md", "mt-1.5")}>Search</button>
        </form>
      </Card>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-ink/10 bg-white">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-mist text-xs uppercase tracking-wider text-ink/50">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Roles</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/5">
            {rows.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3">
                  <p className="font-bold">{u.full_name || "—"}</p>
                  <p className="text-xs text-ink/50">{u.email}</p>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {u.user_roles.map((r) => (
                      <ActionForm key={r.id} action={revokeRole} confirm={`Revoke ${ROLE_LABEL[r.role]} from ${u.email}?`}>
                        <input type="hidden" name="role_id" value={r.id} />
                        <button className="group inline-flex cursor-pointer items-center gap-1 rounded-full bg-ink/5 px-2.5 py-1 text-xs font-bold hover:bg-red-50 hover:text-red-700" title="Revoke">
                          {ROLE_LABEL[r.role]}
                          {r.employer_org_id ? ` · ${orgName[r.employer_org_id]}` : ""}
                          <span className="opacity-40 group-hover:opacity-100">×</span>
                        </button>
                      </ActionForm>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-ink/60">{formatDate(u.created_at)}</td>
                <td className="px-4 py-3">
                  {u.id === session.userId ? (
                    <Badge tone="info">You</Badge>
                  ) : (
                    <div className="flex flex-wrap items-start gap-2">
                      <ActionForm action={setUserActive} confirm={u.active ? `Deactivate ${u.email}? They lose all access.` : undefined}>
                        <input type="hidden" name="user_id" value={u.id} />
                        <input type="hidden" name="active" value={u.active ? "0" : "1"} />
                        <SubmitButton size="sm" variant={u.active ? "outline" : "dark"}>
                          {u.active ? "Deactivate" : "Reactivate"}
                        </SubmitButton>
                      </ActionForm>
                      <details className="group">
                        <summary className="inline-flex h-9 cursor-pointer list-none items-center rounded-full border border-red-200 px-4 text-sm font-bold text-red-700 hover:bg-red-50">
                          Delete
                        </summary>
                        <ActionForm
                          action={deleteUser}
                          confirm={`Permanently delete ${u.email}? This removes their account, applications, messages and signed agreements. It cannot be undone.`}
                          className="mt-2 grid w-64 gap-2 rounded-2xl border border-red-200 bg-red-50/60 p-3"
                        >
                          <input type="hidden" name="user_id" value={u.id} />
                          <p className="text-xs text-red-800">
                            Permanently removes the account and everything tied to it. Type <strong>{u.email}</strong> to confirm.
                          </p>
                          <Input name="confirm_email" type="email" required placeholder={u.email ?? "email"} aria-label="Confirm email" className="mt-0 h-9 text-sm" />
                          <SubmitButton size="sm" variant="danger" pendingText="Deleting…">
                            Delete permanently
                          </SubmitButton>
                        </ActionForm>
                      </details>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
