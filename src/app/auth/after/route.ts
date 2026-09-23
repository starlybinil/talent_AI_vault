import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { homeFor, isAllowed } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import { audit } from "@/lib/audit";

/** Post-login router: honor `next` when the user may open it, otherwise go to their role's home. */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", url.origin));

  await audit(await createClient(), "auth.sign_in", "user", session.userId);

  const next = url.searchParams.get("next");
  const staffOrEmployer = homeFor(session.roles) !== "/portal";
  let dest = homeFor(session.roles);
  if (next && next.startsWith("/") && !next.startsWith("//") && isAllowed(session.roles, next.split("?")[0])) {
    // Staff and employers default to their consoles unless they explicitly asked for somewhere else.
    if (!(staffOrEmployer && next === "/portal")) dest = next;
  }
  return NextResponse.redirect(new URL(dest, url.origin));
}
