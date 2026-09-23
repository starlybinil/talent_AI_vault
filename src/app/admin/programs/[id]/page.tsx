import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/session";
import { ProgramForm } from "@/components/admin/ProgramForm";
import { AgreementsEditor } from "@/components/admin/AgreementsEditor";
import { setProgramPartner } from "@/app/admin/actions";
import { ActionForm, SubmitButton } from "@/components/ui/forms";
import { Card, Label, PageHeader, Select } from "@/components/ui";
import type { Program } from "@/lib/data";

export default async function ProgramDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePermission("programs.manage", `/admin/programs/${id}`);
  const supabase = await createClient();
  const { data: program } = await supabase.from("programs").select("*").eq("id", id).maybeSingle();
  if (!program) notFound();
  const [{ data: templates }, { data: partners }, { data: orgs }] = await Promise.all([
    supabase.from("agreement_templates").select("*").eq("program_id", id).order("sort"),
    supabase.from("program_partners").select("employer_org_id, employer_orgs(name)").eq("program_id", id),
    supabase.from("employer_orgs").select("id, name").order("name"),
  ]);
  const partnerIds = new Set((partners ?? []).map((p) => p.employer_org_id));

  return (
    <div>
      <Link href="/admin/programs" className="inline-flex items-center gap-1.5 text-sm font-bold text-ink/60 hover:text-maroon">
        <ArrowLeft className="h-4 w-4" /> All programs
      </Link>
      <div className="mt-4">
        <PageHeader
          eyebrow={`/${program.slug}`}
          title={program.short_name}
          actions={
            <a href={`/programs/${program.slug}`} target="_blank" className="inline-flex items-center gap-1.5 text-sm font-bold text-maroon hover:underline">
              View landing page <ExternalLink className="h-4 w-4" />
            </a>
          }
        />
      </div>
      <Card>
        <ProgramForm program={program as Program} adminFields />
      </Card>

      <Card className="mt-6">
        <h2 className="text-lg font-black">Employer partners</h2>
        <p className="text-sm text-ink/60">Partner employers can log in to the employer portal and see consenting applicants in this program.</p>
        <ul className="mt-4 space-y-2">
          {(partners ?? []).map((p) => {
            const org = Array.isArray(p.employer_orgs) ? p.employer_orgs[0] : p.employer_orgs;
            return (
              <li key={p.employer_org_id} className="flex items-center justify-between rounded-xl bg-mist px-4 py-3">
                <span className="font-bold">{org?.name}</span>
                <ActionForm action={setProgramPartner}>
                  <input type="hidden" name="program_id" value={id} />
                  <input type="hidden" name="employer_org_id" value={p.employer_org_id} />
                  <input type="hidden" name="remove" value="1" />
                  <SubmitButton variant="ghost" size="sm">Remove</SubmitButton>
                </ActionForm>
              </li>
            );
          })}
        </ul>
        <ActionForm action={setProgramPartner} className="mt-4 flex flex-wrap items-end gap-3">
          <input type="hidden" name="program_id" value={id} />
          <div>
            <Label>Add partner</Label>
            <Select name="employer_org_id" required className="w-64">
              <option value="">Choose organization…</option>
              {(orgs ?? [])
                .filter((o) => !partnerIds.has(o.id))
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
            </Select>
          </div>
          <SubmitButton variant="dark">Add</SubmitButton>
        </ActionForm>
      </Card>

      <div className="mt-6">
        <AgreementsEditor programId={id} templates={templates ?? []} />
      </div>
    </div>
  );
}
