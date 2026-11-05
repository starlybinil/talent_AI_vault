import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { SITE_URL } from "@/lib/env";
import type { EmailTemplate } from "@/lib/workflow";
import { formatDate } from "@/lib/utils";
import { buildIcs } from "@/lib/ics";
import { BRAND } from "@/lib/brand";
import { parseRichText, type Inline } from "@/lib/richtext";

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
  /** Screening: link to book the verification video call, and the employer's application link. */
  verificationUrl?: string | null;
  employerApplicationUrl?: string | null;
  /** Missed-session email: the class date (YYYY-MM-DD). */
  sessionDate?: string | null;
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
  /** Cohort announcements written by the program team. */
  announcement?: { subject: string; body: string } | null;
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

/** Placeholder tokens like {{first_name}} pass through formatting untouched (used to build editable defaults). */
const isToken = (v?: string | null) => !!v && v.startsWith("{{");
const fd = (d: string) => (isToken(d) ? d : formatDate(d));

const portal = (id: string | null) => `${SITE_URL}/portal${id ? `/applications/${id}` : ""}`;

function choiceLines(choices: EmailContext["choices"]): string[] {
  if (!choices?.length) return [];
  if (isToken(choices[0].name)) return ["{{choices}}"];
  return [
    choices
      .map((c) => `<strong>Choice #${c.rank}:</strong> ${esc(c.name)}<br/><span style="color:#5a5a5a;font-size:14px">${fd(c.start_date)} – ${fd(c.end_date)} · ${esc(c.location)}</span>`)
      .join("<br/><br/>"),
  ];
}

