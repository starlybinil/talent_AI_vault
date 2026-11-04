"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertPermission } from "@/lib/session";
import { notifyTemplate } from "@/lib/notify";
import { audit } from "@/lib/audit";
import { fail, ok, type ActionState } from "@/lib/action-state";
import { errorMessage } from "@/lib/utils";
import { ATTENDANCE_STATUSES, TRAINEE_STATUSES, parseScore, sessionDates, type AttendanceStatus } from "@/lib/tracking";
import { statsByStudent } from "@/lib/tracking-data";

/** Cohort managers and program admins; the database (RLS) limits each write to cohorts they manage. */
async function guard() {
  return assertPermission("cohorts.track");
}

const refresh = (cohortId: string) => revalidatePath(`/cohorts/${cohortId}`, "layout");

// --- Modules -------------------------------------------------------------------------------------------------

export async function addModule(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await guard();
  } catch (e) {
    return fail(errorMessage(e));
  }
  const cohortId = String(formData.get("cohort_id") || "");
  const names = String(formData.get("name") || "")
    .split(/\n|,(?![^(]*\))/)
    .map((n) => n.trim())
    .filter(Boolean)
    .slice(0, 30);
  if (!names.length) return fail("Enter a module name.");
  if (names.some((n) => n.length > 120)) return fail("Module names must be 120 characters or fewer.");
  const supabase = await createClient();
  const { count } = await supabase.from("cohort_modules").select("id", { count: "exact", head: true }).eq("cohort_id", cohortId);
  const { error } = await supabase.from("cohort_modules").insert(names.map((name, i) => ({ cohort_id: cohortId, name, sort: (count ?? 0) + i })));
  if (error) return fail(errorMessage(error));
  await audit(supabase, "tracking.module.add", "cohort", cohortId, { names });
  refresh(cohortId);
  return ok(names.length === 1 ? `Added "${names[0]}".` : `Added ${names.length} modules.`);
}

export async function renameModule(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await guard();
  } catch (e) {
    return fail(errorMessage(e));
  }
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  if (!name || name.length > 120) return fail("Enter a module name (up to 120 characters).");
  const supabase = await createClient();
  const { data, error } = await supabase.from("cohort_modules").update({ name }).eq("id", id).select("cohort_id").maybeSingle();
  if (error) return fail(errorMessage(error));
  if (data) refresh(data.cohort_id);
  return ok("Renamed.");
}

export async function deleteModule(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await guard();
  } catch (e) {
    return fail(errorMessage(e));
  }
  const id = String(formData.get("id") || "");
  const supabase = await createClient();
  const { data, error } = await supabase.from("cohort_modules").delete().eq("id", id).select("cohort_id, name").maybeSingle();
  if (error) return fail(errorMessage(error));
  if (data) {
    await audit(supabase, "tracking.module.delete", "cohort", data.cohort_id, { name: data.name });
    refresh(data.cohort_id);
  }
  return ok("Module and its scores deleted.");
}

export async function moveModule(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await guard();
  } catch (e) {
    return fail(errorMessage(e));
  }
  const id = String(formData.get("id") || "");
  const dir = formData.get("dir") === "up" ? -1 : 1;
  const supabase = await createClient();
  const { data: me } = await supabase.from("cohort_modules").select("cohort_id").eq("id", id).maybeSingle();
  if (!me) return fail("Module not found.");
  const { data: all } = await supabase.from("cohort_modules").select("id").eq("cohort_id", me.cohort_id).order("sort").order("created_at");
  const ids = (all ?? []).map((m) => m.id as string);
  const i = ids.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= ids.length) return ok("");
  [ids[i], ids[j]] = [ids[j], ids[i]];
  for (let k = 0; k < ids.length; k++) await supabase.from("cohort_modules").update({ sort: k }).eq("id", ids[k]);
  refresh(me.cohort_id);
  return ok("");
}

// --- Grades --------------------------------------------------------------------------------------------------

