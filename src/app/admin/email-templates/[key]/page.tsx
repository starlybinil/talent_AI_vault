import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/session";
import { EMAIL_TEMPLATE_INFO, EMAIL_TOKENS, defaultTemplate, renderHtml, renderWithOverride, sampleContext, type TemplateOverride } from "@/lib/email";
import type { EmailTemplate } from "@/lib/workflow";
import { Alert, Badge, Card, PageHeader } from "@/components/ui";
import { EmailTemplateEditor } from "@/components/admin/EmailTemplateEditor";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Edit email template" };

export default async function EditEmailTemplate({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<{ reset?: string }> }) {
  const { key } = await params;
  const { reset } = await searchParams;
  await requirePermission("programs.manage", `/admin/email-templates/${key}`);
  const info = EMAIL_TEMPLATE_INFO.find((t) => t.key === key);
  if (!info) notFound();
  const supabase = await createClient();
  const [{ data: saved }, { data: program }] = await Promise.all([
    supabase.from("email_templates").select("subject, heading, body, cta_label, updated_at").eq("key", key).maybeSingle(),
    supabase.from("programs").select("name, short_name, employer_partner").eq("active", true).order("sort").limit(1).maybeSingle(),
  ]);
  const def = defaultTemplate(key as EmailTemplate);
  const current: TemplateOverride = saved ?? def;
  const sample = sampleContext(program?.short_name ?? "Foundations of Equipment Technician", program?.employer_partner ?? "TSMC-Arizona");
  // Preview of what's live now (saved wording, or the default).
  const preview = renderWithOverride(key as EmailTemplate, sample, saved ?? null);

  return (
    <div>
      <Link href="/admin/email-templates" className="inline-flex items-center gap-1.5 text-sm font-bold text-ink/60 hover:text-maroon">
        <ArrowLeft className="h-4 w-4" /> All email templates
      </Link>
      <div className="mt-4">
        <PageHeader eyebrow={info.group} title={info.name} description={`Sent: ${info.when}.`} />
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        {saved ? <Badge tone="info">Customized · saved {formatDateTime(saved.updated_at)}</Badge> : <Badge tone="neutral">Using the default wording</Badge>}
      </div>
      {reset && (
        <Alert tone="success" className="mb-4">
          Restored the default wording.
        </Alert>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="grid content-start gap-6">
          <EmailTemplateEditor templateKey={key} current={current} defaults={def} hasButton={def.hasButton} customized={!!saved} />
          <Card>
            <h2 className="font-black">Preview of what applicants receive now</h2>
            <p className="mt-1 text-sm text-ink/60">
              With sample data. Subject: <strong className="text-ink">{preview.subject}</strong>. Save to update the preview.
            </p>
            <iframe
              title="Email preview"
              srcDoc={renderHtml({ ...preview, statusLabel: null })}
              className="mt-4 h-[720px] w-full rounded-xl border border-ink/10 bg-white"
              sandbox=""
            />
          </Card>
        </div>
        <Card className="h-fit xl:sticky xl:top-6">
          <h2 className="font-black">Placeholders</h2>
          <p className="mt-1 text-xs text-ink/60">
            Type these anywhere in the subject, heading, text or button. A paragraph whose placeholder has nothing to fill (for example no admissions note)
            is left out of that email.
          </p>
          <ul className="mt-3 space-y-1.5 text-xs">
            {EMAIL_TOKENS.map((t) => (
              <li key={t.token}>
                <code className="rounded bg-mist px-1.5 py-0.5 font-mono text-maroon">{`{{${t.token}}}`}</code> <span className="text-ink/60">{t.label}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