function cohortLines(c: EmailContext["cohort"]): string[] {
  if (!c) return [];
  if (isToken(c.name)) return ["{{cohort_details}}"];
  return [
    `<strong>${esc(c.name)}</strong> — ${esc(c.format)}<br/>${fd(c.start_date)} – ${fd(c.end_date)}<br/>${esc(
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
          `Admissions is now finalizing your acceptance into the <strong>${esc(ctx.programName)}</strong>. You'll get another email as soon as enrollment opens for you.`,
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
    case "verification_invite":
      return {
        subject: `Next step: schedule a short video call to verify your information`,
        heading: "Let's verify your information",
        paragraphs: [
          hi,
          `Thanks for applying to the <strong>${esc(ctx.programName)}</strong>. As part of screening, we'd like to meet you on a short video call to verify the information in your application.`,
          "Please pick a time that works for you using the button below. Have a <strong>photo ID</strong> ready, along with any documents that show your education (for example a diploma, GED certificate or transcript).",
          ...note,
          ctx.verificationUrl
            ? `<span style="font-size:13px;color:#5a5a5a">Scheduling link: <a href="${attr(ctx.verificationUrl)}" style="color:#8C1D40">${esc(ctx.verificationUrl)}</a></span>`
            : "",
        ].filter(Boolean),
        cta: ctx.verificationUrl ? { label: "Schedule my verification call", href: ctx.verificationUrl } : { label: "Open my portal", href: portal(ctx.applicationId) },
        secondary: { label: "View my application", href: portal(ctx.applicationId) },
      };
    case "employer_application": {
      const employer = ctx.employerPartner ?? "our employer partner";
      return {
        subject: `You're verified: complete your ${employer} application`,
        heading: "Information verified: one more application",
        paragraphs: [
          hi,
          `Thank you for meeting with us. Your information for the <strong>${esc(ctx.programName)}</strong> has been verified.`,
          `Next, please complete the <strong>${esc(employer)}</strong> application using the button below. This is a separate application with ${esc(employer)}; once it's in, admissions will move you on to the online assessment.`,
          ...note,
          ctx.employerApplicationUrl
            ? `<span style="font-size:13px;color:#5a5a5a">Application link: <a href="${attr(ctx.employerApplicationUrl)}" style="color:#8C1D40">${esc(ctx.employerApplicationUrl)}</a></span>`
            : "",
        ].filter(Boolean),
        cta: ctx.employerApplicationUrl
          ? { label: `Start the ${employer} application`, href: ctx.employerApplicationUrl }
          : { label: "Open my portal", href: portal(ctx.applicationId) },
        secondary: { label: "View my application", href: portal(ctx.applicationId) },
      };
    }
    case "missed_session": {
      const day = ctx.sessionDate ? fd(ctx.sessionDate) : "today";
      return {
        subject: `We missed you in class ${ctx.sessionDate ? `on ${day}` : "today"}`,
        heading: "We missed you today",
        paragraphs: [
          hi,
          `You weren't checked in for <strong>${esc(ctx.cohort?.name ?? "your cohort")}</strong> on ${esc(day)}. We hope everything is okay.`,
          "Every session builds hands-on skills you'll use on the job, and attendance counts toward completing the program. If you were there but couldn't check in, or something is getting in the way of attending, let your cohort manager know so we can help.",
        ],
        cta: { label: "See my attendance", href: `${portal(ctx.applicationId)}?tab=program` },
        footer: "You're receiving this because you're enrolled in a FoundryReady training cohort.",
      };
    }
    case "trainee_message":
      return {
        subject: ctx.announcement?.subject ?? "A message from your program team",
        heading: ctx.announcement?.subject ?? "A message from your program team",
        paragraphs: [
          hi,
          ...(ctx.announcement?.body ?? "")
            .split(/\n{2,}/)
            .map((p) => p.trim())
            .filter(Boolean)
            .map((p) => esc(p).replace(/\n/g, "<br/>")),
          `<span style="font-size:13px;color:#5a5a5a">From your cohort manager · ${esc(ctx.programName)}${ctx.cohort ? ` · ${esc(ctx.cohort.name)}` : ""}. Your grades and attendance are on the <em>In program</em> tab of your portal.</span>`,
        ],
        cta: { label: "Open my progress", href: `${portal(ctx.applicationId)}?tab=program` },
        footer: "You're receiving this because you're enrolled in a FoundryReady training cohort.",
      };
    case "cohort_reminder":
      return {
        subject: `Reminder: choose your cohorts for the ${ctx.programName}`,
        heading: "Your seat is waiting: choose your cohorts",
        paragraphs: [
          hi,
          `You've been accepted into the <strong>${esc(ctx.programName)}</strong>, but we haven't received your cohort choices yet.`,
          "Log in to rank your <strong>top cohorts</strong> (at least 2) and sign your program agreements on the same page. Seats are limited and fill up in the order choices come in, so please choose soon.",
          "Questions about dates or locations? Reply from the Messages tab in your portal and admissions will help.",
        ],
        cta: { label: "Choose my cohorts", href: `${portal(ctx.applicationId)}?tab=enrollment` },
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
            ctx.outcome?.completedOn ? ` as of ${fd(ctx.outcome.completedOn)}` : ""
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
          }${ctx.outcome?.startDate ? `, starting ${fd(ctx.outcome.startDate)}` : ""}.`,
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
    case "cohort_announcement": {
      const cohortName = ctx.cohort?.name ?? "your cohort";
      return {
        subject: `${ctx.announcement?.subject ?? "Update"} · ${cohortName}`,
        heading: ctx.announcement?.subject ?? "An update from your program team",
        paragraphs: [
          hi,
          ...(ctx.announcement?.body ?? "")
            .split(/\n{2,}/)
            .map((p) => p.trim())
            .filter(Boolean)
            .map((p) => esc(p).replace(/\n/g, "<br/>")),
          `<span style="font-size:13px;color:#5a5a5a">Sent to everyone in <strong>${esc(cohortName)}</strong> · ${esc(ctx.programName)}. You can find past announcements in your FoundryReady portal.</span>`,
        ],
        cta: { label: "Open my program portal", href: `${portal(ctx.applicationId)}?tab=program` },
        footer: "You're receiving this because you're placed in a FoundryReady training cohort.",
      };
    }
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
  const body = r.paragraphs
    .map((p) => (/^<(ul|ol)\b/.test(p) ? `<div style="margin:0 0 16px;line-height:1.6">${p}</div>` : `<p style="margin:0 0 16px;line-height:1.6">${p}</p>`))
    .join("");
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
  // Admin-customized wording, when there is one (falls back to the built-in text on any error).
  const { data: ov } = await supabase
    .from("email_templates")
    .select("subject, heading, body, cta_label")
    .eq("key", template)
    .maybeSingle<TemplateOverride>()
    .then((r) => r, () => ({ data: null }));
  const rendered = { ...renderWithOverride(template, ctx, ov), statusLabel: ctx.statusLabel ?? null };
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

// ---------------------------------------------------------------------------
// Editable templates: program admins can override the subject, heading, body and button label of any email.
// The body uses the light formatting from src/lib/richtext.ts plus {{placeholders}}.
// ---------------------------------------------------------------------------

export type TemplateOverride = { subject: string; heading: string; body: string; cta_label: string | null };

export const EMAIL_TEMPLATE_INFO: Array<{ key: EmailTemplate; name: string; when: string; group: "Admissions" | "Enrollment & program" | "Accounts & messages" }> = [
  { key: "application_received", name: "Application received", when: "Right after an applicant submits", group: "Admissions" },
  { key: "verification_invite", name: "Verification call invite", when: "Screening step 1", group: "Admissions" },
  { key: "employer_application", name: "Verified: employer application", when: "Screening step 2", group: "Admissions" },
  { key: "screening_passed", name: "Screening passed", when: "Screening passed without an assessment link", group: "Admissions" },
  { key: "exam_invite", name: "Assessment invite", when: "Screening step 3 / assessment sent", group: "Admissions" },
  { key: "exam_reminder", name: "Assessment reminder", when: "Manual or automatic reminder", group: "Admissions" },
  { key: "exam_passed", name: "Assessment passed", when: "Admissions records a pass", group: "Admissions" },
  { key: "exam_failed", name: "Assessment not passed", when: "Admissions records a fail", group: "Admissions" },
  { key: "not_selected", name: "Not selected", when: "Admissions marks Not selected", group: "Admissions" },
  { key: "accepted", name: "Accepted: time to enroll", when: "Accept into program", group: "Enrollment & program" },
  { key: "cohort_reminder", name: "Reminder to choose cohorts", when: "Cohort reminder (single or bulk)", group: "Enrollment & program" },
  { key: "choices_received", name: "Cohort choices received", when: "Applicant submits cohort choices", group: "Enrollment & program" },
  { key: "cohort_registered", name: "Cohort seat held", when: "Registered in a cohort", group: "Enrollment & program" },
  { key: "waitlisted", name: "Waitlisted", when: "All chosen cohorts are full", group: "Enrollment & program" },
  { key: "waitlist_promoted", name: "Promoted from waitlist", when: "A seat opens up", group: "Enrollment & program" },
  { key: "agreements_submitted", name: "Agreements received", when: "Applicant signs all agreements", group: "Enrollment & program" },
  { key: "confirmed", name: "Accepted into cohort (confirmed)", when: "Admissions confirms enrollment", group: "Enrollment & program" },
  { key: "cohort_announcement", name: "Cohort announcement", when: "Message this cohort", group: "Enrollment & program" },
  { key: "trainee_message", name: "Message from cohort manager", when: "Cohort manager emails at-risk or selected students", group: "Enrollment & program" },
  { key: "missed_session", name: "We missed you today", when: "Marked absent after check-in (if the program sends it)", group: "Enrollment & program" },
  { key: "program_completed", name: "Program completed", when: "Completion recorded", group: "Enrollment & program" },
  { key: "hired", name: "Hired", when: "Hire recorded", group: "Enrollment & program" },
  { key: "status_update", name: "Status updated", when: "Other status changes", group: "Accounts & messages" },
  { key: "application_reset", name: "Application reset", when: "Reset to start of application process", group: "Accounts & messages" },
  { key: "new_message", name: "New message", when: "Admissions sends a message", group: "Accounts & messages" },
  { key: "role_invite", name: "Staff invitation", when: "IT grants a role to someone without an account", group: "Accounts & messages" },
  { key: "role_granted", name: "Staff access updated", when: "IT grants a role to an existing user", group: "Accounts & messages" },
];

/** Placeholders admins can use, with what they're replaced by. */
export const EMAIL_TOKENS: Array<{ token: string; label: string }> = [
  { token: "first_name", label: "Applicant's first name" },
  { token: "email", label: "Applicant's email" },
  { token: "program_name", label: "Program name" },
  { token: "employer", label: "Employer partner (e.g. TSMC-Arizona)" },
  { token: "portal_link", label: "Link to the applicant's portal" },
  { token: "scheduling_link", label: "Verification call scheduling link" },
  { token: "employer_application_link", label: "Employer application link" },
  { token: "assessment_link", label: "TestGorilla assessment link" },
  { token: "admissions_note", label: "Note typed by admissions" },
  { token: "choices", label: "The applicant's ranked cohort choices" },
  { token: "cohort_name", label: "Cohort name" },
  { token: "cohort_start", label: "Cohort start date" },
  { token: "cohort_end", label: "Cohort end date" },
  { token: "cohort_location", label: "Cohort location" },
  { token: "cohort_details", label: "Full cohort details block" },
  { token: "session_date", label: "Class date (missed-session email)" },
  { token: "message_preview", label: "Message text (new message email)" },
  { token: "announcement_subject", label: "Announcement subject" },
  { token: "announcement_body", label: "Announcement text" },
  { token: "completed_on", label: "Completion date" },
  { token: "credentials", label: "Credentials earned" },
  { token: "hired_employer", label: "Hiring employer" },
  { token: "job_title", label: "Job title" },
  { token: "start_date", label: "Job start date" },
  { token: "role", label: "Staff role (staff emails)" },
  { token: "organization", label: "Employer organization (staff emails)" },
];
const KNOWN_TOKENS = new Set(EMAIL_TOKENS.map((t) => t.token));

/** A context where every value is its {{placeholder}}: rendering it gives the editable default wording. */
const TOKEN_CTX: EmailContext = {
  applicationId: null,
  to: "{{email}}",
  firstName: "{{first_name}}",
  programName: "{{program_name}}",
  employerPartner: "{{employer}}",
  programSlug: null,
  examUrl: "{{assessment_link}}",
  verificationUrl: "{{scheduling_link}}",
  employerApplicationUrl: "{{employer_application_link}}",
  cohort: { name: "{{cohort_name}}", format: "", start_date: "{{cohort_start}}", end_date: "{{cohort_end}}", schedule: "", location: "{{cohort_location}}", address: null },
  note: "{{admissions_note}}",
  sessionDate: "{{session_date}}",
  choices: [{ rank: 1, name: "{{choices}}", start_date: "", end_date: "", location: "" }],
  messagePreview: "{{message_preview}}",
  roleLabel: "{{role}}",
  orgName: "{{organization}}",
  announcement: { subject: "{{announcement_subject}}", body: "{{announcement_body}}" },
  outcome: { completedOn: "{{completed_on}}", completionNote: "{{credentials}}", employer: "{{hired_employer}}", jobTitle: "{{job_title}}", startDate: "{{start_date}}" },
};

const ENTITIES: Record<string, string> = {
  lt: "<", gt: ">", quot: '"', amp: "&", nbsp: " ", rsquo: "\u2019", lsquo: "\u2018", ldquo: "\u201c", rdquo: "\u201d",
  mdash: "\u2014", ndash: "\u2013", hellip: "\u2026", middot: "\u00b7", rarr: "\u2192",
};
function unescapeHtml(s: string): string {
  return s.replace(/&(#\d+|[a-z]+);/gi, (m, e: string) =>
    e.startsWith("#") ? String.fromCharCode(Number(e.slice(1))) : (ENTITIES[e.toLowerCase()] ?? m),
  );
}

/** Turns one rendered paragraph back into editable text (bold/italic kept, links shown as their text). */
function htmlToMarkup(html: string): string {
  return unescapeHtml(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<strong>([\s\S]*?)<\/strong>/gi, "**$1**")
      .replace(/<em>([\s\S]*?)<\/em>/gi, "*$1*")
      .replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, "$1")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

/** The built-in wording of a template, in the editable form shown to admins. */
export function defaultTemplate(template: EmailTemplate): TemplateOverride & { hasButton: boolean } {
  const r = renderEmail(template, TOKEN_CTX);
  return {
    subject: r.subject,
    heading: r.heading,
    // Links to the portal are per applicant, so they become the {{portal_link}} placeholder.
    body: r.paragraphs
      .map(htmlToMarkup)
      .filter(Boolean)
      .join("\n\n")
      .replace(new RegExp(`${SITE_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/portal[^\\s)]*`, "g"), "{{portal_link}}"),
    cta_label: r.cta?.label ?? null,
    hasButton: !!r.cta,
  };
}

/** Placeholders in a piece of text that the system doesn't know. */
export function unknownTokens(text: string): string[] {
  return Array.from(new Set(Array.from(text.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/g), (m) => m[1]).filter((t) => !KNOWN_TOKENS.has(t))));
}

type TokenValue = { text: string; html?: string };

function link(url: string | null | undefined): TokenValue {
  if (!url) return { text: "" };
  return { text: url, html: `<a href="${attr(url)}" style="color:#8C1D40">${esc(url)}</a>` };
}

function tokenValues(ctx: EmailContext): Record<string, TokenValue> {
  const c = ctx.cohort;
  const t = (v: string | null | undefined): TokenValue => ({ text: v ?? "" });
  return {
    first_name: t(ctx.firstName),
    email: t(ctx.to),
    program_name: t(ctx.programName),
    employer: t(ctx.employerPartner ?? "our employer partner"),
    portal_link: link(portal(ctx.applicationId)),
    scheduling_link: link(ctx.verificationUrl),
    employer_application_link: link(ctx.employerApplicationUrl),
    assessment_link: link(ctx.examUrl),
    admissions_note: t(ctx.note),
    choices: { text: ctx.choices?.map((x) => `#${x.rank} ${x.name}`).join(", ") ?? "", html: choiceLines(ctx.choices)[0] ?? "" },
    cohort_name: t(c?.name),
    cohort_start: t(c ? fd(c.start_date) : ""),
    cohort_end: t(c ? fd(c.end_date) : ""),
    cohort_location: t(c?.location),
    cohort_details: { text: c?.name ?? "", html: cohortLines(c ?? null)[0] ?? "" },
    session_date: t(ctx.sessionDate ? fd(ctx.sessionDate) : ""),
    message_preview: t(ctx.messagePreview?.slice(0, 280)),
    announcement_subject: t(ctx.announcement?.subject),
    announcement_body: { text: ctx.announcement?.body ?? "", html: esc(ctx.announcement?.body ?? "").replace(/\n{2,}/g, "<br/><br/>").replace(/\n/g, "<br/>") },
    completed_on: t(ctx.outcome?.completedOn ? fd(ctx.outcome.completedOn) : ""),
    credentials: t(ctx.outcome?.completionNote),
    hired_employer: t(ctx.outcome?.employer),
    job_title: t(ctx.outcome?.jobTitle),
    start_date: t(ctx.outcome?.startDate ? fd(ctx.outcome.startDate) : ""),
    role: t(ctx.roleLabel),
    organization: t(ctx.orgName),
  };
}

