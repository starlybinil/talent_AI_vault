import Link from "next/link";
import { Download, KanbanSquare, List, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/session";
import { can } from "@/lib/rbac";
import { queueQuery, type QueueFilters } from "@/lib/admin-queries";
import { bulkAct } from "@/app/admin/actions";
import { SelectAll } from "@/components/admin/SelectAll";
import { ActionForm, SubmitButton } from "@/components/ui/forms";
import { Badge, Card, EmptyState, Input, PageHeader, Select, buttonClass } from "@/components/ui";
import { EDUCATION_LABEL, STATUSES, STATUS_LABEL, STATUS_TONE, VISA_LABEL, type Status } from "@/lib/workflow";
import { EDUCATION_LEVELS, VISA_OPTIONS } from "@/lib/validation";
import { cn, formatDate } from "@/lib/utils";

export const metadata = { title: "Applications" };

type Row = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  highest_education: string;
  visa_sponsorship: string;
  status: Status;
  exam_self_reported_at: string | null;
  submitted_at: string;
  utm_source: string | null;
  programs: { short_name: string } | null;
  cohorts: { name: string } | null;
};

const BOARD: Status[] = ["submitted", "screening", "screening_passed", "exam_invited", "cohort_selection", "waitlisted", "agreements_pending", "agreements_submitted", "confirmed"];

