"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { assertPermission } from "@/lib/session";
import { emailContext, notifyStatus, notifyTemplate } from "@/lib/notify";
import { sendEmail } from "@/lib/email";
import { audit } from "@/lib/audit";
import { fail, ok, type ActionState } from "@/lib/action-state";
import { cohortSchema, EMPLOYER_FIELD_OPTIONS, locationSchema } from "@/lib/validation";
import { STATUS_LABEL, type Status } from "@/lib/workflow";
import { errorMessage } from "@/lib/utils";
import { ROLE_LABEL, ROLES, type Role } from "@/lib/rbac";

// ---------------------------------------------------------------------------
// Admissions workflow
// ---------------------------------------------------------------------------

export type AdminOp =
  | "start_screening"
  | "pass_and_invite"
  | "send_invite"
  | "send_reminder"
  | "exam_passed"
  | "exam_failed"
  | "not_selected"
  | "accept"
  | "assign_cohort"
  | "release_seat"
  | "confirm"
  | "reset"
  | "withdraw";

async function defaultExamUrl(supabase: SupabaseClient, appId: string): Promise<string | null> {
  const { data } = await supabase.from("applications").select("programs(default_exam_url)").eq("id", appId).maybeSingle();
  const p = data?.programs as { default_exam_url: string | null } | { default_exam_url: string | null }[] | null | undefined;
  return (Array.isArray(p) ? p[0] : p)?.default_exam_url ?? null;
}

async function emailPromoted(supabase: SupabaseClient, ids: string[] | null | undefined) {
  for (const id of ids ?? []) await notifyTemplate(supabase, id, "waitlist_promoted");
}

/** Runs one workflow operation on one application. Returns an error message or null. */
async function runOp(supabase: SupabaseClient, appId: string, op: AdminOp, note: string | null, extra: { examUrl?: string; cohortId?: string }) {
  const transition = async (to: Status) => {
    const { error } = await supabase.rpc("admin_transition", { p_app: appId, p_to: to, p_note: note });
    return error;
  };
  let error: { message: string } | null = null;

  switch (op) {
    case "start_screening":
      error = await transition("screening");
      break;
    case "pass_and_invite":
    case "send_invite": {
      if (op === "pass_and_invite") {
        const { data } = await supabase.from("applications").select("status").eq("id", appId).maybeSingle();
        if (data?.status === "submitted") error = await transition("screening");
        if (!error) error = await transition("screening_passed");
        if (error) break;
      }
      const url = extra.examUrl?.trim() || (await defaultExamUrl(supabase, appId));
      if (!url) return "Set an exam link (or a default link on the program).";
      ({ error } = await supabase.rpc("admin_send_exam_invite", { p_app: appId, p_url: url, p_note: note }));
      if (!error) await notifyStatus(supabase, appId, { note });
      break;
    }
    case "send_reminder": {
      const { data } = await supabase.from("applications").select("status").eq("id", appId).maybeSingle();
      if (data?.status !== "exam_invited") return "Reminders can only be sent while the assessment is open.";
      await notifyTemplate(supabase, appId, "exam_reminder");
      ({ error } = await supabase.rpc("admin_record_exam_reminder", { p_app: appId }));
      break;
    }
    case "exam_passed":
    case "exam_failed":
      ({ error } = await supabase.rpc("admin_record_exam_result", { p_app: appId, p_passed: op === "exam_passed", p_note: note }));
      if (!error) await notifyStatus(supabase, appId, { note });
      break;
    case "not_selected":
      // A reason is required. It's saved on the application's timeline (visible to the applicant only after
      // signing in) and deliberately left out of the email.
      if (!note) return "Choose or write the reason this applicant was not selected.";
      error = await transition("not_selected");
      if (!error) await notifyStatus(supabase, appId);
      break;
    case "accept":
      // Assessment passed -> accepted into the program; enrollment (cohort choice + agreements) opens.
      error = await transition("cohort_selection");
      if (!error) await notifyStatus(supabase, appId, { note });
      break;
    case "assign_cohort": {
      if (!extra.cohortId) return "Choose a cohort.";
      const { data, error: e } = await supabase.rpc("admin_assign_cohort", { p_app: appId, p_cohort: extra.cohortId, p_note: note });
      error = e;
      if (!error) {
        // Placement is announced only when admissions confirms (the "confirmed" email names the cohort).
        // If this placement took them off the waitlist, just prompt them to sign their agreements.
        const { data: evs } = await supabase
          .from("application_events")
          .select("from_status, to_status")
          .eq("application_id", appId)
          .order("created_at", { ascending: false })
          .limit(3);
        if ((evs ?? []).some((e) => e.to_status === "cohort_registered" && e.from_status === "waitlisted")) {
          await notifyTemplate(supabase, appId, "waitlist_promoted");
        }
        await emailPromoted(supabase, (data as { promoted: string[] })?.promoted);
      }
      break;
    }
    case "release_seat": {
      const { data, error: e } = await supabase.rpc("admin_release_seat", { p_app: appId, p_note: note });
      error = e;
      if (!error) {
        await notifyTemplate(supabase, appId, "status_update", { note, statusLabel: STATUS_LABEL.cohort_selection });
        await emailPromoted(supabase, data as string[]);
      }
      break;
    }
    case "confirm":
      error = await transition("confirmed");
      if (!error) await notifyStatus(supabase, appId, { note });
      break;
    case "reset": {
      // The application is removed (snapshot kept in the audit log), so capture the email details first and
      // send only once the reset has succeeded.
      const ctx = await emailContext(supabase, appId);
      const { data, error: e } = await supabase.rpc("admin_reset_application", { p_app: appId, p_note: note });
      error = e;
      if (!error) {
        if (ctx) await sendEmail(supabase, "application_reset", { ...ctx, applicationId: "" });
        await emailPromoted(supabase, data as string[]);
      }
      break;
    }
    case "withdraw": {
      const { data, error: e } = await supabase.rpc("admin_withdraw", { p_app: appId, p_note: note });
      error = e;
      if (!error) {
        await notifyTemplate(supabase, appId, "status_update", { note, statusLabel: STATUS_LABEL.withdrawn });
        await emailPromoted(supabase, data as string[]);
      }
      break;
    }
  }
  return error ? errorMessage(error) : null;
}

