import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { can, type Permission, type Role } from "@/lib/rbac";

export type Session = {
  userId: string;
  email: string;
  fullName: string | null;
  roles: Role[];
  employerOrgIds: string[];
};

/** Current user + roles, memoized per request. */
export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [rolesRes, { data: profile }] = await Promise.all([
    supabase.rpc("my_roles"),
    supabase.from("profiles").select("full_name, email, active").eq("id", user.id).maybeSingle(),
  ]);
  // A failed lookup would make staff look like applicants (and route them to the portal), so retry once.
  let roles = rolesRes.data;
  if (rolesRes.error) roles = (await supabase.rpc("my_roles")).data;

  const rows = (roles ?? []) as Array<{ role: Role; employer_org_id: string | null }>;
  return {
    userId: user.id,
    email: profile?.email ?? user.email ?? "",
    fullName: profile?.full_name ?? (user.user_metadata?.full_name as string | undefined) ?? null,
    roles: profile?.active === false ? [] : Array.from(new Set(rows.map((r) => r.role))),
    employerOrgIds: rows.filter((r) => r.role === "employer" && r.employer_org_id).map((r) => r.employer_org_id!),
  };
});

export async function requireSession(next = "/portal"): Promise<Session> {
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(next)}`);
  return session;
}

export async function requirePermission(permission: Permission, next = "/admin"): Promise<Session> {
  const session = await requireSession(next);
  if (!can(session.roles, permission)) redirect("/forbidden");
  return session;
}

/** For server actions: throw instead of redirecting. */
export async function assertPermission(permission: Permission): Promise<Session> {
  const session = await getSession();
  if (!session || !can(session.roles, permission)) throw new Error("You don't have permission to do that.");
  return session;
}
