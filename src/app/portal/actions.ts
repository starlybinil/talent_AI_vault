"use server";

import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/session";
import { applicationSchema } from "@/lib/validation";
import { notifyStatus, notifyTemplate } from "@/lib/notify";
import { fail, ok, type ActionState } from "@/lib/action-state";
import { errorMessage } from "@/lib/utils";
import { STATUS_LABEL } from "@/lib/workflow";
import { buildSignedAgreementPdf } from "@/lib/pdf";
import { audit, clientIp } from "@/lib/audit";

export type SubmitApplicationResult = { error?: string; fieldErrors?: Record<string, string> };

export async function submitApplication(input: unknown): Promise<SubmitApplicationResult> {
  const session = await getSession();
  if (!session) return { error: "Please sign in again." };

  const parsed = applicationSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { error: "Please fix the highlighted fields.", fieldErrors };
  }
  const v = parsed.data;
  if (!v.resume_path.startsWith(`${session.userId}/`)) return { error: "Please upload your resume again." };

  let utm: Record<string, string> = {};
  try {
    utm = JSON.parse((await cookies()).get("tv_utm")?.value ?? "{}");
  } catch {
    utm = {};
  }

  const supabase = await createClient();
  const { data: appId, error } = await supabase.rpc("submit_application", {
    p: {
      ...v,
      will_be_18_by_completion: v.will_be_18_by_completion === "yes",
      email: session.email,
      utm_source: utm.utm_source ?? "",
      utm_medium: utm.utm_medium ?? "",
      utm_campaign: utm.utm_campaign ?? "",
    },
  });
  if (error) return { error: errorMessage(error) };

  await notifyStatus(supabase, appId as string);
  (await cookies()).delete("tv_utm");
  redirect(`/portal/applications/${appId}?submitted=1`);
}

export async function markExamComplete(appId: string): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("applicant_mark_exam_completed", { p_app: appId });
  if (error) return fail(errorMessage(error));
  revalidatePath(`/portal/applications/${appId}`);
  return ok("Thanks! We'll let you know as soon as TSMC Arizona shares your result.");
}

