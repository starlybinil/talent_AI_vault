import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Entry point for partner sites (e.g. ASU's "Get Started Today" button):
 *   https://<site>/apply/asu-tsmc?utm_source=asu
 * Remembers UTM attribution, then routes to registration or straight into the application.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const url = new URL(request.url);
  const safeSlug = slug.replace(/[^a-z0-9-]/gi, "").slice(0, 80);
  const target = `/portal/apply/${safeSlug}`;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const dest = user ? target : `/register?next=${encodeURIComponent(target)}`;
  const res = NextResponse.redirect(new URL(dest, url.origin));

  const utm = {
    utm_source: url.searchParams.get("utm_source") || (request.headers.get("referer")?.includes("asu") ? "asu" : ""),
    utm_medium: url.searchParams.get("utm_medium") || "",
    utm_campaign: url.searchParams.get("utm_campaign") || "",
  };
  if (utm.utm_source || utm.utm_medium || utm.utm_campaign) {
    res.cookies.set("tv_utm", JSON.stringify(utm), { maxAge: 60 * 60 * 24 * 30, sameSite: "lax", path: "/", httpOnly: true });
  }
  return res;
}
