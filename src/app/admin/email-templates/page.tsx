import Link from "next/link";
import { ArrowRight, Link2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/session";
import { saveProgramLinks } from "@/app/admin/actions";
import { ActionForm, SubmitButton } from "@/components/ui/forms";
import { Badge, Card, Input, Label, PageHeader } from "@/components/ui";
import { EMAIL_TEMPLATE_INFO } from "@/lib/email";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Email templates" };

const GROUPS = ["Admissions", "Enrollment & program", "Accounts & messages"] as const;

export default async function EmailTemplatesPage() {
  await requirePermission("programs.manage", "/admin/email-templates");
  const supabase = await createClient();
  const [{ data: custom }, { data: programs }] = await Promise.all([
    supabase.from("email_templates").select("key, updated_at"),
    supabase.from("programs").select("id, short_name, active, default_exam_url, verification_scheduling_url, employer_application_url").order("sort"),
  ]);
  const customized = new Map((custom ?? []).map((c) => [c.key as string, c.updated_at as string]));

  return (
    <div>
      <PageHeader
        eyebrow="Communications"
        title="Email templates"
        description="Edit the wording of every email applicants receive. Placeholders like {{first_name}} are filled in for each applicant. Sign-up and password emails are sent by Supabase and edited there."
      />

      <Card className="mb-6">
        <h2 className="flex items-center gap-2 text-lg font-black">
          <Link2 className="h-5 w-5 text-maroon" aria-hidden /> Links used in emails
        </h2>
        <p className="mt-1 text-sm text-ink/60">
          Save each program&apos;s links once. They&apos;re pre-filled whenever admissions sends that step, and can still be changed for one applicant
          before sending.
        </p>
        <div className="mt-5 grid gap-5">
          {(programs ?? []).map((p) => (
            <ActionForm key={p.id} action={saveProgramLinks} className="grid gap-3 rounded-2xl border border-ink/10 p-4">
              <input type="hidden" name="program_id" value={p.id} />
              <p className="font-black">
                {p.short_name} {!p.active && <Badge tone="neutral">Inactive</Badge>}
              </p>
              <div className="grid gap-3 lg:grid-cols-3">
                <div>
                  <Label htmlFor={`v-${p.id}`}>1. Verification call scheduling link</Label>
                  <Input id={`v-${p.id}`} name="verification_scheduling_url" type="url" defaultValue={p.verification_scheduling_url ?? ""} placeholder="https://calendly.com/…" />
                </div>
                <div>
                  <Label htmlFor={`e-${p.id}`}>2. Employer application link</Label>
                  <Input id={`e-${p.id}`} name="employer_application_url" type="url" defaultValue={p.employer_application_url ?? ""} placeholder="https://…" />
                </div>
                <div>
                  <Label htmlFor={`x-${p.id}`}>3. TestGorilla assessment link</Label>
                  <Input id={`x-${p.id}`} name="default_exam_url" type="url" defaultValue={p.default_exam_url ?? ""} placeholder="https://app.testgorilla.com/…" />
                </div>
              </div>
              <SubmitButton size="sm" variant="dark" className="justify-self-start" pendingText="Saving…">
                Save links
              </SubmitButton>
            </ActionForm>
          ))}
        </div>
      </Card>

      {GROUPS.map((g) => (
        <Card key={g} className="mb-6 p-0">
          <h2 className="border-b border-ink/10 px-5 py-4 text-sm font-black uppercase tracking-wider text-ink/60">{g}</h2>
          <ul className="divide-y divide-ink/5">
            {EMAIL_TEMPLATE_INFO.filter((t) => t.group === g).map((t) => {
              const at = customized.get(t.key);
              return (
                <li key={t.key}>
                  <Link href={`/admin/email-templates/${t.key}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-mist">
                    <span className="min-w-0">
                      <span className="block font-bold">{t.name}</span>
                      <span className="text-xs text-ink/50">Sent: {t.when}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      {at ? <Badge tone="info">Customized · {formatDate(at)}</Badge> : <Badge tone="neutral">Default</Badge>}
                      <ArrowRight className="h-4 w-4 text-ink/40" aria-hidden />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      ))}
    </div>
  );
}