export async function adminAct(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await assertPermission("admissions.manage");
  } catch (e) {
    return fail(errorMessage(e));
  }
  const appId = String(formData.get("application_id") || "");
  const op = String(formData.get("op") || "") as AdminOp;
  const reasonPick = String(formData.get("reason") || "");
  const reasonText = String(formData.get("note") || "").trim();
  // Not selected: a canned reason, optionally with extra detail (or free text when "Other" is picked).
  const note =
    op === "not_selected"
      ? [reasonPick === "other" ? "" : reasonPick, reasonText].filter(Boolean).join(" ").slice(0, 1000) || null
      : reasonText || null;
  const supabase = await createClient();
  const err = await runOp(supabase, appId, op, note, {
    examUrl: String(formData.get("exam_url") || ""),
    cohortId: String(formData.get("cohort_id") || ""),
  });
  if (err) return fail(err);
  await audit(supabase, `workflow.${op}`, "application", appId, note ? { note } : {});
  revalidatePath(`/admin/applications/${appId}`);
  revalidatePath("/admin/applications");
  if (op === "reset") redirect("/admin/applications?reset=1");
  return ok("Done — the applicant has been notified where applicable.");
}

// ---------------------------------------------------------------------------
// Program outcomes: completion and hire (visible to the applicant and partner employers)
// ---------------------------------------------------------------------------

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function outcomeDone(appId: string, message: string): ActionState {
  revalidatePath(`/admin/applications/${appId}`);
  revalidatePath("/admin/applications");
  revalidatePath("/admin/cohorts");
  return ok(message);
}

export async function recordCompletion(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await assertPermission("admissions.manage");
  } catch (e) {
    return fail(errorMessage(e));
  }
  const appId = String(formData.get("application_id") || "");
  const completedOn = String(formData.get("completed_on") || "");
  const note = String(formData.get("completion_note") || "").trim().slice(0, 500);
  if (!DATE_RE.test(completedOn)) return fail("Enter the completion date.");
  const supabase = await createClient();
  const { data: before } = await supabase.from("applications").select("status").eq("id", appId).maybeSingle();
  const { error } = await supabase.rpc("admin_record_completion", { p_app: appId, p_completed_on: completedOn, p_note: note || null });
  if (error) return fail(errorMessage(error));
  const firstTime = before?.status === "confirmed";
  if (firstTime) await notifyStatus(supabase, appId);
  await audit(supabase, firstTime ? "outcome.completed" : "outcome.completion_updated", "application", appId, { completed_on: completedOn });
  return outcomeDone(appId, firstTime ? "Program completion recorded. The trainee has been emailed and employers can now see it." : "Completion details updated.");
}

export async function recordHire(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await assertPermission("admissions.manage");
  } catch (e) {
    return fail(errorMessage(e));
  }
  const appId = String(formData.get("application_id") || "");
  const orgId = String(formData.get("employer_org_id") || "");
  const employerName = String(formData.get("employer_name") || "").trim().slice(0, 120);
  const jobTitle = String(formData.get("job_title") || "").trim().slice(0, 120);
  const startDate = String(formData.get("start_date") || "");
  const note = String(formData.get("note") || "").trim().slice(0, 500);
  if (!orgId && !employerName) return fail("Choose the hiring employer, or type its name.");
  if (startDate && !DATE_RE.test(startDate)) return fail("Enter a valid start date.");
  const supabase = await createClient();
  const { data: before } = await supabase.from("applications").select("status").eq("id", appId).maybeSingle();
  const { error } = await supabase.rpc("admin_record_hire", {
    p_app: appId,
    p_org: orgId || null,
    p_employer_name: orgId ? null : employerName,
    p_job_title: jobTitle || null,
    p_start_date: startDate || null,
    p_note: note || null,
  });
  if (error) return fail(errorMessage(error));
  const firstTime = before?.status === "completed";
  if (firstTime) await notifyStatus(supabase, appId);
  await audit(supabase, firstTime ? "outcome.hired" : "outcome.hire_updated", "application", appId, { employer_org_id: orgId || null, employer_name: employerName || null });
  return outcomeDone(appId, firstTime ? "Hire recorded. The graduate has been emailed and partner employers can see it." : "Hire details updated.");
}

