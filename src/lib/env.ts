// Env values use `||` (not `??`) so variables that exist but are empty still fall back.

// Public project values — they ship in the browser bundle anyway, so defaulting to them is safe.
const PROJECT_REF = "oyyksxbizrzmzdtwlucn";
export const DEFAULT_SUPABASE_KEY = "sb_publishable_qqpMHixynSWBsbeMvHN6rA_y75gYZpl";

/** Strip whitespace and stray quotes that often sneak in when pasting env values into a dashboard. */
function clean(v: string | undefined) {
  return (v || "").trim().replace(/^["']|["']$/g, "").trim();
}

export const SUPABASE_URL = clean(process.env.NEXT_PUBLIC_SUPABASE_URL) || `https://${PROJECT_REF}.supabase.co`;

/**
 * The configured key, unless it plainly can't work for this project (not a publishable key and not an anon JWT
 * issued for this project's ref), in which case the project's own public key is used. A mismatched key makes
 * every request fail with 401 and the site renders with no programs.
 */
function resolveAnonKey(): string {
  const key = clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (!key) return DEFAULT_SUPABASE_KEY;
  const ownProject = SUPABASE_URL.includes(PROJECT_REF);
  if (!ownProject) return key;
  if (key.startsWith("sb_publishable_")) return key;
  try {
    const payload = JSON.parse(atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (payload.ref === PROJECT_REF && payload.role === "anon") return key;
  } catch {
    // not a JWT
  }
  return DEFAULT_SUPABASE_KEY;
}

export const SUPABASE_ANON_KEY = resolveAnonKey();

/**
 * The public domain. In production, links (emails, auth callbacks) always use it, and the production
 * *.vercel.app alias redirects here (see middleware). Set CANONICAL_HOST=off to disable, or to another host.
 */
export const CANONICAL_HOST = (process.env.CANONICAL_HOST || "foundryready.org").trim().toLowerCase();
export const CANONICAL_ENABLED = CANONICAL_HOST !== "off" && process.env.VERCEL_ENV === "production";

function resolveSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  // A leftover *.vercel.app site URL would put the temporary address in every email; prefer the real domain.
  if (CANONICAL_ENABLED && (!configured || /\.vercel\.app/i.test(configured))) return `https://${CANONICAL_HOST}`;
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
