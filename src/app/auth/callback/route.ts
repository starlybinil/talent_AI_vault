import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/utils";

/** OAuth / magic-link / email-confirmation landing. Exchanges the code for a session. */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"), "/portal");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(new URL(`/login?error=callback&next=${encodeURIComponent(next)}`, url.origin));
  }
  return NextResponse.redirect(new URL(`/auth/after?next=${encodeURIComponent(next)}`, url.origin));
}