export async function undoOutcome(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await assertPermission("admissions.manage");
  } catch (e) {
    return fail(errorMessage(e));
  }
  const appId = String(formData.get("application_id") || "");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_undo_outcome", { p_app: appId, p_note: null });
  if (error) return fail(errorMessage(error));
  const status = (data as { status: Status } | null)?.status;
  await audit(supabase, "outcome.undo", "application", appId, { now: status });
  return outcomeDone(appId, status === "completed" ? "Hire record removed." : "Completion record removed.");
}

export async function bulkAct(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await assertPermission("admissions.manage");
  } catch (e) {
    return fail(errorMessage(e));
  }
  const ids = formData.getAll("ids").map(String).filter(Boolean);
  const op = String(formData.get("op") || "") as AdminOp;
  // "Not selected" needs a per-applicant reason, so it's done from the application page.
  const allowed: AdminOp[] = ["pass_and_invite", "send_invite", "send_reminder", "accept", "confirm"];
  if (!allowed.includes(op)) return fail("Choose a bulk action.");
  if (!ids.length) return fail("Select at least one application.");
  const supabase = await createClient();
  const failures: string[] = [];
  for (const id of ids) {
    const err = await runOp(supabase, id, op, null, {});
    if (err) failures.push(`${id.slice(0, 8)}: ${err}`);
  }
  await audit(supabase, `workflow.bulk.${op}`, "application", null, { count: ids.length, failures: failures.length });
  revalidatePath("/admin/applications");
  if (failures.length) return fail(`${ids.length - failures.length} updated, ${failures.length} skipped — ${failures.slice(0, 3).join("; ")}`);
  return ok(`${ids.length} application${ids.length === 1 ? "" : "s"} updated.`);
}

export async function adminMessage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let session;
  try {
    session = await assertPermission("admissions.manage");
  } catch (e) {
    return fail(errorMessage(e));
  }
  const appId = String(formData.get("application_id") || "");
  const body = String(formData.get("body") || "").trim();
  const internal = formData.get("internal") === "on";
  if (!body) return fail("Write a message first.");
  const supabase = await createClient();
  const { error } = await supabase.from("messages").insert({ application_id: appId, sender_id: session.userId, body, internal });
  if (error) return fail(errorMessage(error));
  if (!internal) await notifyTemplate(supabase, appId, "new_message", { messagePreview: body });
  revalidatePath(`/admin/applications/${appId}`);
  return ok(internal ? "Internal note saved." : "Message sent and applicant notified by email.");
}

// ---------------------------------------------------------------------------
// Cohorts
// ---------------------------------------------------------------------------

export async function saveCohort(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await assertPermission("cohorts.manage");
  } catch (e) {
    return fail(errorMessage(e));
  }
  const parsed = cohortSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues.map((i) => `${String(i.path[0])}: ${i.message}`).join(", "));
  if (parsed.data.end_date < parsed.data.start_date) return fail("End date must be after the start date.");
  const id = String(formData.get("id") || "");
  const supabase = await createClient();
  // Unticked checkboxes aren't submitted, so absence means "hidden".
  const row = { ...parsed.data, visible_to_applicants: formData.get("visible_to_applicants") === "on" };
  const { error } = id ? await supabase.from("cohorts").update(row).eq("id", id) : await supabase.from("cohorts").insert(row);
  if (error) return fail(errorMessage(error));

  // If capacity grew, fill new seats from the waitlist.
  if (id) {
    const { data: promoted } = await supabase.rpc("admin_promote_waitlist", { p_cohort: id });
    await emailPromoted(supabase, promoted as string[]);
  }
  await audit(supabase, id ? "cohort.update" : "cohort.create", "cohort", id || null, { name: row.name });
  revalidatePath("/admin/cohorts");
  return ok(id ? "Cohort updated." : "Cohort created.");
}

export async function deleteCohort(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await assertPermission("cohorts.manage");
  } catch (e) {
    return fail(errorMessage(e));
  }
  const cohortId = String(formData.get("cohort_id") || "");
  const note = String(formData.get("note") || "").trim().slice(0, 500);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_delete_cohort", { p_cohort: cohortId, p_note: note || null });
  if (error) return fail(errorMessage(error));
  for (const id of (data as string[]) ?? []) {
    await notifyTemplate(supabase, id, "status_update", {
      statusLabel: STATUS_LABEL.cohort_selection,
      note: `The cohort you were in has been cancelled${note ? ` (${note})` : ""}. We're sorry for the change. Your application is still active: log in and choose your new top 3 cohorts.`,
    });
  }
  revalidatePath("/admin/cohorts");
  redirect("/admin/cohorts?deleted=1");
}

