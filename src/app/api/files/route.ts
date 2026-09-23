import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/session";
import { audit } from "@/lib/audit";

/**
 * Short-lived download link for a private file. Storage RLS decides who may read it:
 * the owner, staff, or an employer partner (resumes only, when the program policy allows).
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", request.url));
  const path = request.nextUrl.searchParams.get("path") ?? "";
  if (!path || path.includes("..")) return NextResponse.json({ error: "Bad path" }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("applicant-files")
    .createSignedUrl(path, 60, { download: request.nextUrl.searchParams.get("download") === "1" });
  if (error || !data) return NextResponse.json({ error: "File not found or access denied" }, { status: 404 });

  if (!path.startsWith(`${session.userId}/`)) {
    await audit(supabase, "file.view", "file", path, { roles: session.roles });
  }
  return NextResponse.redirect(data.signedUrl);
}
