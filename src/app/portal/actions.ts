"use server";

import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/session";
import { applicationSchema } from "@/lib/validation";
import { notifyStatus } from "@/lib/notify";
import { fail, ok, type ActionState } from "@/lib/action-state";
import { errorMessage } from "@/lib/utils";
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
  const result = (data as { result: string; rank?: number }) ?? { result: "waitlisted" };
  return result.result === "registered"
    ? ok(`You're registered in your choice #${result.rank}! Next: sign your program agreements.`)
    : ok("Your choices are full right now — you're on the waitlist and we'll email you when a seat opens.");
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
  if (remaining === 0) await notifyStatus(supabase, appId);
  revalidatePath(`/portal/applications/${appId}`);
  return ok(remaining === 0 ? "All agreements signed! Admissions will verify and send your final confirmation." : `Signed. ${remaining} left to sign.`);
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
  const supabase = await createClient();
  const { error } = await supabase.rpc("applicant_withdraw", { p_app: appId, p_reason: "Withdrawn by applicant" });
  if (error) return fail(errorMessage(error));
  revalidatePath(`/portal/applications/${appId}`);
  return ok("Your application has been withdrawn.");
}

/** Signed download link for one of the applicant's own files (resume, signed PDFs). */
export async function applicantFileUrl(path: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.storage.from("applicant-files").createSignedUrl(path, 60);
  return data?.signedUrl ?? null;
}