// ---------------------------------------------------------------------------
// Training locations
// ---------------------------------------------------------------------------

export async function saveLocation(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await assertPermission("cohorts.manage");
  } catch (e) {
    return fail(errorMessage(e));
  }
  const parsed = locationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues.map((i) => `${String(i.path[0])}: ${i.message}`).join(", "));
  const id = String(formData.get("id") || "");
  const row = { ...parsed.data, notes: parsed.data.notes || null, ...(id ? { active: formData.get("active") === "on" } : {}) };
  const supabase = await createClient();
  const { error } = id ? await supabase.from("training_locations").update(row).eq("id", id) : await supabase.from("training_locations").insert(row);
  if (error) {
    if (error.message.includes("training_locations_name")) return fail("A location with that name already exists.");
    return fail(errorMessage(error));
  }
  await audit(supabase, id ? "location.update" : "location.create", "training_location", id || null, { name: row.name });
  revalidatePath("/admin/locations");
  revalidatePath("/admin/cohorts");
  return ok(id ? "Location updated. Cohorts at this location now show the new details." : "Location added.");
}

export async function deleteLocation(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await assertPermission("cohorts.manage");
  } catch (e) {
    return fail(errorMessage(e));
  }
  const id = String(formData.get("id") || "");
  const supabase = await createClient();
  const { count } = await supabase.from("cohorts").select("id", { count: "exact", head: true }).eq("location_id", id);
  if (count) return fail(`${count} cohort(s) use this location. Move them to another location first, or mark this one inactive to hide it.`);
  const { error } = await supabase.from("training_locations").delete().eq("id", id);
  if (error) return fail(errorMessage(error));
  await audit(supabase, "location.delete", "training_location", id, {});
  revalidatePath("/admin/locations");
  return ok("Location deleted.");
}

export async function promoteWaitlist(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await assertPermission("cohorts.manage");
  } catch (e) {
    return fail(errorMessage(e));
  }
  const cohortId = String(formData.get("cohort_id") || "");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_promote_waitlist", { p_cohort: cohortId });
  if (error) return fail(errorMessage(error));
  const ids = (data as string[]) ?? [];
  await emailPromoted(supabase, ids);
  revalidatePath(`/admin/cohorts/${cohortId}`);
  return ok(ids.length ? `Promoted ${ids.length} applicant(s) from the waitlist.` : "No open seats or nobody waiting.");
}

// ---------------------------------------------------------------------------
// Cohort hub: instructors & announcements
// ---------------------------------------------------------------------------

export async function addCohortInstructor(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await assertPermission("cohorts.manage");
  } catch (e) {
    return fail(errorMessage(e));
  }
  const cohortId = String(formData.get("cohort_id") || "");
  const name = String(formData.get("name") || "").trim();
  const role = String(formData.get("role") || "").trim() || "Instructor";
  const email = String(formData.get("email") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  if (name.length < 2 || name.length > 120) return fail("Enter the instructor's name.");
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail("That email address doesn't look right.");
  const supabase = await createClient();
  const { count } = await supabase.from("cohort_instructors").select("id", { count: "exact", head: true }).eq("cohort_id", cohortId);
  const { error } = await supabase.from("cohort_instructors").insert({
    cohort_id: cohortId,
    name,
    role: role.slice(0, 80),
    email: email || null,
    phone: phone.slice(0, 40) || null,
    sort: count ?? 0,
  });
  if (error) return fail(errorMessage(error));
  await audit(supabase, "cohort.instructor.add", "cohort", cohortId, { name, role });
  revalidatePath(`/admin/cohorts/${cohortId}`);
  return ok(`${name} added to this cohort.`);
}

export async function removeCohortInstructor(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await assertPermission("cohorts.manage");
  } catch (e) {
    return fail(errorMessage(e));
  }
  const id = String(formData.get("id") || "");
  const supabase = await createClient();
  const { data: row, error } = await supabase.from("cohort_instructors").delete().eq("id", id).select("cohort_id, name").maybeSingle();
  if (error) return fail(errorMessage(error));
  if (row) {
    await audit(supabase, "cohort.instructor.remove", "cohort", row.cohort_id, { name: row.name });
    revalidatePath(`/admin/cohorts/${row.cohort_id}`);
  }
  return ok("Instructor removed.");
}

/** Statuses that count as "placed in" a cohort, by announcement audience. */
const ANNOUNCE_STATUSES = {
  trainees: ["confirmed"],
  all_placed: ["confirmed", "cohort_registered", "agreements_pending", "agreements_submitted"],
} as const;