const TOKEN_RE = /\{\{\s*([a-z_]+)\s*\}\}/g;

/** Plain-text substitution (subject, heading, button label). */
function fillText(s: string, vals: Record<string, TokenValue>): string {
  return s.replace(TOKEN_RE, (m, k: string) => (k in vals ? vals[k].text : m)).replace(/\s{2,}/g, " ").trim();
}

/**
 * Body markup → email paragraphs. A block whose placeholder has no value for this applicant (for example
 * {{admissions_note}} when admissions wrote no note) is left out rather than sent half-empty.
 */
function fillBody(body: string, vals: Record<string, TokenValue>): string[] {
  const out: string[] = [];
  const inline = (xs: Inline[], ref: { empty: boolean }) =>
    xs
      .map((x) => {
        const html = esc(x.text).replace(TOKEN_RE, (m, k: string) => {
          if (!(k in vals)) return m;
          if (!vals[k].text && !vals[k].html) ref.empty = true;
          return vals[k].html ?? esc(vals[k].text);
        });
        if (x.bold) return `<strong>${html}</strong>`;
        if (x.italic) return `<em>${html}</em>`;
        if (x.underline) return `<u>${html}</u>`;
        return html;
      })
      .join("");
  for (const b of parseRichText(body)) {
    const ref = { empty: false };
    let html: string;
    if (b.type === "heading") html = `<strong style="font-size:17px">${inline(b.inline, ref)}</strong>`;
    else if (b.type === "paragraph") html = b.lines.map((l) => inline(l, ref)).join("<br/>");
    else {
      const tag = b.type === "bullets" ? "ul" : "ol";
      html = `<${tag} style="margin:0;padding-left:22px">${b.items.map((it) => `<li style="margin:0 0 6px">${inline(it, ref)}</li>`).join("")}</${tag}>`;
    }
    if (!ref.empty) out.push(html);
  }
  return out;
}