/** Save the grade grid: each cell is a raw string ("" clears the score). */
export async function saveGrades(cohortId: string, cells: Array<{ module_id: string; application_id: string; raw: string }>): Promise<ActionState> {
  let session;
  try {
    session = await guard();
  } catch (e) {
    return fail(errorMessage(e));
  }
  const upserts: Array<{ module_id: string; application_id: string; score: number; updated_at: string; updated_by: string }> = [];
  const clears: Array<{ module_id: string; application_id: string }> = [];
  for (const c of cells.slice(0, 5000)) {
    const v = parseScore(c.raw);
    if (v === "invalid") return fail(`"${c.raw}" isn't a valid score. Use a number from 0 to 100.`);
    if (v === null) clears.push(c);
    else upserts.push({ module_id: c.module_id, application_id: c.application_id, score: v, updated_at: new Date().toISOString(), updated_by: session.userId });
  }
  const supabase = await createClient();
  if (upserts.length) {
    const { error } = await supabase.from("module_grades").upsert(upserts);
    if (error) return fail(errorMessage(error));
  }
  for (const c of clears) {
    const { error } = await supabase.from("module_grades").delete().eq("module_id", c.module_id).eq("application_id", c.application_id);
    if (error) return fail(errorMessage(error));
  }
  await audit(supabase, "tracking.grades.save", "cohort", cohortId, { saved: upserts.length, cleared: clears.length });
  refresh(cohortId);
  return ok(`Saved ${upserts.length + clears.length} change${upserts.length + clears.length === 1 ? "" : "s"}.`);
}

// --- Sessions & attendance -----------------------------------------------------------------------------------

export async function createSessionsFromSchedule(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await guard();
  } catch (e) {
    return fail(errorMessage(e));
  }
  const cohortId = String(formData.get("cohort_id") || "");
  const supabase = await createClient();
  const { data: c } = await supabase.from("cohorts").select("start_date, end_date, schedule").eq("id", cohortId).maybeSingle();
  if (!c) return fail("Cohort not found.");
  const dates = sessionDates(c);
  if (!dates.length) return fail("No class days found between the cohort's start and end dates.");
  const { error } = await supabase
    .from("cohort_sessions")
    .upsert(dates.map((d) => ({ cohort_id: cohortId, session_date: d })), { onConflict: "cohort_id,session_date", ignoreDuplicates: true });
  if (error) return fail(errorMessage(error));
  await audit(supabase, "tracking.sessions.generate", "cohort", cohortId, { count: dates.length });
  refresh(cohortId);
  return ok(`Class sessions created from the schedule (${dates.length} days).`);
}

export async function addSession(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await guard();
  } catch (e) {
    return fail(errorMessage(e));
  }
  const cohortId = String(formData.get("cohort_id") || "");
  const date = String(formData.get("date") || "");
  const note = String(formData.get("note") || "").trim().slice(0, 200) || null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail("Pick a date.");
  const supabase = await createClient();
  const { error } = await supabase.from("cohort_sessions").upsert({ cohort_id: cohortId, session_date: date, canceled: false, note }, { onConflict: "cohort_id,session_date" });
  if (error) return fail(errorMessage(error));
  refresh(cohortId);
  return ok("Session added.");
}

export async function setSessionCanceled(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await guard();
  } catch (e) {
    return fail(errorMessage(e));
  }
  const id = String(formData.get("id") || "");
  const canceled = formData.get("canceled") === "true";
  const supabase = await createClient();
  const { data, error } = await supabase.from("cohort_sessions").update({ canceled }).eq("id", id).select("cohort_id, session_date").maybeSingle();
  if (error) return fail(errorMessage(error));
  if (data) {
    await audit(supabase, canceled ? "tracking.session.cancel" : "tracking.session.restore", "cohort", data.cohort_id, { date: data.session_date });
    refresh(data.cohort_id);
  }
  return ok(canceled ? "Session canceled. It no longer counts toward attendance." : "Session restored.");
}

export async function saveAttendance(cohortId: string, sessionId: string, marks: Array<{ application_id: string; status: AttendanceStatus }>): Promise<ActionState> {
  let session;
  try {
    session = await guard();
  } catch (e) {
    return fail(errorMessage(e));
  }
  if (marks.some((m) => !(ATTENDANCE_STATUSES as readonly string[]).includes(m.status))) return fail("Invalid attendance status.");
  const supabase = await createClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("session_attendance")
    .upsert(marks.slice(0, 500).map((m) => ({ session_id: sessionId, application_id: m.application_id, status: m.status, updated_at: now, updated_by: session.userId })));
  if (error) return fail(errorMessage(error));
  await audit(supabase, "tracking.attendance.save", "cohort", cohortId, { session: sessionId, count: marks.length });
  refresh(cohortId);
  return ok(`Attendance saved for ${marks.length} student${marks.length === 1 ? "" : "s"}.`);
}

