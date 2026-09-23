import { Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/session";
import { createEmployerOrg, grantRole, revokeRole, setUserActive } from "@/app/admin/actions";
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
  const [{ data: users }, { data: orgs }] = await Promise.all([query, supabase.from("employer_orgs").select("id, name").order("name")]);
  const orgName = Object.fromEntries((orgs ?? []).map((o) => [o.id, o.name]));
  let rows = (users ?? []) as U[];
  if (sp.role && (ROLES as readonly string[]).includes(sp.role)) rows = rows.filter((u) => u.user_roles.some((r) => r.role === sp.role));

  return (
    <div>
      <PageHeader eyebrow="IT administration" title="Users & roles" description="Grant staff and employer access. People must create an account first (any sign-in method)." />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="font-black">Grant a role</h2>
          <ActionForm action={grantRole} resetOnSuccess className="mt-4 grid gap-3">
            <div>
              <Label htmlFor="grant-email">Account email</Label>
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
                    <ActionForm action={setUserActive} confirm={u.active ? `Deactivate ${u.email}? They lose all access.` : undefined}>
                      <input type="hidden" name="user_id" value={u.id} />
                      <input type="hidden" name="active" value={u.active ? "0" : "1"} />
                      <SubmitButton size="sm" variant={u.active ? "outline" : "dark"}>
                        {u.active ? "Deactivate" : "Reactivate"}
                      </SubmitButton>
                    </ActionForm>
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
