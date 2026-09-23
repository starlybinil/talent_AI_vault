import Link from "next/link";
import { Download, Star } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/session";
import { Badge, Card, EmptyState, PageHeader, Select, buttonClass } from "@/components/ui";
import { FIELD_LABEL, candidateName, displayField, type Candidate } from "@/lib/employer";
import { STATUS_TONE, type Status } from "@/lib/workflow";
import { audit } from "@/lib/audit";

export const metadata = { title: "Candidates" };

export default async function CandidatesPage({ searchParams }: { searchParams: Promise<{ program?: string; shortlisted?: string; stage?: string }> }) {
  const sp = await searchParams;
  await requirePermission("employer.portal", "/employer/candidates");
  const supabase = await createClient();
  const [{ data }, { data: partnered }] = await Promise.all([
    supabase.rpc("employer_list_candidates", { p_program: sp.program || null }),
    supabase.from("program_partners").select("program_id, programs(short_name)"),
  ]);
  let rows = (data ?? []) as Candidate[];
  if (sp.shortlisted === "1") rows = rows.filter((r) => r.shortlisted);
  if (sp.stage === "passed") rows = rows.filter((r) => r.fields.exam_result === "passed");
  if (sp.stage === "confirmed") rows = rows.filter((r) => r.fields.status === "confirmed");
  const columns = Array.from(new Set(rows.flatMap((r) => Object.keys(r.fields)))).filter((k) => !["first_name", "last_name"].includes(k));
  await audit(supabase, "employer.candidates.list", "employer_portal", null, { count: rows.length });
  const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <div>
      <PageHeader
        eyebrow="Employer portal"
        title="Candidates"
        description="Only fields your program partnership allows are shown, and only for applicants who agreed to share them."
        actions={
          <a href={`/employer/export?${qs}`} className={buttonClass("outline", "md")}>
            <Download className="h-4 w-4" /> Export CSV
          </a>
        }
      />
      <Card className="mb-4 p-4">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <Select name="program" defaultValue={sp.program ?? ""} className="w-64" aria-label="Program">
            <option value="">All partnered programs</option>
            {(partnered ?? []).map((p) => {
              const prog = Array.isArray(p.programs) ? p.programs[0] : p.programs;
              return (
                <option key={p.program_id} value={p.program_id}>
                  {prog?.short_name}
                </option>
              );
            })}
          </Select>
          <Select name="stage" defaultValue={sp.stage ?? ""} className="w-56" aria-label="Stage">
            <option value="">Any stage</option>
            <option value="passed">Passed assessment</option>
            <option value="confirmed">Confirmed trainees</option>
          </Select>
          <label className="mb-3 flex items-center gap-2 text-sm font-bold">
            <input type="checkbox" name="shortlisted" value="1" defaultChecked={sp.shortlisted === "1"} className="h-4 w-4 accent-maroon" /> Shortlisted only
          </label>
          <button className={buttonClass("dark", "md", "mb-0.5")}>Apply</button>
        </form>
      </Card>
      {rows.length === 0 ? (
        <EmptyState title="No candidates to show" />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ink/10 bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-mist text-xs uppercase tracking-wider text-ink/50">
              <tr>
                <th className="px-4 py-3">Candidate</th>
                {columns.map((c) => (
                  <th key={c} className="px-4 py-3">
                    {FIELD_LABEL[c] ?? c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/5">
              {rows.map((r) => (
                <tr key={r.application_id} className="hover:bg-mist/60">
                  <td className="px-4 py-3">
                    <Link href={`/employer/candidates/${r.application_id}`} className="flex items-center gap-1.5 font-bold hover:text-maroon">
                      {r.shortlisted && <Star className="h-4 w-4 fill-gold text-gold" aria-label="Shortlisted" />}
                      {candidateName(r)}
                    </Link>
                    <p className="text-xs text-ink/50">{r.program_name}</p>
                  </td>
                  {columns.map((c) => (
                    <td key={c} className="px-4 py-3 text-ink/70">
                      {c === "status" && r.fields.status ? (
                        <Badge tone={STATUS_TONE[r.fields.status as Status]}>{displayField(c, r.fields[c])}</Badge>
                      ) : (
                        displayField(c, r.fields[c])
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
