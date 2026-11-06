"use server";

import { redirect } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/utils";

const TYPES: EmailOtpType[] = ["signup", "magiclink", "recovery", "invite", "email_change", "email"];

/** Verify an emailed sign-in link on the server (works in any browser, unlike the code exchange). */
export async function confirmLink(formData: FormData) {
  const tokenHash = String(formData.get("token_hash") || "");
  const type = String(formData.get("type") || "") as EmailOtpType;
  const next = safeNext(String(formData.get("next") || ""), type === "recovery" ? "/reset-password" : "/portal");
  if (!tokenHash || !TYPES.includes(type)) redirect(`/login?error=link&next=${encodeURIComponent(next)}`);
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  if (error) redirect(`/login?error=${type === "recovery" ? "reset_link" : "link"}&next=${encodeURIComponent(next)}`);
  redirect(type === "recovery" ? "/reset-password" : `/auth/after?next=${encodeURIComponent(next)}`);
}
