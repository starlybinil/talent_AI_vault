import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { SITE_URL } from "@/lib/env";
import type { EmailTemplate } from "@/lib/workflow";
import { formatDate } from "@/lib/utils";
import { buildIcs } from "@/lib/ics";

export type EmailContext = {
  applicationId: string | null;
  to: string;
  firstName: string;
  programName: string;
  examUrl?: string | null;
  cohort?: {
    name: string;
    format: string;
    start_date: string;
    end_date: string;
    schedule: string;
    location: string;
    address: string | null;
  } | null;
  note?: string | null;
  messagePreview?: string | null;
  statusLabel?: string | null;
};

type Rendered = { subject: string; heading: string; paragraphs: string[]; cta?: { label: string; href: string } };

const portal = (id: string | null) => `${SITE_URL}/portal${id ? `/applications/${id}` : ""}`;

function cohortLines(c: EmailContext["cohort"]): string[] {
  if (!c) return [];
  return [
    `<strong>${esc(c.name)}</strong> — ${esc(c.format)}<br/>${formatDate(c.start_date)} – ${formatDate(c.end_date)}<br/>${esc(
      c.schedule,
    )}<br/>${esc(c.location)}${c.address ? ` · ${esc(c.address)}` : ""}`,
  ];
}

export function renderEmail(template: EmailTemplate, ctx: EmailContext): Rendered {
  const hi = `Hi ${esc(ctx.firstName)},`;
  const note = ctx.note ? [`<em>Note from admissions:</em> ${esc(ctx.note)}`] : [];
  switch (template) {
    case "application_received":
      return {
        subject: `We received your application — ${ctx.programName}`,
        heading: "Application received",
        paragraphs: [
          hi,
          `Thanks for applying to the <strong>${esc(ctx.programName)}</strong>. Our admissions team will review your application and you'll hear from us at every step.`,
          "You can track your status any time in your Talent-Vault portal.",
        ],
        cta: { label: "Track my application", href: portal(ctx.applicationId) },
      };
    case "screening_passed":
      return {
        subject: "You passed initial screening",
        heading: "Great news — you passed screening",
        paragraphs: [hi, "Your application passed our initial screening. Your online assessment invitation is on its way.", ...note],
        cta: { label: "View my status", href: portal(ctx.applicationId) },
      };
    case "exam_invite":
      return {
        subject: "Action required: complete your TestGorilla assessment",
        heading: "Your assessment is ready",
        paragraphs: [
          hi,
          `Congratulations — you passed initial screening for the <strong>${esc(ctx.programName)}</strong>. The next step is a short online assessment on TestGorilla.`,
          ctx.examUrl ? `Your assessment link: <a href="${attr(ctx.examUrl)}">${esc(ctx.examUrl)}</a>` : "",
          "Please complete it within 7 days, then mark it complete in your portal.",
          ...note,
        ].filter(Boolean),
        cta: { label: "Start the assessment", href: ctx.examUrl || portal(ctx.applicationId) },
      };
    case "exam_reminder":
      return {
        subject: "Reminder: your TestGorilla assessment is waiting",
        heading: "Don't miss your assessment",
        paragraphs: [
          hi,
          "A friendly reminder that your program assessment is still open. Completing it is required to move forward.",
          ctx.examUrl ? `Assessment link: <a href="${attr(ctx.examUrl)}">${esc(ctx.examUrl)}</a>` : "",
          "Already finished? Mark it complete in your portal so we can follow up.",
        ].filter(Boolean),
        cta: { label: "Complete my assessment", href: ctx.examUrl || portal(ctx.applicationId) },
      };
    case "exam_passed":
      return {
        subject: "You passed! Choose your cohort",
        heading: "Assessment passed — next steps",
        paragraphs: [
          hi,
          "TSMC Arizona has confirmed a successful assessment result. 🎉",
          "Next, log in and choose your <strong>top 3 cohorts</strong>. You can see dates, times, locations and how many seats are left. We'll register you in the highest-ranked cohort with an open seat.",
          ...note,
        ],
        cta: { label: "Choose my cohorts", href: `${portal(ctx.applicationId)}?tab=cohorts` },
      };
    case "exam_failed":
      return {
        subject: "An update on your application",
        heading: "Assessment result",
        paragraphs: [
          hi,
          "Thank you for completing the assessment. Unfortunately, the result did not meet the program threshold at this time.",
          "We encourage you to keep building your skills — admissions may contact you about future opportunities.",
          ...note,
        ],
        cta: { label: "View my application", href: portal(ctx.applicationId) },
      };
    case "not_selected":
      return {
        subject: "An update on your application",
        heading: "Application decision",
        paragraphs: [
          hi,
          `Thank you for your interest in the <strong>${esc(ctx.programName)}</strong>. After careful review, we're unable to move your application forward at this time.`,
          ...note,
        ],
      };
    case "cohort_registered":
      return {
        subject: "You're registered — sign your program agreements",
        heading: "Your seat is reserved",
        paragraphs: [
          hi,
          "You've been registered in:",
          ...cohortLines(ctx.cohort),
          "To lock in your seat, review and e-sign your program agreements in the portal.",
          ...note,
        ],
        cta: { label: "Sign my agreements", href: `${portal(ctx.applicationId)}?tab=agreements` },
      };
    case "waitlist_promoted":
      return {
        subject: "A seat opened up — you're in!",
        heading: "You've been moved off the waitlist",
        paragraphs: [
          hi,
          "Good news — a seat opened and you've been registered in:",
          ...cohortLines(ctx.cohort),
          "Please sign your program agreements to confirm your seat.",
        ],
        cta: { label: "Sign my agreements", href: `${portal(ctx.applicationId)}?tab=agreements` },
      };
    case "waitlisted":
      return {
        subject: "You're on the waitlist",
        heading: "You're on the waitlist",
        paragraphs: [
          hi,
          "All of the cohorts you selected are currently full, so we've added you to their waitlists in your ranked order.",
          "If a seat opens, you'll be registered automatically and we'll email you right away.",
        ],
        cta: { label: "View my status", href: portal(ctx.applicationId) },
      };
    case "agreements_submitted":
      return {
        subject: "Agreements received",
        heading: "We received your signed agreements",
        paragraphs: [hi, "Thanks! Admissions is verifying your documents. You'll receive your final confirmation soon."],
        cta: { label: "View my status", href: portal(ctx.applicationId) },
      };
    case "confirmed":
      return {
        subject: `You're confirmed — welcome to the ${ctx.programName}`,
        heading: "You're officially in!",
        paragraphs: [
          hi,
          "Your documents are verified and your enrollment is confirmed. Here are your cohort details:",
          ...cohortLines(ctx.cohort),
          "A calendar invite is attached. We can't wait to see you in the lab.",
          ...note,
        ],
        cta: { label: "Open my portal", href: portal(ctx.applicationId) },
      };
    case "status_update":
      return {
        subject: "Your application status was updated",
        heading: ctx.statusLabel ? `Status: ${ctx.statusLabel}` : "Application update",
        paragraphs: [hi, "There's an update on your application. Log in to your portal to see the details and any next steps.", ...note],
        cta: { label: "View my application", href: portal(ctx.applicationId) },
      };
    case "new_message":
      return {
        subject: "New message from Talent-Vault admissions",
        heading: "You have a new message",
        paragraphs: [hi, ctx.messagePreview ? `“${esc(ctx.messagePreview.slice(0, 280))}”` : "Admissions sent you a message."],
        cta: { label: "Read and reply", href: `${portal(ctx.applicationId)}?tab=messages` },
      };
  }
}

