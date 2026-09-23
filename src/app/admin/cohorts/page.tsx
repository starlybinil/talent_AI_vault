import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/session";
import { CohortForm } from "@/components/admin/CohortForm";
import { SeatsBar } from "@/components/program/CohortCard";
import { Badge, Card, PageHeader } from "@/components/ui";
import type { CohortAvailability } from "@/lib/data";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Cohorts" };

export default async function CohortsPage() {
  await requirePermission("cohorts.manage", "/admin/cohorts");
  const supabase = await createClient();
  const [{ data: cohorts }, { data: programs }, { data: archived }] = await Promise.all([
    supabase.rpc("cohort_availability"),
    supabase.from("programs").select("id, short_name, formats").order("sort"),
    supabase.from("cohorts").select("id, name, start_date").eq("status", "archived").order("start_date", { ascending: false }),
  ]);
  const rows = (cohorts ?? []) as CohortAvailability[];
  const programName = Object.fromEntries((programs ?? []).map((p) => [p.id, p.short_name]));
  const formats = Array.from(new Set((programs ?? []).flatMap((p) => ((p.formats as Array<{ name: string }>) ?? []).map((f) => f.name))));

  return (
    <div>
      <PageHeader eyebrow="Scheduling" title="Cohorts" description="Dates, locations, capacity and live seat counts. Increasing capacity automatically promotes from the waitlist." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((c) => (
          <Link key={c.cohort_id} href={`/admin/cohorts/${c.cohort_id}`} className="block rounded-2xl border border-ink/10 bg-white p-5 shadow-sm transition hover:border-maroon">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-maroon">{programName[c.program_id]}</p>
                <p className="mt-1 text-lg font-black">{c.name}</p>
              </div>
              <Badge tone={c.status === "open" ? "success" : "neutral"}>{c.status}</Badge>
            </div>
            <p className="mt-2 text-sm text-ink/60">
              {formatDate(c.start_date)} – {formatDate(c.end_date)} · {c.location}
            </p>
            <div className="mt-4">
              <SeatsBar c={c} />
            </div>
          </Link>
        ))}
      </div>
      {(archived ?? []).length > 0 && (
        <p className="mt-4 text-sm text-ink/50">
          Archived:{" "}
          {(archived ?? []).map((a, i) => (
            <span key={a.id}>
              {i > 0 && ", "}
              <Link href={`/admin/cohorts/${a.id}`} className="underline">
                {a.name}
              </Link>
            </span>
          ))}
        </p>
      )}
      <Card className="mt-8">
        <h2 className="mb-5 text-lg font-black">Add a cohort</h2>
        <CohortForm programs={programs ?? []} formats={formats} />
      </Card>
    </div>
  );
}