export async function submitCohortPreferences(appId: string, cohortIds: string[]): Promise<ActionState> {
  if (!cohortIds.length || cohortIds.length > 3) return fail("Choose between 1 and 3 cohorts.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("applicant_submit_cohort_preferences", { p_app: appId, p_cohorts: cohortIds });
  if (error) return fail(errorMessage(error));
  await notifyStatus(supabase, appId);
  revalidatePath(`/portal/applications/${appId}`);
  revalidatePath("/portal");
  // Enrollment continues on the same page: the agreements are presented right away.
  const result = (data as { result: string }) ?? { result: "waitlisted" };
  const { data: now } = await supabase.from("applications").select("status").eq("id", appId).maybeSingle();
  // Agreements already signed (e.g. carried over from an earlier cohort): the step is complete.
  if (now?.status === "agreements_submitted") redirect(`/portal/applications/${appId}?tab=enrollment&done=1`);
  redirect(`/portal/applications/${appId}?tab=enrollment&chosen=${result.result === "registered" ? "registered" : "waitlisted"}#agreements`);
}

export async function signAgreement(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await getSession();
  if (!session) return fail("Please sign in again.");
  const appId = String(formData.get("application_id") || "");
  const templateId = String(formData.get("template_id") || "");
  const typedName = String(formData.get("typed_name") || "").trim();
  const signature = String(formData.get("signature") || "");
  const agreed = formData.get("agree") === "on";

  if (!agreed) return fail("Please confirm you have read and agree to this document.");
  if (typedName.length < 2) return fail("Type your full legal name.");
  if (!signature.startsWith("data:image/png;base64,")) return fail("Please draw your signature in the box.");
  const png = Buffer.from(signature.slice("data:image/png;base64,".length), "base64");
  if (png.length < 200 || png.length > 500_000) return fail("Please draw your signature again.");

  const supabase = await createClient();
  const [{ data: app }, { data: tpl }] = await Promise.all([
    supabase.from("applications").select("id, first_name, last_name, programs(name)").eq("id", appId).maybeSingle(),
    supabase.from("agreement_templates").select("id, title, body, version").eq("id", templateId).maybeSingle(),
  ]);
  if (!app || !tpl) return fail("Agreement not found.");

  const h = await headers();
  const ip = await clientIp();
  const ua = h.get("user-agent") ?? "";
  const signedAt = new Date();
  const stamp = signedAt.getTime();
  const sigPath = `${session.userId}/signatures/${appId}-${templateId}-${stamp}.png`;
  const pdfPath = `${session.userId}/agreements/${appId}-${templateId}-${stamp}.pdf`;
  const programName = (Array.isArray(app.programs) ? app.programs[0] : app.programs)?.name ?? "Talent-Vault program";

  const pdf = await buildSignedAgreementPdf({
    title: tpl.title,
    version: tpl.version,
    body: tpl.body,
    programName,
    signerName: typedName,
    signerEmail: session.email,
    signaturePng: png,
    signedAt,
    ip,
    userAgent: ua,
    applicationId: appId,
  });

  const up1 = await supabase.storage.from("applicant-files").upload(sigPath, png, { contentType: "image/png" });
  if (up1.error) return fail(`Could not save signature: ${up1.error.message}`);
  const up2 = await supabase.storage.from("applicant-files").upload(pdfPath, pdf, { contentType: "application/pdf" });
  if (up2.error) return fail(`Could not save signed PDF: ${up2.error.message}`);

  const { data, error } = await supabase.rpc("applicant_sign_agreement", {
    p_app: appId,
    p_template: templateId,
    p_typed_name: typedName,
    p_signature_path: sigPath,
    p_pdf_path: pdfPath,
    p_ip: ip,
    p_user_agent: ua,
  });
  if (error) return fail(errorMessage(error));
  await audit(supabase, "agreement.sign", "application", appId, { template: templateId, version: tpl.version });

  const remaining = (data as { remaining: number }).remaining;
  revalidatePath(`/portal/applications/${appId}`);
  revalidatePath("/portal");
  if (remaining > 0) return ok(`Signed. ${remaining} left to sign.`);
  const { data: now } = await supabase.from("applications").select("status").eq("id", appId).maybeSingle();
  // Waitlisted applicants stay on the waitlist; they move to confirmation when a seat opens.
  if (now?.status !== "agreements_submitted") return ok("All agreements signed! When a seat opens you'll go straight to final confirmation.");
  await notifyStatus(supabase, appId);
  redirect(`/portal/applications/${appId}?tab=enrollment&done=1`);
}

export async function sendApplicantMessage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await getSession();
  if (!session) return fail("Please sign in again.");
  const appId = String(formData.get("application_id") || "");
  const body = String(formData.get("body") || "").trim();
  if (!body) return fail("Write a message first.");
  if (body.length > 5000) return fail("Message is too long.");
  const supabase = await createClient();
  const { error } = await supabase.from("messages").insert({ application_id: appId, sender_id: session.userId, body, internal: false });
  if (error) return fail(errorMessage(error));
  revalidatePath(`/portal/applications/${appId}`);
  return ok("Message sent to admissions.");
}

export async function withdrawApplication(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const appId = String(formData.get("application_id") || "");
  const reason = String(formData.get("reason") || "").trim().slice(0, 500);
  const supabase = await createClient();
  const { data: promoted, error } = await supabase.rpc("applicant_withdraw", { p_app: appId, p_reason: reason || null });
  if (error) return fail(errorMessage(error));
  await notifyTemplate(supabase, appId, "status_update", {
    statusLabel: STATUS_LABEL.withdrawn,
    note: "Your application has been withdrawn and any cohort seat you held has been released. Contact admissions if this was a mistake.",
  });
  // Applicants can't read other applications, so promotion emails go out with the service client (if configured).
  const service = createServiceClient();
  if (service) for (const id of (promoted as string[]) ?? []) await notifyTemplate(service, id, "waitlist_promoted");
  revalidatePath(`/portal/applications/${appId}`);
  revalidatePath("/portal");
  return ok("Your application has been withdrawn and your seat has been released.");
}

