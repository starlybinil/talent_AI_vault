import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { SITE_URL } from "@/lib/env";
import type { EmailTemplate } from "@/lib/workflow";
import { formatDate } from "@/lib/utils";
import { buildIcs } from "@/lib/ics";
import { BRAND } from "@/lib/brand";

export type EmailContext = {
  applicationId: string | null;
  to: string;
  firstName: string;
  programName: string;
  /** The program's hiring partner, e.g. "TSMC Arizona". */
  employerPartner?: string | null;
  /** Used to link back to the program's application form. */
  programSlug?: string | null;
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
  /** The applicant's ranked cohort choices. */
  choices?: Array<{ rank: number; name: string; start_date: string; end_date: string; location: string }>;
  messagePreview?: string | null;
  statusLabel?: string | null;
  /** Role invitations: the role (and employer organization) granted by IT. */
  roleLabel?: string | null;
  orgName?: string | null;
  outcome?: {
    completedOn: string | null;
    completionNote: string | null;
    employer: string | null;
    jobTitle: string | null;
    startDate: string | null;
  } | null;
};

type Rendered = {
  subject: string;
  heading: string;
  paragraphs: string[];
  cta?: { label: string; href: string };
  /** A second, dark button under the main one. */
  secondary?: { label: string; href: string };
  footer?: string;
  statusLabel?: string | null;
};

const portal = (id: string | null) => `${SITE_URL}/portal${id ? `/applications/${id}` : ""}`;

