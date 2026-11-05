"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/session";
import { can } from "@/lib/rbac";
import { notifyTemplate } from "@/lib/notify";
import { audit } from "@/lib/audit";
import { fail, ok, type ActionState } from "@/lib/action-state";
import { errorMessage } from "@/lib/utils";

/** Instructors, cohort managers and program admins; the database decides which sessions each may run. */
async function staff() {
  const s = await getSession();
  if (!s || !(can(s.roles, "cohorts.teach") || can(s.roles, "cohorts.track"))) throw new Error("You don't have permission to do that.");
  return s;
}

const num = (v: FormDataEntryValue | null) => {
  const n = Number(v);
  return v === null || v === "" || !Number.isFinite(n) ? null : n;
};

export async function startCheckin(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await staff();
  } catch (e) {
    return fail(errorMessage(e));
  }
  const sessionId = String(formData.get("session_id") || "");
  const supabase = await createClient();
  const { error } = await supabase.rpc("checkin_open", { p_session: sessionId, p_lat: num(formData.get("lat")), p_lng: num(formData.get("lng")) });
  if (error) return fail(errorMessage(error));
  revalidatePath(`/sessions/${sessionId}`);
  redirect(`/sessions/${sessionId}/screen`);
}

export async function adjustCheckin(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await staff();
  } catch (e) {
    return fail(errorMessage(e));
  }
  const windowId = String(formData.get("window_id") || "");
  const sessionId = String(formData.get("session_id") || "");
  const action = formData.get("action") === "extend" ? "extend" : "close";
  const supabase = await createClient();
  const { error } = await supabase.rpc("checkin_adjust", { p_window: windowId, p_action: action });
  if (error) return fail(errorMessage(error));
  revalidatePath(`/sessions/${sessionId}`);
  return ok(action === "extend" ? "Check-in extended by 5 minutes." : "Check-in closed.");
}

/** Everyone not checked in becomes Absent; optionally email them "We missed you today". */
export async function markRestAbsent(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await staff();
  } catch (e) {
    return fail(errorMessage(e));
  }
  const sessionId = String(formData.get("session_id") || "");
  const sendEmails = formData.get("send_emails") === "on";
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("session_mark_rest_absent", { p_session: sessionId });
  if (error) return fail(errorMessage(error));
  const ids = (data as string[]) ?? [];
  if (sendEmails && ids.length) {
    const { data: s } = await supabase.from("cohort_sessions").select("session_date").eq("id", sessionId).maybeSingle();
    for (const id of ids) await notifyTemplate(supabase, id, "missed_session", { sessionDate: s?.session_date ?? null });
    await audit(supabase, "checkin.missed_emails", "session", sessionId, { count: ids.length });
  }
  revalidatePath(`/sessions/${sessionId}`);
  if (!ids.length) return ok("Everyone already has attendance recorded for this session.");
  return ok(`${ids.length} marked Absent${sendEmails ? ' and emailed "We missed you today"' : ""}.`);
}

/** Cohort manager review of a flagged check-in: keep it, or mark Absent. */
export async function reviewCheckin(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let session;
  try {
    session = await staff();
  } catch (e) {
    return fail(errorMessage(e));
  }
  if (!can(session.roles, "cohorts.track")) return fail("Only cohort managers review flagged check-ins.");
  const sessionId = String(formData.get("session_id") || "");
  const appId = String(formData.get("application_id") || "");
  const decision = String(formData.get("decision") || "keep");
  const supabase = await createClient();
  const patch: Record<string, unknown> = { flag_reviewed_at: new Date().toISOString(), flag_reviewed_by: session.userId };
  if (decision === "absent") patch.status = "absent";
  const { error } = await supabase.from("session_attendance").update(patch).eq("session_id", sessionId).eq("application_id", appId);
  if (error) return fail(errorMessage(error));
  await audit(supabase, "checkin.review", "session", sessionId, { application: appId, decision });
  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/cohorts", "layout");
  return ok(decision === "absent" ? "Marked Absent." : "Check-in accepted.");
}

export type CheckInResult = { ok: true; status: string; already: boolean; flag: string | null; at: string } | { ok: false; error: string };

/** Trainee check-in from the QR page or the portal code box. */
export async function checkIn(input: {
  windowId: string | null;
  code: string;
  lat?: number | null;
  lng?: number | null;
  accuracy?: number | null;
  device?: string | null;
}): Promise<CheckInResult> {
  const s = await getSession();
  if (!s) return { ok: false, error: "Please sign in to check in." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("trainee_check_in", {
    p_window: input.windowId,
    p_code: input.code,
    p_lat: input.lat ?? null,
    p_lng: input.lng ?? null,
    p_accuracy: input.accuracy ?? null,
    p_device: input.device ?? null,
  });
  if (error) return { ok: false, error: errorMessage(error) };
  const r = data as { status: string; already: boolean; flag: string | null; checked_in_at: string };
  revalidatePath("/portal", "layout");
  return { ok: true, status: r.status, already: r.already, flag: r.flag, at: r.checked_in_at };
}

/** Open (creating if needed) today's session for a cohort, then go to it. */
export async function openToday(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await staff();
  } catch (e) {
    return fail(errorMessage(e));
  }
  const cohortId = String(formData.get("cohort_id") || "");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ensure_today_session", { p_cohort: cohortId });
  if (error) return fail(errorMessage(error));
  redirect(`/sessions/${data as string}`);
}
