import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/session";
import { AgreementsEditor, type AgreementTemplate } from "@/components/admin/AgreementsEditor";
import { EmptyState, PageHeader } from "@/components/ui";
import { cn } from "@/lib/utils";

export const metadata = { title: "Program agreements" };

export default async function AgreementsPage({ searchParams }: { searchParams: Promise<{ program?: string }> }) {
  const sp = await searchParams;
  await requirePermission("programs.manage", "/admin/agreements");
  const supabase = await createClient();
  const { data: programs } = await supabase.from("programs").select("id, short_name, active").order("sort");
  const selected = (programs ?? []).find((p) => p.id === sp.program) ?? (programs ?? [])[0];
  const { data: templates } = selected
    ? await supabase.from("agreement_templates").select("id, title, body, version, required, active").eq("program_id", selected.id).order("sort")
    : { data: [] };

  return (
    <div>
      <PageHeader
        eyebrow="Programs"
        title="Program agreements"
        description="Load and maintain the agreement text for each program. Every applicant to the program sees the same agreements."
      />
      {!selected ? (
        <EmptyState title="No programs yet" />
      ) : (
        <>
          {(programs ?? []).length > 1 && (
            <div className="mb-6 flex flex-wrap gap-2">
              {(programs ?? []).map((p) => (
                <Link
                  key={p.id}
                  href={`?program=${p.id}`}
                  className={cn("rounded-full px-4 py-2 text-sm font-bold", p.id === selected.id ? "bg-ink text-white" : "bg-white text-ink/70 hover:text-ink")}
                >
                  {p.short_name}
                  {!p.active && <span className="ml-1 opacity-60">(inactive)</span>}
                </Link>
              ))}
            </div>
          )}
          <AgreementsEditor key={selected.id} programId={selected.id} templates={(templates ?? []) as AgreementTemplate[]} />
        </>
      )}
    </div>
  );
}
