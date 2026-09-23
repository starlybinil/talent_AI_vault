import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/session";
import { audit } from "@/lib/audit";
import { CohortSchedule } from "@/components/schedule/CohortSchedule";
import { Alert, EmptyState, PageHeader } from "@/components/ui";
import { todayInArizona, type ScheduleCohort } from "@/lib/schedule";

export const metadata = { title: "Cohort calendar" };

export default async function EmployerCohortsPage() {
  await requirePermission("employer.portal", "/employer/cohorts");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cohort_schedule");
  await audit(supabase, "employer.cohorts.view", "employer_portal", null);
  const cohorts = (data ?? []) as ScheduleCohort[];

  return (
    <div>
      <Link href="/employer" className="mb-4 inline-flex items-center gap-1.5 text-sm font-bold text-ink/60 hover:text-maroon">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Talent pipeline
      </Link>
      <PageHeader
        eyebrow="Employer partner"
        title="Cohort calendar"
        description="When and where trainees are learning, how many are admitted, and when each cohort graduates into your talent pipeline."
      />
      {error ? (
        <Alert tone="danger">Couldn&apos;t load the cohort calendar: {error.message}</Alert>
      ) : cohorts.length === 0 ? (
        <EmptyState title="No cohorts scheduled yet">Cohorts appear here once your partner programs publish them.</EmptyState>
      ) : (
        <CohortSchedule cohorts={cohorts} audience="employer" today={todayInArizona()} />
      )}
    </div>
  );
}