export async function sendCohortAnnouncement(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await assertPermission("cohorts.manage");
  } catch (e) {
    return fail(errorMessage(e));
  }
  const cohortId = String(formData.get("cohort_id") || "");
  const subject = String(formData.get("subject") || "").trim();
  const body = String(formData.get("body") || "").trim();
  const audience = String(formData.get("audience") || "trainees") === "all_placed" ? "all_placed" : "trainees";
  if (subject.length < 3 || subject.length > 150) return fail("Add a subject (3–150 characters).");
  if (body.length < 3 || body.length > 5000) return fail("Write a message (up to 5,000 characters).");

  const supabase = await createClient();
  const { data: cohort } = await supabase
    .from("cohorts")
    .select("name, format, start_date, end_date, schedule, location, address, programs(short_name, employer_partner, slug)")
    .eq("id", cohortId)
    .maybeSingle();
  if (!cohort) return fail("Cohort not found.");
  const { data: recipients, error: rErr } = await supabase
    .from("applications")
    .select("id, email, first_name")
    .eq("assigned_cohort_id", cohortId)
    .in("status", [...ANNOUNCE_STATUSES[audience]]);
  if (rErr) return fail(errorMessage(rErr));
  const list = recipients ?? [];
  if (list.length === 0) return fail("Nobody in this cohort matches that audience yet, so nothing was sent.");

  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase.from("cohort_announcements").insert({
    cohort_id: cohortId,
    subject,
    body,
    audience,
    recipients: list.length,
    sent_by: userData.user?.id ?? null,
  });
  if (error) return fail(errorMessage(error));

  const prog = (Array.isArray(cohort.programs) ? cohort.programs[0] : cohort.programs) as {
    short_name: string;
    employer_partner: string | null;
    slug: string;
  } | null;
  const { programs: _p, ...cohortInfo } = cohort;
  void _p;
  let failed = 0;
  for (const r of list) {
    const res = await sendEmail(supabase, "cohort_announcement", {
      applicationId: r.id,
      to: r.email,
      firstName: r.first_name,
      programName: prog?.short_name ?? "FoundryReady program",
      employerPartner: prog?.employer_partner ?? null,
      programSlug: prog?.slug ?? null,
      cohort: cohortInfo,
      announcement: { subject, body },
    });
    if (res.status === "failed") failed++;
  }
  await audit(supabase, "cohort.announcement.send", "cohort", cohortId, { subject, audience, recipients: list.length, failed });
  revalidatePath(`/admin/cohorts/${cohortId}`);
  return failed
    ? fail(`Announcement saved, but ${failed} of ${list.length} emails failed. Check the email log.`)
    : ok(`Announcement sent to ${list.length} ${list.length === 1 ? "person" : "people"}.`);
}

// ---------------------------------------------------------------------------
// Programs & agreements
// ---------------------------------------------------------------------------

function parseJson(formData: FormData, key: string): unknown {
  const raw = String(formData.get(key) || "").trim();
  if (!raw) return [];
  return JSON.parse(raw);
}

/** Free-text program columns edited in the program form. */
const PROGRAM_TEXT_FIELDS = [
  "academic_partner",
  "employer_partner",
  "industry",
  "career_role",
  "hero_headline",
  "hero_highlight",
  "why_headline",
  "outcome_badge",
  "outcome_title",
  "outcome_detail",
  "hero_poster",
  "hero_video",
  "learn_more_url",
] as const;

function lines(formData: FormData, key: string): string[] {
  return String(formData.get(key) || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 30);
}