export default async function ApplicationsPage({ searchParams }: { searchParams: Promise<QueueFilters & { view?: string }> }) {
  const sp = await searchParams;
  const session = await requirePermission("admissions.read", "/admin/applications");
  const canManage = can(session.roles, "admissions.manage");
  const supabase = await createClient();
  const [{ data, error }, { data: programs }] = await Promise.all([
    queueQuery(supabase, sp).limit(500),
    supabase.from("programs").select("id, short_name").order("sort"),
  ]);
  const rows = (data ?? []) as unknown as Row[];
  const view = sp.view === "board" ? "board" : "table";
  const qs = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== "view") as [string, string][]).toString();

  return (
    <div>
      <PageHeader
        eyebrow="Admissions"
        title="Application queue"
        description={`${rows.length} application${rows.length === 1 ? "" : "s"}${rows.length === 500 ? " (showing first 500 — refine filters)" : ""}`}
        actions={
          <>
            <div className="flex rounded-full bg-white p-1 shadow-sm">
              <Link href={`?${qs}&view=table`} className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold", view === "table" ? "bg-ink text-white" : "text-ink/60")}>
                <List className="h-4 w-4" /> Table
              </Link>
              <Link href={`?${qs}&view=board`} className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold", view === "board" ? "bg-ink text-white" : "text-ink/60")}>
                <KanbanSquare className="h-4 w-4" /> Board
              </Link>
            </div>
            <a href={`/admin/applications/export?${qs}`} className={buttonClass("outline", "md")}>
              <Download className="h-4 w-4" /> Export CSV
            </a>
          </>
        }
      />

      <Card className="mb-6 p-4">
        <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto]" method="get">
          <input type="hidden" name="view" value={view} />
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 mt-0.5 h-4 w-4 -translate-y-1/2 text-ink/40" />
            <Input name="q" defaultValue={sp.q} placeholder="Search name, email or phone" className="pl-9" aria-label="Search" />
          </div>
          <Select name="program" defaultValue={sp.program ?? ""} aria-label="Program">
            <option value="">All programs</option>
            {(programs ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.short_name}
              </option>
            ))}
          </Select>
          <Select name="status" defaultValue={sp.status ?? ""} aria-label="Stage">
            <option value="">All stages</option>
            <option value="active">Active (in progress)</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
          <Select name="visa" defaultValue={sp.visa ?? ""} aria-label="Visa">
            <option value="">Any visa answer</option>
            {VISA_OPTIONS.map((v) => (
              <option key={v} value={v}>
                Visa: {VISA_LABEL[v]}
              </option>
            ))}
          </Select>
          <Select name="education" defaultValue={sp.education ?? ""} aria-label="Education">
            <option value="">Any education</option>
            {EDUCATION_LEVELS.map((e) => (
              <option key={e} value={e}>
                {EDUCATION_LABEL[e]}
              </option>
            ))}
          </Select>
          <div className="flex gap-2 sm:mt-1.5">
            <button className={buttonClass("dark", "md")} type="submit">
              Filter
            </button>
            <Link href="/admin/applications" className={buttonClass("ghost", "md")}>
              Reset
            </Link>
          </div>
        </form>
      </Card>

      {error && <p className="mb-4 text-sm text-red-700">{error.message}</p>}

      {rows.length === 0 ? (
        <EmptyState title="No applications match these filters" />
      ) : view === "board" ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {BOARD.map((stage) => {
            const items = rows.filter((r) => r.status === stage);
            return (
              <div key={stage} className="w-72 shrink-0">
                <div className="mb-3 flex items-center justify-between">
                  <Badge tone={STATUS_TONE[stage]}>{STATUS_LABEL[stage]}</Badge>
                  <span className="text-sm font-bold text-ink/50">{items.length}</span>
                </div>
                <div className="space-y-2">
                  {items.map((r) => (
                    <Link key={r.id} href={`/admin/applications/${r.id}`} className="block rounded-xl border border-ink/10 bg-white p-3 shadow-sm transition hover:border-maroon">
                      <p className="font-bold text-ink">
                        {r.first_name} {r.last_name}
                      </p>
                      <p className="truncate text-xs text-ink/50">{r.email}</p>
                      <p className="mt-2 text-xs text-ink/50">
                        {formatDate(r.submitted_at)} · {EDUCATION_LABEL[r.highest_education]}
                      </p>
                      {r.exam_self_reported_at && stage === "exam_invited" && <Badge tone="success" className="mt-2">Says exam done</Badge>}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <ActionForm action={bulkAct}>
          {canManage && (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Select name="op" defaultValue="" className="mt-0 h-10 w-auto" aria-label="Bulk action">
                <option value="">Bulk action…</option>
                <option value="start_screening">Move to screening</option>
                <option value="pass_screening">Pass screening</option>
                <option value="pass_and_invite">Pass screening & send assessment invite</option>
                <option value="send_invite">Send assessment invite</option>
                <option value="send_reminder">Send assessment reminder</option>
                <option value="not_selected">Mark not selected</option>
              </Select>
              <SubmitButton variant="dark" size="sm" pendingText="Applying…">
                Apply to selected
              </SubmitButton>
            </div>
          )}
          <div className="overflow-x-auto rounded-2xl border border-ink/10 bg-white">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-mist text-xs uppercase tracking-wider text-ink/50">
                <tr>
                  {canManage && (
                    <th className="w-10 px-4 py-3">
                      <SelectAll />
                    </th>
                  )}
                  <th className="px-4 py-3">Applicant</th>
                  <th className="px-4 py-3">Program</th>
                  <th className="px-4 py-3">Stage</th>
                  <th className="px-4 py-3">Education</th>
                  <th className="px-4 py-3">Visa</th>
                  <th className="px-4 py-3">Cohort</th>
                  <th className="px-4 py-3">Applied</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/5">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-mist/60">
                    {canManage && (
                      <td className="px-4 py-3">
                        <input type="checkbox" name="ids" value={r.id} className="h-4 w-4 accent-maroon" aria-label={`Select ${r.first_name} ${r.last_name}`} />
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <Link href={`/admin/applications/${r.id}`} className="font-bold text-ink hover:text-maroon">
                        {r.first_name} {r.last_name}
                      </Link>
                      <p className="text-xs text-ink/50">{r.email}</p>
                    </td>
                    <td className="px-4 py-3 text-ink/70">{r.programs?.short_name}</td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                      {r.exam_self_reported_at && r.status === "exam_invited" && <p className="mt-1 text-xs text-emerald-700">Says exam done</p>}
                    </td>
                    <td className="px-4 py-3 text-ink/70">{EDUCATION_LABEL[r.highest_education]}</td>
                    <td className="px-4 py-3 text-ink/70">{VISA_LABEL[r.visa_sponsorship]}</td>
                    <td className="px-4 py-3 text-ink/70">{r.cohorts?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-ink/70">{formatDate(r.submitted_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ActionForm>
      )}
      {!canManage && <p className="mt-4 text-xs text-ink/50">Read-only view — workflow actions require the program admin role.</p>}
    </div>
  );
}
