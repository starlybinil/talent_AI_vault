import "server-only";

import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function clientIp(): Promise<string | null> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
}

export async function audit(
  supabase: SupabaseClient,
  action: string,
  entity: string,
  entityId: string | null,
  metadata: Record<string, unknown> = {},
) {
  await supabase.rpc("log_audit", {
    p_action: action,
    p_entity: entity,
    p_entity_id: entityId,
    p_metadata: metadata,
    p_ip: await clientIp(),
  });
}