export async function saveProgram(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let session;
  try {
    session = await assertPermission("content.manage").catch(() => assertPermission("programs.manage"));
  } catch (e) {
    return fail(errorMessage(e));
  }
  const id = String(formData.get("id") || "");
  const isAdmin = session.roles.includes("program_admin");
  const supabase = await createClient();
  let content: Record<string, unknown>;
  try {
    content = {
      name: String(formData.get("name") || "").trim(),
      short_name: String(formData.get("short_name") || "").trim(),
      partner_name: String(formData.get("partner_name") || "").trim() || null,
      tagline: String(formData.get("tagline") || "").trim() || null,
      summary: String(formData.get("summary") || "").trim() || null,
      hours_label: String(formData.get("hours_label") || "").trim() || null,
      cost_label: String(formData.get("cost_label") || "").trim() || null,
      duration_label: String(formData.get("duration_label") || "").trim() || null,
      eligibility: String(formData.get("eligibility") || "").trim() || null,
      topics: parseJson(formData, "topics"),
      formats: parseJson(formData, "formats"),
      faqs: parseJson(formData, "faqs"),
      stats: parseJson(formData, "stats"),
      ...Object.fromEntries(PROGRAM_TEXT_FIELDS.map((k) => [k, String(formData.get(k) || "").trim() || null])),
      audiences: lines(formData, "audiences"),
      keywords: lines(formData, "keywords"),
    };
  } catch {
    return fail("One of the JSON fields (topics, formats, FAQs, stats) is not valid JSON.");
  }
  if (!content.name || !content.short_name) return fail("Name and short name are required.");
  for (const k of ["hero_poster", "hero_video", "learn_more_url"] as const) {
    if (content[k] && !/^https:\/\//.test(String(content[k]))) return fail("Hero image, video and Learn more links must start with https://");
  }

  if (isAdmin) {
    const fields = formData.getAll("employer_visible_fields").map(String);
    const valid = new Set<string>(EMPLOYER_FIELD_OPTIONS.map((f) => f.key));
    content.employer_visible_fields = fields.filter((f) => valid.has(f));
    content.default_exam_url = String(formData.get("default_exam_url") || "").trim() || null;
    content.active = formData.get("active") === "on";
    content.featured = formData.get("featured") === "on";
    if (content.default_exam_url && !/^https:\/\//.test(String(content.default_exam_url))) return fail("Exam link must start with https://");
  }

  if (id) {
    const { error } = await supabase.from("programs").update(content).eq("id", id);
    if (error) return fail(errorMessage(error));
  } else {
    if (!isAdmin) return fail("Only program admins can create programs.");
    const slug = String(formData.get("slug") || "")
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    if (!slug) return fail("Slug is required.");
    const { error } = await supabase.from("programs").insert({ ...content, slug });
    if (error) return fail(errorMessage(error));
  }
  await audit(supabase, id ? "program.update" : "program.create", "program", id || null, {});
  revalidatePath("/admin/programs");
  revalidatePath("/", "layout");
  return ok("Program saved.");
}

export async function setProgramPartner(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await assertPermission("programs.manage");
  } catch (e) {
    return fail(errorMessage(e));
  }
  const programId = String(formData.get("program_id") || "");
  const orgId = String(formData.get("employer_org_id") || "");
  const remove = formData.get("remove") === "1";
  const supabase = await createClient();
  const { error } = remove
    ? await supabase.from("program_partners").delete().eq("program_id", programId).eq("employer_org_id", orgId)
    : await supabase.from("program_partners").insert({ program_id: programId, employer_org_id: orgId });
  if (error) return fail(errorMessage(error));
  await audit(supabase, remove ? "program.partner.remove" : "program.partner.add", "program", programId, { org: orgId });
  revalidatePath(`/admin/programs/${programId}`);
  return ok(remove ? "Partner removed." : "Partner added.");
}

export async function saveAgreementTemplate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await assertPermission("programs.manage");
  } catch (e) {
    return fail(errorMessage(e));
  }
  const id = String(formData.get("id") || "");
  const programId = String(formData.get("program_id") || "");
  const title = String(formData.get("title") || "").trim();
  const body = String(formData.get("body") || "").trim();
  const required = formData.get("required") === "on";
  const active = id ? formData.get("active") === "on" : true;
  if (!title || !body) return fail("Title and text are required.");
  const supabase = await createClient();
  if (id) {
    const { data: cur } = await supabase.from("agreement_templates").select("title, body, version").eq("id", id).maybeSingle();
    // Changing the text creates a new version, so applicants who haven't finished must re-sign it.
    const version = cur && (cur.body !== body || cur.title !== title) ? cur.version + 1 : cur?.version ?? 1;
    const { error } = await supabase.from("agreement_templates").update({ title, body, required, active, version }).eq("id", id);
    if (error) return fail(errorMessage(error));
  } else {
    const { error } = await supabase.from("agreement_templates").insert({ program_id: programId, title, body, required, active, sort: 99 });
    if (error) return fail(errorMessage(error));
  }
  await audit(supabase, "agreement_template.save", "program", programId, { title });
  revalidatePath(`/admin/programs/${programId}`);
  revalidatePath("/admin/agreements");
  return ok("Agreement saved.");
}

// ---------------------------------------------------------------------------
// IT admin: users, roles, settings
// ---------------------------------------------------------------------------

export async function grantRole(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await assertPermission("users.manage");
  } catch (e) {
    return fail(errorMessage(e));
  }
  const email = String(formData.get("email") || "").trim();
  const role = String(formData.get("role") || "") as Role;
  const org = String(formData.get("employer_org_id") || "") || null;
  if (!ROLES.includes(role)) return fail("Choose a role.");
  if (role === "employer" && !org) return fail("Choose the employer organization.");
  const supabase = await createClient();
  const { data: userId, error } = await supabase.rpc("it_grant_role", { p_email: email, p_role: role, p_org: org });
  if (error) return fail(errorMessage(error));
  revalidatePath("/admin/users");
  // Let the person know: an invitation to register, or a note that their access changed.
  const orgName = org ? (await supabase.from("employer_orgs").select("name").eq("id", org).maybeSingle()).data?.name ?? null : null;
  const { data: profile } = userId ? await supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle() : { data: null };
  const sent = await sendEmail(supabase, userId ? "role_granted" : "role_invite", {
    applicationId: null,
    to: email.toLowerCase(),
    firstName: (profile?.full_name ?? "").split(" ")[0] ?? "",
    programName: "",
    roleLabel: ROLE_LABEL[role],
    orgName,
  });
  const emailNote = sent.status === "sent" ? " An email is on its way." : sent.status === "simulated" ? " (Email simulated: Resend isn't connected yet.)" : " The email couldn't be sent; see the Email log.";
  if (!userId) return ok(`${email} has no account yet: invitation sent to register. The ${ROLE_LABEL[role]} role applies automatically when they sign up.${emailNote}`);
  return ok(`Granted ${ROLE_LABEL[role]} to ${email}.${emailNote}`);
}