function choiceLines(choices: EmailContext["choices"]): string[] {
  if (!choices?.length) return [];
  return [
    choices
      .map((c) => `<strong>Choice #${c.rank}:</strong> ${esc(c.name)}<br/><span style="color:#5a5a5a;font-size:14px">${formatDate(c.start_date)} – ${formatDate(c.end_date)} · ${esc(c.location)}</span>`)
      .join("<br/><br/>"),
  ];
}

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
          "You can track your status any time in your FoundryReady portal.",
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
    case "exam_invite": {
      const examTab = `${portal(ctx.applicationId)}?tab=exam`;
      return {
        subject: "Action required: complete your TestGorilla assessment",
        heading: "Your assessment is ready",
        paragraphs: [
          hi,
          `Congratulations — you passed initial screening for the <strong>${esc(ctx.programName)}</strong>. The next step is a short online assessment on TestGorilla. Please complete it within 7 days.`,
          "<strong>Step 1.</strong> Take the assessment on TestGorilla, in one sitting in a quiet place.",
          `<strong>Step 2.</strong> Sign in to your FoundryReady portal and click <strong>&ldquo;I&rsquo;ve completed the assessment&rdquo;</strong> on the Assessment tab, so admissions knows to look for your result.`,
          ctx.examUrl ? `<span style="font-size:13px;color:#5a5a5a">Assessment link: <a href="${attr(ctx.examUrl)}" style="color:#8C1D40">${esc(ctx.examUrl)}</a><br/>Portal: <a href="${attr(examTab)}" style="color:#8C1D40">${esc(examTab)}</a></span>` : "",
          ...note,
        ].filter(Boolean),
        cta: { label: "Step 1: Take the assessment", href: ctx.examUrl || examTab },
        secondary: { label: "Step 2: Mark it complete on FoundryReady", href: examTab },
      };
    }
    case "exam_reminder": {
      const examTab = `${portal(ctx.applicationId)}?tab=exam`;
      return {
        subject: "Reminder: your TestGorilla assessment is waiting",
        heading: "Don't miss your assessment",
        paragraphs: [
          hi,
          "A friendly reminder that your program assessment is still open. Completing it is required to move forward.",
          "<strong>Haven&rsquo;t taken it yet?</strong> Use the first button to open your assessment on TestGorilla.",
          `<strong>Already finished?</strong> Sign in to your FoundryReady portal and click <strong>&ldquo;I&rsquo;ve completed the assessment&rdquo;</strong> on the Assessment tab so we can follow up on your result.`,
          ctx.examUrl ? `<span style="font-size:13px;color:#5a5a5a">Assessment link: <a href="${attr(ctx.examUrl)}" style="color:#8C1D40">${esc(ctx.examUrl)}</a><br/>Portal: <a href="${attr(examTab)}" style="color:#8C1D40">${esc(examTab)}</a></span>` : "",
        ].filter(Boolean),
        cta: { label: "Take the assessment", href: ctx.examUrl || examTab },
        secondary: { label: "I've finished: mark it complete", href: examTab },
      };
    }
    case "exam_passed":
      return {
        subject: "You passed the assessment!",
        heading: "Assessment passed",
        paragraphs: [
          hi,
          `${ctx.employerPartner ? esc(ctx.employerPartner) : "Our employer partner"} has confirmed a successful assessment result. 🎉`,
          `Admissions is now finalising your acceptance into the <strong>${esc(ctx.programName)}</strong>. You'll get another email as soon as enrollment opens for you.`,
          ...note,
        ],
        cta: { label: "View my application", href: portal(ctx.applicationId) },
      };
    case "accepted":
      return {
        subject: `You're accepted into the ${ctx.programName}: time to enroll`,
        heading: "Welcome to the program",
        paragraphs: [
          hi,
          `Congratulations: admissions has accepted you into the <strong>${esc(ctx.programName)}</strong>.`,
          "Next, log in to <strong>enroll</strong>: rank your top 3 cohorts (you can see dates, times, locations and seats left), then sign your program agreements on the same page. Admissions then confirms your placement.",
          ...note,
        ],
        cta: { label: "Enroll now", href: `${portal(ctx.applicationId)}?tab=enrollment` },
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
          // The reason is private: shown only after signing in, never in the email body.
          "You can see the reason for this decision by signing in to your FoundryReady portal.",
        ],
        cta: { label: "Sign in to view details", href: portal(ctx.applicationId) },
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
        cta: { label: "Sign my agreements", href: `${portal(ctx.applicationId)}?tab=enrollment#agreements` },
      };
    case "choices_received":
      return {
        subject: "We received your cohort choices",
        heading: "Your cohort choices are in",
        paragraphs: [
          hi,
          `Thanks! We've received your cohort choices for the <strong>${esc(ctx.programName)}</strong>:`,
          ...choiceLines(ctx.choices),
          "<strong>Next:</strong> if you haven't already, review and e-sign your program agreements in the portal.",
          "Admissions will then review your choices and confirm which cohort you're accepted into. We'll email you as soon as that's done.",
        ],
        cta: { label: "Sign my agreements", href: `${portal(ctx.applicationId)}?tab=enrollment#agreements` },
      };
    case "waitlist_promoted":
      return {
        subject: "A seat opened up in one of your cohort choices",
        heading: "You've been moved off the waitlist",
        paragraphs: [
          hi,
          "Good news: a seat opened up in one of the cohorts you chose.",
          "If you haven't signed your program agreements yet, sign them now. Admissions will then confirm which cohort you're accepted into and email you.",
        ],
        cta: { label: "View my enrollment", href: `${portal(ctx.applicationId)}?tab=enrollment#agreements` },
      };
    case "waitlisted":
      return {
        subject: "You're on the waitlist",
        heading: "You're on the waitlist",
        paragraphs: [
          hi,
          "All of the cohorts you selected are currently full, so we've added you to their waitlists in your ranked order:",
          ...choiceLines(ctx.choices),
          "If a seat opens, you'll be registered automatically and we'll email you right away.",
          "Sign your program agreements now so you're ready: once a seat opens you'll go straight to final confirmation.",
        ],
        cta: { label: "Sign my agreements", href: `${portal(ctx.applicationId)}?tab=enrollment#agreements` },
      };
    case "agreements_submitted":
      return {
        subject: "Agreements received",
        heading: "We received your signed agreements",
        paragraphs: [
          hi,
          "Thanks! We've received your signed program agreements.",
          "Admissions will now review your cohort choices and confirm which cohort you're accepted into. You'll get an email as soon as that's done.",
        ],
        cta: { label: "View my status", href: portal(ctx.applicationId) },
      };
    case "confirmed":
      return {
        subject: `Congratulations! You're accepted into ${ctx.cohort?.name ?? "your cohort"}`,
        heading: "Congratulations, you're in!",
        paragraphs: [
          hi,
          `Admissions has confirmed your enrollment in the <strong>${esc(ctx.programName)}</strong>. You've been accepted into:`,
          ...cohortLines(ctx.cohort),
          "A calendar invite for your cohort is attached.",
          `<strong>Need a different cohort?</strong> You can request a change in your portal (Details tab &rarr; Change cohort) while seats are available.`,
          "Otherwise, no action is needed right now. We'll share more information about your first day, what to bring and how to prepare as your start date gets closer.",
          ...note,
        ],
        cta: { label: "View my cohort", href: `${portal(ctx.applicationId)}?tab=enrollment` },
        secondary: { label: "Change my cohort", href: `${portal(ctx.applicationId)}?tab=details#change-cohort` },
      };
    case "program_completed":
      return {
        subject: `Congratulations, you completed the ${ctx.programName}!`,
        heading: "You did it. Congratulations, graduate!",
        paragraphs: [
          hi,
          `You've successfully completed the <strong>${esc(ctx.programName)}</strong>${
            ctx.outcome?.completedOn ? ` as of ${formatDate(ctx.outcome.completedOn)}` : ""
          }.`,
          ...(ctx.outcome?.completionNote ? [`<strong>Credentials earned:</strong> ${esc(ctx.outcome.completionNote)}`] : []),
          "Our partner employers can now see that you've finished the program. Keep an eye on your inbox for interview invitations.",
        ],
        cta: { label: "View my record", href: portal(ctx.applicationId) },
      };
    case "hired":
      return {
        subject: "Congratulations on your new job!",
        heading: "You're hired!",
        paragraphs: [
          hi,
          `Congratulations on joining <strong>${esc(ctx.outcome?.employer ?? "your new employer")}</strong>${
            ctx.outcome?.jobTitle ? ` as <strong>${esc(ctx.outcome.jobTitle)}</strong>` : ""
          }${ctx.outcome?.startDate ? `, starting ${formatDate(ctx.outcome.startDate)}` : ""}.`,
          "Everyone at FoundryReady is proud of you. Thank you for being part of the program, and best of luck in your new career.",
        ],
        cta: { label: "View my record", href: portal(ctx.applicationId) },
      };
    case "status_update":
      return {
        subject: "Your application status was updated",
        heading: "Your application status has changed",
        paragraphs: [hi, "There's an update on your application. Log in to your portal to see the details and any next steps.", ...note],
        cta: { label: "View my application", href: portal(ctx.applicationId) },
      };
    case "application_reset":
      return {
        subject: `Please re-apply to the ${ctx.programName}`,
        heading: "Your application has been reset",
        paragraphs: [
          hi,
          `Admissions has reset your application to the <strong>${esc(ctx.programName)}</strong> so you can start the application process again from the beginning.`,
          "Log in and complete the application form again. Your account stays the same, and you'll hear from us at every step.",
        ],
        cta: { label: "Start my application", href: `${SITE_URL}/portal/apply/${ctx.programSlug ?? ""}` },
      };
    case "role_invite":
      return {
        subject: "You're invited to join FoundryReady",
        heading: "You're invited to FoundryReady",
        paragraphs: [
          "Hello,",
          `You've been invited to join <strong>FoundryReady</strong>, the admissions platform for our no-cost advanced manufacturing training programs, as <strong>${esc(ctx.roleLabel ?? "a team member")}</strong>${ctx.orgName ? ` for <strong>${esc(ctx.orgName)}</strong>` : ""}.`,
          `Create your account with this email address (<strong>${esc(ctx.to)}</strong>) and your access is set up automatically. You can use a password or a one-time email link.`,
          "If you weren't expecting this invitation, you can ignore this email.",
        ],
        cta: { label: "Create my account", href: `${SITE_URL}/register?email=${encodeURIComponent(ctx.to)}` },
        footer: "You're receiving this because a FoundryReady administrator invited this email address.",
      };
    case "role_granted":
      return {
        subject: "Your FoundryReady access has been updated",
        heading: "New access on FoundryReady",
        paragraphs: [
          `Hi${ctx.firstName ? ` ${esc(ctx.firstName)}` : ""},`,
          `You've been given <strong>${esc(ctx.roleLabel ?? "new")}</strong> access${ctx.orgName ? ` for <strong>${esc(ctx.orgName)}</strong>` : ""} on FoundryReady. Sign in to get started.`,
          "If you think this was a mistake, reply to this email or contact support.",
        ],
        cta: { label: "Sign in", href: `${SITE_URL}/login` },
        footer: "You're receiving this because a FoundryReady administrator updated your account access.",
      };
    case "new_message":
      return {
        subject: "New message from FoundryReady admissions",
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
  const secondary = r.secondary
    ? `<p style="margin:${r.cta ? "-12px" : "28px"} 0 28px"><a href="${attr(r.secondary.href)}" style="background:#191919;color:#ffffff;padding:14px 24px;border-radius:999px;font-weight:700;text-decoration:none;display:inline-block">${esc(
        r.secondary.label,
      )} →</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f3f3f3;font-family:Arial,Helvetica,sans-serif;color:#191919">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:16px;overflow:hidden">
<tr><td style="background:#191919;padding:20px 28px"><span style="display:inline-block;background:#8C1D40;color:#FFC627;font-weight:900;font-size:14px;line-height:28px;width:28px;text-align:center;border-radius:7px;vertical-align:middle;margin-right:8px">FR</span><span style="color:#fff;font-weight:800;font-size:20px;letter-spacing:-0.5px;vertical-align:middle">Foundry<span style="color:#FFC627">Ready</span></span></td></tr>
<tr><td style="height:6px;background:linear-gradient(90deg,#8C1D40,#FFC627)"></td></tr>
<tr><td style="padding:32px 28px">${
    r.statusLabel
      ? `<p style="margin:0 0 14px"><span style="display:inline-block;background:#FFF4D1;color:#8C1D40;border:1px solid #F5D77A;border-radius:999px;padding:6px 12px;font-size:12px;font-weight:700;letter-spacing:.3px">Application status updated: ${esc(r.statusLabel)}</span></p>`
      : ""
  }
<h1 style="margin:0 0 20px;font-size:26px;line-height:1.2">${esc(r.heading)}</h1>${body}${cta}${secondary}
</td></tr>
<tr><td style="padding:20px 28px;background:#fafafa;color:#747474;font-size:12px;line-height:1.5">
${esc(r.footer ?? "You're receiving this because you applied to a FoundryReady training program.")}<br/>FoundryReady · ${esc(BRAND.tagline)} · ${esc(BRAND.location)}</td></tr>
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
  const rendered = { ...renderEmail(template, ctx), statusLabel: ctx.statusLabel ?? null };
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
        from: process.env.EMAIL_FROM || BRAND.emailFrom,
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
    p_application: ctx.applicationId || null,
    p_to: ctx.to,
    p_template: template,
    p_subject: rendered.subject,
    p_status: status,
    p_provider_id: providerId,
    p_error: error,
  });

  return { status, error: error ?? undefined };
}
