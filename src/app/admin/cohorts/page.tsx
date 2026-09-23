import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/session";
import { can } from "@/lib/rbac";
import { CohortForm } from "@/components/admin/CohortForm";
import { CohortSchedule } from "@/components/schedule/CohortSchedule";
import { Alert, Card, PageHeader } from "@/components/ui";
import { todayInArizona, type ScheduleCohort } from "@/lib/schedule";

export const metadata = { title: "Cohorts" };

export default async function CohortsPage({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const session = await requirePermission("admissions.read", "/admin/cohorts");
  const canManage = can(session.roles, "cohorts.manage");
  const { deleted } = await searchParams;
  const supabase = await createClient();
  const [{ data: cohorts, error }, { data: programs }, { data: locations }] = await Promise.all([
    supabase.rpc("cohort_schedule"),
    canManage ? supabase.from("programs").select("id, short_name, formats").order("sort") : Promise.resolve({ data: [] }),
    canManage ? supabase.from("training_locations").select("id, name, address, active").order("name") : Promise.resolve({ data: [] }),
  ]);
  const formats = Array.from(
    new Set(((programs ?? []) as Array<{ formats: unknown }>).flatMap((p) => ((p.formats as Array<{ name: string }>) ?? []).map((f) => f.name))),
  );

  return (
    <div>
      <PageHeader
        eyebrow="Scheduling"
        title="Cohorts"
        description={
          canManage
            ? "Every cohort by year, month or grid: where it runs, how full it is and who's waiting. Click a cohort for details and its roster."
            : "Every cohort by year, month or grid: where it runs and how full it is. Read-only."
        }
      />
      {deleted && (
        <Alert tone="success" className="mb-6">
          Cohort deleted. Anyone who was registered or waitlisted in it has been emailed and asked to choose new cohorts.
        </Alert>
      )}
      {error ? (
        <Alert tone="danger">Couldn&apos;t load the cohort schedule: {error.message}</Alert>
      ) : (
        <CohortSchedule
          cohorts={(cohorts ?? []) as ScheduleCohort[]}
          audience={session.roles.includes("program_admin") ? "admin" : "it"}
          canManage={canManage}
          today={todayInArizona()}
        />
      )}
      {canManage && (
        <Card className="mt-8">
          <h2 className="mb-5 text-lg font-black">Add a cohort</h2>
          <CohortForm programs={(programs ?? []) as Array<{ id: string; short_name: string }>} formats={formats} locations={locations ?? []} />
        </Card>
      )}
    </div>
  );
}