export function renderHtml(r: Rendered): string {
  const body = r.paragraphs.map((p) => `<p style="margin:0 0 16px;line-height:1.6">${p}</p>`).join("");
  const cta = r.cta
    ? `<p style="margin:28px 0"><a href="${attr(r.cta.href)}" style="background:#FFC627;color:#191919;padding:14px 24px;border-radius:999px;font-weight:700;text-decoration:none;display:inline-block">${esc(
        r.cta.label,
      )} →</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f3f3f3;font-family:Arial,Helvetica,sans-serif;color:#191919">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:16px;overflow:hidden">
<tr><td style="background:#191919;padding:20px 28px"><span style="color:#fff;font-weight:800;font-size:20px;letter-spacing:-0.5px">Talent<span style="color:#FFC627">·</span>Vault</span></td></tr>
<tr><td style="height:6px;background:linear-gradient(90deg,#8C1D40,#FFC627)"></td></tr>
<tr><td style="padding:32px 28px">
<h1 style="margin:0 0 20px;font-size:26px;line-height:1.2">${esc(r.heading)}</h1>${body}${cta}
</td></tr>
<tr><td style="padding:20px 28px;background:#fafafa;color:#747474;font-size:12px;line-height:1.5">
You're receiving this because you applied to a Talent-Vault training program.<br/>Talent-Vault · Phoenix, Arizona</td></tr>
</table></td></tr></table></body></html>`;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function attr(s: string): string {
  return /^(https?:|mailto:)/i.test(s) ? esc(s) : "#";
}

/**
 * Send (or simulate, when RESEND_API_KEY isn't set) and record in email_log.
 * Never throws — email problems must not break the admissions workflow.
 */
export async function sendEmail(
  supabase: SupabaseClient,
  template: EmailTemplate,
  ctx: EmailContext,
): Promise<{ status: "sent" | "simulated" | "failed"; error?: string }> {
  const rendered = renderEmail(template, ctx);
  const html = renderHtml(rendered);
  const apiKey = process.env.RESEND_API_KEY;
  let status: "sent" | "simulated" | "failed" = "simulated";
  let providerId: string | null = null;
  let error: string | null = null;

  if (apiKey) {
    try {
      const resend = new Resend(apiKey);
      const attachments =
        template === "confirmed" && ctx.cohort
          ? [{ filename: "cohort.ics", content: Buffer.from(buildIcs(ctx.programName, ctx.cohort)).toString("base64") }]
          : undefined;
      const res = await resend.emails.send({
        from: process.env.EMAIL_FROM || "Talent-Vault Admissions <admissions@talent-vault.org>",
        to: ctx.to,
        subject: rendered.subject,
        html,
        attachments,
      });
      if (res.error) {
        status = "failed";
        error = res.error.message;
      } else {
        status = "sent";
        providerId = res.data?.id ?? null;
      }
    } catch (e) {
      status = "failed";
      error = e instanceof Error ? e.message : String(e);
    }
  }

  await supabase.rpc("log_email", {
    p_application: ctx.applicationId,
    p_to: ctx.to,
    p_template: template,
    p_subject: rendered.subject,
    p_status: status,
    p_provider_id: providerId,
    p_error: error,
  });

  return { status, error: error ?? undefined };
}