// --- Email ---------------------------------------------------------------------------------------------------

export async function emailStudents(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let session;
  try {
    session = await guard();
  } catch (e) {
    return fail(errorMessage(e));
  }
  const cohortId = String(formData.get("cohort_id") || "");
  const audience = String(formData.get("audience") || "all");
  const subject = String(formData.get("subject") || "").trim();
  const body = String(formData.get("body") || "").trim();
  if (subject.length < 3 || subject.length > 150) return fail("Add a subject (3–150 characters).");
  if (body.length < 3 || body.length > 5000) return fail("Write a message (up to 5,000 characters).");

  const supabase = await createClient();
  const { data: roster } = await supabase
    .from("applications")
    .select("id")
    .eq("assigned_cohort_id", cohortId)
    .in("status", [...TRAINEE_STATUSES]);
  let ids = (roster ?? []).map((r) => r.id as string);
  if (audience === "at_risk") {
    const stats = await statsByStudent(supabase, [cohortId]);
    ids = ids.filter((id) => stats.get(id)?.atRisk);
  } else if (audience === "selected") {
    const picked = new Set(formData.getAll("ids").map(String));
    ids = ids.filter((id) => picked.has(id));
  }
  if (!ids.length) return fail(audience === "selected" ? "Select at least one student on the roster." : "Nobody matches that audience, so nothing was sent.");

  if (audience === "all") {
    // Whole cohort: also kept as a cohort announcement, shown on every trainee's In program tab.
    const { error } = await supabase
      .from("cohort_announcements")
      .insert({ cohort_id: cohortId, subject, body, audience: "trainees", recipients: ids.length, sent_by: session.userId });
    if (error) return fail(errorMessage(error));
  }
  for (const id of ids) await notifyTemplate(supabase, id, audience === "all" ? "cohort_announcement" : "trainee_message", { announcement: { subject, body } });
  await audit(supabase, "tracking.email", "cohort", cohortId, { audience, recipients: ids.length, subject });
  refresh(cohortId);
  return ok(`Email sent to ${ids.length} student${ids.length === 1 ? "" : "s"}.`);
}

/**
 * Copy a cohort's module list to other cohorts. Modules a target already has (same name, any case) are skipped,
 * so copying twice never creates duplicates; scores are never copied.
 */
export async function copyModules(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await guard();
  } catch (e) {
    return fail(errorMessage(e));
  }
  const direction = String(formData.get("direction") || "to");
  const here = String(formData.get("cohort_id") || "");
  const picked = formData.getAll("cohort_ids").map(String).filter(Boolean);
  const source = direction === "from" ? picked[0] : here;
  const targets = direction === "from" ? [here] : picked;
  if (!source || !targets.length) return fail(direction === "from" ? "Choose a cohort to copy from." : "Choose at least one cohort to copy to.");
  const supabase = await createClient();
  const { data: src } = await supabase.from("cohort_modules").select("name").eq("cohort_id", source).order("sort").order("created_at");
  const names = (src ?? []).map((m) => m.name as string);
  if (!names.length) return fail("That cohort has no modules to copy.");
  let added = 0;
  const done: string[] = [];
  for (const t of targets) {
    const { data: existing } = await supabase.from("cohort_modules").select("name").eq("cohort_id", t);
    const have = new Set((existing ?? []).map((m) => String(m.name).trim().toLowerCase()));
    const missing = names.filter((n) => !have.has(n.trim().toLowerCase()));
    if (missing.length) {
      const { error } = await supabase.from("cohort_modules").insert(missing.map((name, i) => ({ cohort_id: t, name, sort: (existing?.length ?? 0) + i })));
      if (error) return fail(errorMessage(error));
      added += missing.length;
    }
    done.push(t);
    refresh(t);
  }
  await audit(supabase, "tracking.modules.copy", "cohort", source, { targets: done, added });
  refresh(here);
  if (direction === "from") return ok(added ? `Copied ${added} module${added === 1 ? "" : "s"} into this cohort.` : "This cohort already has all of those modules.");
  return ok(
    added
      ? `Copied to ${done.length} cohort${done.length === 1 ? "" : "s"} (${added} module${added === 1 ? "" : "s"} added; ones they already had were skipped).`
      : "Those cohorts already have all of these modules.",
  );
}