export async function cancelPendingGrant(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await assertPermission("users.manage");
  } catch (e) {
    return fail(errorMessage(e));
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("it_cancel_pending_grant", { p_id: String(formData.get("grant_id") || "") });
  if (error) return fail(errorMessage(error));
  revalidatePath("/admin/users");
  return ok("Pending role cancelled.");
}

export async function revokeRole(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await assertPermission("users.manage");
  } catch (e) {
    return fail(errorMessage(e));
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("it_revoke_role", { p_role_id: String(formData.get("role_id") || "") });
  if (error) return fail(errorMessage(error));
  revalidatePath("/admin/users");
  return ok("Role revoked.");
}

export async function setUserActive(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await assertPermission("users.manage");
  } catch (e) {
    return fail(errorMessage(e));
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("it_set_user_active", {
    p_user: String(formData.get("user_id") || ""),
    p_active: formData.get("active") === "1",
  });
  if (error) return fail(errorMessage(error));
  revalidatePath("/admin/users");
  return ok("User updated.");
}

/** Permanently delete a user account (IT admins). The user's email must be typed to confirm. */
export async function deleteUser(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await assertPermission("users.manage");
  } catch (e) {
    return fail(errorMessage(e));
  }
  const userId = String(formData.get("user_id") || "");
  const confirmEmail = String(formData.get("confirm_email") || "").trim();
  if (!userId || !confirmEmail) return fail("Type the user's email address to confirm.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("it_delete_user", { p_user: userId, p_confirm_email: confirmEmail });
  if (error) return fail(errorMessage(error));

  // Uploaded files (resume, signatures, signed PDFs) live under the user's folder; removing them needs the
  // server-only service key. Without it the account is still deleted and the files are left in storage.
  let filesNote = "";
  const admin = createServiceClient();
  if (admin) {
    const bucket = admin.storage.from("applicant-files");
    const { data: files } = await bucket.list(userId, { limit: 1000 });
    const paths = (files ?? []).map((f) => `${userId}/${f.name}`);
    if (paths.length) await bucket.remove(paths);
  } else {
    filesNote = " Uploaded files were kept in storage (add SUPABASE_SERVICE_ROLE_KEY to remove them automatically).";
  }
  await emailPromoted(supabase, data as string[]);
  revalidatePath("/admin/users");
  return ok(`Account deleted.${filesNote}`);
}

// ---------------------------------------------------------------------------
// Program resources (shown to trainees on their "In program" tab)
// ---------------------------------------------------------------------------

export async function addProgramResource(input: {
  programId: string;
  cohortId: string | null;
  title: string;
  description: string;
  url: string | null;
  filePath: string | null;
  fileName: string | null;
}): Promise<ActionState> {
  try {
    await assertPermission("programs.manage");
  } catch (e) {
    return fail(errorMessage(e));
  }
  const title = input.title.trim();
  const url = input.url?.trim() || null;
  if (title.length < 2) return fail("Give the resource a title.");
  if (!url && !input.filePath) return fail("Add a link or upload a file.");
  if (url && !/^https:\/\//.test(url)) return fail("Links must start with https://");
  if (input.filePath && !input.filePath.startsWith(`${input.programId}/`)) return fail("Invalid file.");
  const supabase = await createClient();
  const { error } = await supabase.from("program_resources").insert({
    program_id: input.programId,
    cohort_id: input.cohortId || null,
    title: title.slice(0, 160),
    description: input.description.trim().slice(0, 500) || null,
    url,
    file_path: input.filePath,
    file_name: input.fileName?.slice(0, 200) ?? null,
  });
  if (error) return fail(errorMessage(error));
  await audit(supabase, "program_resource.create", "program", input.programId, { title });
  revalidatePath(`/admin/programs/${input.programId}`);
  return ok("Resource added. Trainees see it on their In program tab.");
}

export async function deleteProgramResource(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await assertPermission("programs.manage");
  } catch (e) {
    return fail(errorMessage(e));
  }
  const id = String(formData.get("resource_id") || "");
  const supabase = await createClient();
  const { data: row, error } = await supabase.from("program_resources").delete().eq("id", id).select("program_id, file_path, title").maybeSingle();
  if (error) return fail(errorMessage(error));
  if (row?.file_path) await supabase.storage.from("program-resources").remove([row.file_path]);
  if (row) await audit(supabase, "program_resource.delete", "program", row.program_id, { title: row.title });
  revalidatePath(`/admin/programs/${row?.program_id ?? ""}`);
  return ok("Resource removed.");
}

