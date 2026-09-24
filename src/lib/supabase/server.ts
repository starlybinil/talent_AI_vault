import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { DEFAULT_SUPABASE_KEY, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";

/** Supabase client acting as the signed-in user (RLS applies). */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component — middleware refreshes the session instead.
        }
      },
    },
  });
}

/** Anonymous client for public reads (no cookies, cacheable). */
export function createPublicClient() {
  return createPlainClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false }, global: { fetch: publicFetch } });
}

/** Public pages must not go blank over a bad key setting: on 401, retry once with the project's own public key. */
const publicFetch: typeof fetch = async (input, init) => {
  const res = await fetch(input, init);
  if (res.status !== 401 || SUPABASE_ANON_KEY === DEFAULT_SUPABASE_KEY || !SUPABASE_URL.includes("oyyksxbizrzmzdtwlucn")) return res;
  console.error("Supabase rejected NEXT_PUBLIC_SUPABASE_ANON_KEY (401); retrying with the project's public key. Fix the Vercel env var.");
  const headers = new Headers(init?.headers);
  headers.set("apikey", DEFAULT_SUPABASE_KEY);
  if (headers.get("authorization") === `Bearer ${SUPABASE_ANON_KEY}`) headers.set("authorization", `Bearer ${DEFAULT_SUPABASE_KEY}`);
  return fetch(input, { ...init, headers });
};

/** Service-role client. Only used by the cron job; returns null when the key isn't configured. */
export function createServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createPlainClient(SUPABASE_URL, key, { auth: { persistSession: false } });
}