/** The email as it will be sent: the built-in version, with an admin's customized wording applied when there is one. */
export function renderWithOverride(template: EmailTemplate, ctx: EmailContext, ov?: TemplateOverride | null): Rendered {
  const base = renderEmail(template, ctx);
  if (!ov) return base;
  const vals = tokenValues(ctx);
  return {
    ...base,
    subject: fillText(ov.subject, vals) || base.subject,
    heading: fillText(ov.heading, vals) || base.heading,
    paragraphs: fillBody(ov.body, vals),
    cta: base.cta ? { ...base.cta, label: (ov.cta_label && fillText(ov.cta_label, vals)) || base.cta.label } : undefined,
  };
}

/** Sample data for the template preview. */
export function sampleContext(programName: string, employer: string | null): EmailContext {
  return {
    applicationId: "preview",
    to: "alex.rivera@example.com",
    firstName: "Alex",
    programName,
    employerPartner: employer,
    programSlug: null,
    examUrl: "https://app.testgorilla.com/s/sample",
    verificationUrl: "https://calendly.com/foundryready/verification",
    employerApplicationUrl: "https://careers.example.com/apply",
    cohort: { name: "Accelerator · Mar 2027", format: "5-Week Accelerator", start_date: "2027-03-01", end_date: "2027-04-02", schedule: "Mon–Fri · 8:00 AM – 4:30 PM", location: "Tempe", address: "1151 S Forest Ave, Tempe, AZ" },
    note: "Please bring a photo ID on the first day.",
    choices: [
      { rank: 1, name: "Accelerator · Mar 2027", start_date: "2027-03-01", end_date: "2027-04-02", location: "Tempe" },
      { rank: 2, name: "Saturday · Apr 2027", start_date: "2027-04-03", end_date: "2027-08-07", location: "Phoenix" },
    ],
    messagePreview: "Hi Alex, just checking in about your cohort choices.",
    roleLabel: "Program admin",
    orgName: "TSMC Arizona",
    announcement: { subject: "Lab moves to Building B", body: "Starting Monday, labs meet in Building B, room 120.\n\nParking is in Lot 59." },
    outcome: { completedOn: "2027-04-02", completionNote: "OSHA-10, IPC-A-610", employer: "TSMC Arizona", jobTitle: "Equipment Technician", startDate: "2027-05-03" },
  };
}