// ---------------------------------------------------------------------------
// Site media library (IT admins and web developers)
// ---------------------------------------------------------------------------

export async function addSiteMedia(input: { path: string; alt: string; caption: string }): Promise<ActionState> {
  try {
    await assertPermission("media.manage");
  } catch (e) {
    return fail(errorMessage(e));
  }
  const alt = input.alt.trim();
  if (alt.length < 3) return fail("Describe the photo in a few words (used for accessibility).");
  if (!/^[\w\-./]+$/.test(input.path)) return fail("Invalid file.");
  const supabase = await createClient();
  const { error } = await supabase.from("site_media").insert({ path: input.path, alt: alt.slice(0, 200), caption: input.caption.trim().slice(0, 120) || null, source: "upload" });
  if (error) return fail(errorMessage(error));
  await audit(supabase, "site_media.upload", "site_media", null, { path: input.path });
  revalidatePath("/admin/media");
  revalidatePath("/", "layout");
  return ok("Photo added. It now appears in rotation across the site.");
}

export async function updateSiteMedia(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await assertPermission("media.manage");
  } catch (e) {
    return fail(errorMessage(e));
  }
  const id = String(formData.get("media_id") || "");
  const op = String(formData.get("op") || "");
  const supabase = await createClient();
  if (op === "delete") {
    const { data: row, error } = await supabase.from("site_media").delete().eq("id", id).select("path").maybeSingle();
    if (error) return fail(errorMessage(error));
    if (row?.path) await supabase.storage.from("site-media").remove([row.path]);
    await audit(supabase, "site_media.delete", "site_media", id, {});
  } else {
    const { error } = await supabase.from("site_media").update({ active: op === "show" }).eq("id", id);
    if (error) return fail(errorMessage(error));
  }
  revalidatePath("/admin/media");
  revalidatePath("/", "layout");
  return ok(op === "delete" ? "Photo deleted." : op === "show" ? "Photo is back in rotation." : "Photo hidden from the site.");
}

export async function createEmployerOrg(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await assertPermission("users.manage");
  } catch (e) {
    return fail(errorMessage(e));
  }
  const name = String(formData.get("name") || "").trim();
  const domain = String(formData.get("domain") || "").trim() || null;
  if (!name) return fail("Organization name is required.");
  const supabase = await createClient();
  const { error } = await supabase.from("employer_orgs").insert({ name, domain });
  if (error) return fail(errorMessage(error));
  await audit(supabase, "employer_org.create", "employer_org", null, { name });
  revalidatePath("/admin/users");
  return ok("Organization created.");
}

export async function saveSetting(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await assertPermission("settings.manage");
  } catch (e) {
    return fail(errorMessage(e));
  }
  const key = String(formData.get("key") || "").trim();
  let value: unknown;
  try {
    value = JSON.parse(String(formData.get("value") || "null"));
  } catch {
    return fail("Value must be valid JSON (wrap text in double quotes).");
  }
  if (!/^[a-z0-9_]{2,60}$/.test(key)) return fail("Keys use lowercase letters, numbers and underscores.");
  const supabase = await createClient();
  const { error } = await supabase.from("system_settings").upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) return fail(errorMessage(error));
  await audit(supabase, "setting.save", "system_settings", key, {});
  revalidatePath("/admin/settings");
  return ok("Setting saved.");
}

// ---------------------------------------------------------------------------
// Web developer: site content & flags
// ---------------------------------------------------------------------------

export async function saveContent(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let session;
  try {
    session = await assertPermission("content.manage");
  } catch (e) {
    return fail(errorMessage(e));
  }
  const key = String(formData.get("key") || "").trim();
  let value: unknown;
  try {
    value = JSON.parse(String(formData.get("value") || "{}"));
  } catch {
    return fail("Content must be valid JSON.");
  }
  if (!/^[a-z0-9_]{2,60}$/.test(key)) return fail("Keys use lowercase letters, numbers and underscores.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("site_content")
    .upsert({ key, value, updated_by: session.userId, updated_at: new Date().toISOString() });
  if (error) return fail(errorMessage(error));
  await audit(supabase, "content.save", "site_content", key, {});
  revalidatePath("/", "layout");
  return ok("Content published.");
}

export async function toggleFlag(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await assertPermission("flags.manage");
  } catch (e) {
    return fail(errorMessage(e));
  }
  const key = String(formData.get("key") || "");
  const enabled = formData.get("enabled") === "1";
  const supabase = await createClient();
  const { error } = await supabase.from("feature_flags").update({ enabled, updated_at: new Date().toISOString() }).eq("key", key);
  if (error) return fail(errorMessage(error));
  await audit(supabase, "flag.toggle", "feature_flag", key, { enabled });
  revalidatePath("/", "layout");
  return ok(`${key} ${enabled ? "enabled" : "disabled"}.`);
}
