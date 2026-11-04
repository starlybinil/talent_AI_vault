import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/session";
import { Badge, Card, PageHeader } from "@/components/ui";
import { EMAIL_TEMPLATE_INFO } from "@/lib/email";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Email templates" };

const GROUPS = ["Admissions", "Enrollment & program", "Accounts & messages"] as const;

export default async function EmailTemplatesPage() {
  await requirePermission("programs.manage", "/admin/email-templates");
  const supabase = await createClient();
  const { data: custom } = await supabase.from("email_templates").select("key, updated_at");
  const customized = new Map((custom ?? []).map((c) => [c.key as string, c.updated_at as string]));

  return (
    <div>
      <PageHeader
        eyebrow="Communications"
        title="Email templates"
        description="Edit the wording of every email applicants receive. Placeholders like {{first_name}} are filled in for each applicant. Links such as the scheduling, employer application and assessment links are set on each program's page. Sign-up and password emails are sent by Supabase and edited there."
      />

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
