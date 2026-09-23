// Env values use `||` (not `??`) so variables that exist but are empty still fall back.

// Public project values — they ship in the browser bundle anyway, so defaulting to them is safe.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://oyyksxbizrzmzdtwlucn.supabase.co";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_qqpMHixynSWBsbeMvHN6rA_y75gYZpl";

function resolveSiteUrl(): string {
  const candidates = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`,
    process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`,
  ];
  for (const c of candidates) {
    if (!c) continue;
    const withScheme = /^https?:\/\//.test(c) ? c : `https://${c}`;
    try {
      return new URL(withScheme).origin;
    } catch {
      // malformed — try the next candidate
    }
  }
  return "http://localhost:3000";
}

export const SITE_URL = resolveSiteUrl();
