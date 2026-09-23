"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertPermission } from "@/lib/session";
import { fail, ok, type ActionState } from "@/lib/action-state";
import { errorMessage } from "@/lib/utils";
import { audit } from "@/lib/audit";

export async function toggleShortlist(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await assertPermission("employer.portal");
  } catch (e) {
    return fail(errorMessage(e));
  }
  const appId = String(formData.get("application_id") || "");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("employer_toggle_shortlist", { p_app: appId });
  if (error) return fail(errorMessage(error));
  await audit(supabase, data ? "employer.shortlist.add" : "employer.shortlist.remove", "application", appId);
  revalidatePath("/employer/candidates");
  revalidatePath(`/employer/candidates/${appId}`);
  return ok(data ? "Added to shortlist." : "Removed from shortlist.");
}

export async function addEmployerNote(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await assertPermission("employer.portal");
  } catch (e) {
    return fail(errorMessage(e));
  }
  const appId = String(formData.get("application_id") || "");
  const kind = String(formData.get("kind") || "note");
  const body = String(formData.get("body") || "").trim();
  if (!["note", "interview_interest", "exam_result_proposal"].includes(kind)) return fail("Unknown note type.");
  if (!body) return fail("Write a note first.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("employer_add_note", { p_app: appId, p_kind: kind, p_body: body });
  if (error) return fail(errorMessage(error));
  await audit(supabase, `employer.note.${kind}`, "application", appId);
  revalidatePath(`/employer/candidates/${appId}`);
  return ok("Shared with the admissions team.");
}
