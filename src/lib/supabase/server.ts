import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";

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
  return createPlainClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
}

/** Service-role client. Only used by the cron job; returns null when the key isn't configured. */
export function createServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createPlainClient(SUPABASE_URL, key, { auth: { persistSession: false } });
}
