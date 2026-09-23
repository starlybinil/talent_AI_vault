import Link from "next/link";
import { ArrowRight, CalendarDays } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/session";
import { Bars } from "@/components/admin/Bars";
import { ButtonLink, Card, EmptyState, PageHeader, Stat } from "@/components/ui";
import { STATUS_LABEL, type Status } from "@/lib/workflow";
import { candidateName, type Candidate } from "@/lib/employer";
import { audit } from "@/lib/audit";

export const metadata = { title: "Employer portal" };

type Pipe = { program_id: string; program_name: string; status: Status; n: number };

export default async function EmployerHome() {
  const session = await requirePermission("employer.portal", "/employer");
  const supabase = await createClient();
  const [{ data: pipeline }, { data: candidates }, { data: orgs }] = await Promise.all([
    supabase.rpc("employer_pipeline"),
    supabase.rpc("employer_list_candidates"),
    supabase.from("employer_orgs").select("name").in("id", session.employerOrgIds),
  ]);
  const pipe = (pipeline ?? []) as Pipe[];
  const cands = (candidates ?? []) as Candidate[];
  const programs = Array.from(new Map(pipe.map((p) => [p.program_id, p.program_name])).entries());
  const total = pipe.reduce((a, p) => a + Number(p.n), 0);
  const count = (s: Status[]) => pipe.filter((p) => s.includes(p.status)).reduce((a, p) => a + Number(p.n), 0);
  await audit(supabase, "employer.dashboard.view", "employer_portal", null);

  return (
    <div>
      <PageHeader
        eyebrow={(orgs ?? []).map((o) => o.name).join(", ") || "Employer partner"}
        title="Talent pipeline"
        description="Live progress of candidates in the programs you partner on. Individual details are shown only for applicants who consented."
        actions={
          <>
            <ButtonLink href="/employer/cohorts" variant="outline">
              <CalendarDays className="h-4 w-4" /> Cohort calendar
            </ButtonLink>
            <ButtonLink href="/employer/candidates" variant="dark">
              View candidates <ArrowRight className="h-4 w-4" />
            </ButtonLink>
          </>
        }
      />
      {programs.length === 0 ? (
        <EmptyState title="Your organization isn't linked to a program yet">Ask your Talent-Vault contact to add you as a program partner.</EmptyState>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <Stat label="Applicants" value={total} />
            <Stat label="In assessment" value={count(["exam_invited"])} />
            <Stat
              label="Passed assessment"
              value={count(["exam_passed", "cohort_selection", "cohort_registered", "waitlisted", "agreements_pending", "agreements_submitted", "confirmed", "completed", "hired"])}
            />
            <Stat label="In training (confirmed)" value={count(["confirmed"])} />
            <Stat label="Program graduates" value={count(["completed", "hired"])} hint="available + hired" />
            <Stat label="Hired" value={count(["hired"])} />
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            {programs.map(([pid, name]) => (
              <Card key={pid}>
                <h2 className="font-black">{name}</h2>
                <div className="mt-4">
                  <Bars data={pipe.filter((p) => p.program_id === pid).map((p) => ({ label: STATUS_LABEL[p.status], value: Number(p.n) }))} />
                </div>
              </Card>
            ))}
            <Card>
              <h2 className="font-black">Recently updated candidates</h2>
              <ul className="mt-4 divide-y divide-ink/5">
                {cands.slice(0, 8).map((c) => (
                  <li key={c.application_id} className="py-2.5">
                    <Link href={`/employer/candidates/${c.application_id}`} className="flex items-center justify-between text-sm hover:text-maroon">
                      <span className="font-bold">{candidateName(c)}</span>
                      <span className="text-ink/50">{c.fields.status ? STATUS_LABEL[c.fields.status as Status] : c.program_name}</span>
                    </Link>
                  </li>
                ))}
                {cands.length === 0 && <li className="py-3 text-sm text-ink/50">No consenting candidates yet.</li>}
              </ul>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
