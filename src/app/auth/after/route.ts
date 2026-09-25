import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { postLoginDestination } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import { audit } from "@/lib/audit";

/** Post-login router: honor `next` when the user may open it, otherwise go to their role's home. */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", url.origin));

  await audit(await createClient(), "auth.sign_in", "user", session.userId);

  const dest = postLoginDestination(session.roles, url.searchParams.get("next"));
  return NextResponse.redirect(new URL(dest, url.origin));
}