export async function changeCohort(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const appId = String(formData.get("application_id") || "");
  const reason = String(formData.get("reason") || "").trim().slice(0, 500);
  const supabase = await createClient();
  const { data: promoted, error } = await supabase.rpc("applicant_change_cohort", { p_app: appId, p_reason: reason || null });
  if (error) return fail(errorMessage(error));
  await notifyTemplate(supabase, appId, "status_update", {
    statusLabel: STATUS_LABEL.cohort_selection,
    note: "You've left your cohort and your seat has been released. Your application is still active — choose your new top 3 cohorts in the portal.",
  });
  const service = createServiceClient();
  if (service) for (const id of (promoted as string[]) ?? []) await notifyTemplate(service, id, "waitlist_promoted");
  revalidatePath(`/portal/applications/${appId}`);
  revalidatePath("/portal");
  redirect(`/portal/applications/${appId}?tab=enrollment`);
}

/** Signed download link for one of the applicant's own files (resume, signed PDFs). */
export async function applicantFileUrl(path: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.storage.from("applicant-files").createSignedUrl(path, 60);
  return data?.signedUrl ?? null;
}

const FILE_FOLDERS = ["resumes", "signatures", "agreements"] as const;

/** Permanently deletes the signed-in applicant's account, files and application data. */
export async function deleteAccount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await getSession();
  if (!session) return fail("Please sign in again.");
  const typed = String(formData.get("confirm_email") || "").trim();
  // Check up front so a typo never removes files before the database refuses.
  if (typed.toLowerCase() !== session.email.toLowerCase()) return fail("The email you typed does not match your account.");
  if (session.roles.some((r) => r !== "applicant")) return fail("Staff and employer accounts are managed by your IT administrator.");

  const supabase = await createClient();
  const bucket = supabase.storage.from("applicant-files");
  for (const folder of FILE_FOLDERS) {
    const { data: files, error } = await bucket.list(`${session.userId}/${folder}`, { limit: 1000 });
    if (error) return fail(`We couldn't remove your files: ${errorMessage(error)}`);
    const paths = (files ?? []).filter((f) => f.id).map((f) => `${session.userId}/${folder}/${f.name}`);
    if (paths.length) {
      const { error: removeError } = await bucket.remove(paths);
      if (removeError) return fail(`We couldn't remove your files: ${errorMessage(removeError)}`);
    }
  }

  const { data: promoted, error } = await supabase.rpc("delete_my_account", { p_confirm_email: typed });
  if (error) return fail(errorMessage(error));

  // A released seat may move someone up from the waitlist; tell them.
  const service = createServiceClient();
  if (service) for (const id of (promoted as string[]) ?? []) await notifyTemplate(service, id, "waitlist_promoted");

  await supabase.auth.signOut();
  redirect("/account-deleted");
}

const practiceSchema = z.object({
  activity: z.enum(["typing", "attention"]),
  score: z.number().min(0).max(300),
  accuracy: z.number().min(0).max(100),
  durationSeconds: z.number().int().min(1).max(3600),
  details: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])).default({}),
});

/** Save a Practice Lab attempt to the applicant's private history. */
export async function savePracticeAttempt(input: unknown): Promise<{ ok: boolean; best?: number; previousBest?: number | null }> {
  const session = await getSession();
  if (!session) return { ok: false };
  const parsed = practiceSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const v = parsed.data;
  const supabase = await createClient();
  const { data: prev } = await supabase
    .from("practice_attempts")
    .select("score")
    .eq("activity", v.activity)
    .order("score", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase.from("practice_attempts").insert({
    activity: v.activity,
    score: v.score,
    accuracy: v.accuracy,
    duration_seconds: v.durationSeconds,
    details: v.details,
  });
  if (error) return { ok: false };
  revalidatePath("/portal/practice");
  const previousBest = prev ? Number(prev.score) : null;
  return { ok: true, previousBest, best: Math.max(previousBest ?? 0, v.score) };
}
