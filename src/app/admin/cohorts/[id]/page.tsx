import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/session";
import { CohortForm } from "@/components/admin/CohortForm";
import { SeatsBar } from "@/components/program/CohortCard";
import { deleteCohort, promoteWaitlist } from "@/app/admin/actions";
import { ActionForm, SubmitButton } from "@/components/ui/forms";
import { Badge, Card, EmptyState, Label, PageHeader, Textarea } from "@/components/ui";
import type { CohortAvailability } from "@/lib/data";
import { STATUS_LABEL, STATUS_TONE, type Status } from "@/lib/workflow";

export const metadata = { title: "Cohort roster" };

type Enr = {
  status: string;
  waitlist_position: number | null;
  created_at: string;
  applications: { id: string; first_name: string; last_name: string; email: string; status: Status } | null;
};

export default async function CohortDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePermission("cohorts.manage", `/admin/cohorts/${id}`);
  const supabase = await createClient();
  const { data: cohort } = await supabase.from("cohorts").select("*").eq("id", id).maybeSingle();
  if (!cohort) notFound();
  const [{ data: avail }, { data: enr }, { data: programs }, { data: locations }] = await Promise.all([
    supabase.rpc("cohort_availability", { p_program: cohort.program_id }),
    supabase
      .from("cohort_enrollments")
      .select("status, waitlist_position, created_at, applications(id, first_name, last_name, email, status)")
      .eq("cohort_id", id)
      .in("status", ["registered", "waitlisted"])
      .order("waitlist_position", { ascending: true, nullsFirst: true }),
    supabase.from("programs").select("id, short_name, formats").order("sort"),
    supabase.from("training_locations").select("id, name, address, active").order("name"),
  ]);
  const a = ((avail ?? []) as CohortAvailability[]).find((x) => x.cohort_id === id);
  const rows = (enr ?? []) as unknown as Enr[];
  const registered = rows.filter((r) => r.status === "registered");
  const waitlist = rows.filter((r) => r.status === "waitlisted");
  const formats = Array.from(new Set((programs ?? []).flatMap((p) => ((p.formats as Array<{ name: string }>) ?? []).map((f) => f.name))));

  const Roster = ({ items, wl }: { items: Enr[]; wl?: boolean }) =>
    items.length === 0 ? (
      <EmptyState title={wl ? "Nobody is waiting" : "No one registered yet"} />
    ) : (
      <ul className="divide-y divide-ink/5">
        {items.map((r) => (
          <li key={r.applications?.id} className="flex items-center justify-between gap-3 py-3 text-sm">
            <span>
              {wl && <strong className="mr-2 text-maroon">#{r.waitlist_position}</strong>}
              <Link href={`/admin/applications/${r.applications?.id}`} className="font-bold hover:text-maroon">
                {r.applications?.first_name} {r.applications?.last_name}
              </Link>
              <span className="block text-xs text-ink/50">{r.applications?.email}</span>
            </span>
            {r.applications && <Badge tone={STATUS_TONE[r.applications.status]}>{STATUS_LABEL[r.applications.status]}</Badge>}
          </li>
        ))}
      </ul>
    );

  return (
    <div>
      <Link href="/admin/cohorts" className="inline-flex items-center gap-1.5 text-sm font-bold text-ink/60 hover:text-maroon">
        <ArrowLeft className="h-4 w-4" /> All cohorts
      </Link>
      <div className="mt-4">
        <PageHeader eyebrow={cohort.format} title={cohort.name} />
      </div>
      {a && (
        <Card className="mb-6">
          <SeatsBar c={a} />
        </Card>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-black">Registered ({registered.length})</h2>
          <Roster items={registered} />
        </Card>
        <Card>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-black">Waitlist ({waitlist.length})</h2>
            <ActionForm action={promoteWaitlist}>
              <input type="hidden" name="cohort_id" value={id} />
              <SubmitButton size="sm" variant="outline" pendingText="Promoting…">
                Fill open seats
              </SubmitButton>
            </ActionForm>
          </div>
          <Roster items={waitlist} wl />
        </Card>
      </div>
      <Card className="mt-6">
        <h2 className="mb-5 text-lg font-black">Edit cohort</h2>
        <CohortForm cohort={cohort} programs={programs ?? []} formats={formats} locations={locations ?? []} />
      </Card>
      <Card className="mt-6 border-red-200">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-700">Danger zone</p>
        <h2 className="mt-1 text-lg font-black">Delete this cohort</h2>
        <p className="mt-1 max-w-2xl text-sm text-ink/70">
          Permanently removes the cohort from the schedule.{" "}
          {registered.length + waitlist.length > 0
            ? `${registered.length} registered and ${waitlist.length} waitlisted applicant(s) are affected. Anyone left without a seat or another waitlist spot is emailed and sent back to choose new cohorts, and their signed agreements are cleared.`
            : "Nobody is registered or waitlisted, so no applicants are affected."}{" "}
          To just stop new sign-ups, set the status to Closed instead.
        </p>
        <ActionForm
          action={deleteCohort}
          className="mt-4 grid max-w-2xl gap-3"
          confirm={{
            title: `Delete "${cohort.name}"?`,
            body: "This permanently removes the cohort and can't be undone.",
            points: [
              ...(registered.length ? [`${registered.length} registered applicant(s) lose their seat and go back to choosing cohorts.`] : []),
              ...(waitlist.length ? [`${waitlist.length} waitlisted applicant(s) are removed from this waitlist.`] : []),
              ...(registered.length + waitlist.length ? ["Anyone left without a seat or another waitlist spot is emailed and asked to choose new cohorts. Their signed agreements are cleared."] : []),
              "The cohort disappears from the public schedule and from applicants' choices.",
            ],
            confirmLabel: "Yes, delete cohort",
            cancelLabel: "Keep cohort",
            tone: "danger",
          }}
        >
          <input type="hidden" name="cohort_id" value={id} />
          {registered.length + waitlist.length > 0 && (
            <>
              <Label htmlFor="delete-note">Reason shared with affected applicants (optional)</Label>
              <Textarea id="delete-note" name="note" maxLength={500} placeholder="e.g. the venue is no longer available" className="min-h-16 text-sm" />
            </>
          )}
          <SubmitButton variant="danger" size="sm" className="justify-self-start" pendingText="Deleting…">
            <Trash2 className="h-4 w-4" aria-hidden /> Delete cohort
          </SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
