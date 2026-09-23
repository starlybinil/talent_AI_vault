import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/session";
import { can, firstAdminPage } from "@/lib/rbac";
import { Bars, Sparkline } from "@/components/admin/Bars";
import { ButtonLink, Card, PageHeader, Stat } from "@/components/ui";
import { EDUCATION_LABEL, STATUS_LABEL, VISA_LABEL, type Status } from "@/lib/workflow";
import type { CohortAvailability } from "@/lib/data";

export const metadata = { title: "Admin dashboard" };

type Analytics = {
  by_status: Record<string, number>;
  reached: Record<string, number>;
  by_source: Record<string, number>;
  by_education: Record<string, number>;
  visa: Record<string, number>;
  daily: Array<{ day: string; n: number }>;
  total: number;
};

const FUNNEL: Array<[Status, string]> = [
  ["submitted", "Applied"],
  ["screening_passed", "Passed screening"],
  ["exam_invited", "Invited to assessment"],
  ["exam_passed", "Passed assessment"],
  ["cohort_registered", "Registered in cohort"],
  ["agreements_submitted", "Enrolled & signed"],
  ["confirmed", "Confirmed"],
  ["completed", "Completed program"],
  ["hired", "Hired"],
];

export default async function AdminDashboard() {
  const session = await requireSession("/admin");
  if (!can(session.roles, "analytics.read")) redirect(firstAdminPage(session.roles));
  const supabase = await createClient();
  const [{ data }, { data: cohorts }] = await Promise.all([supabase.rpc("admin_analytics"), supabase.rpc("cohort_availability")]);
  const a = (data ?? { by_status: {}, reached: {}, by_source: {}, by_education: {}, visa: {}, daily: [], total: 0 }) as Analytics;
  const s = (k: Status) => a.by_status[k] ?? 0;
  const needsReview = s("submitted") + s("screening");
  const awaitingExam = s("exam_invited");
  const toVerify = s("agreements_submitted");
  const confirmed = s("confirmed");
  const graduates = s("completed") + s("hired");
  const hired = s("hired");
  const cohortRows = ((cohorts ?? []) as CohortAvailability[]).filter((c) => c.status !== "archived");
  const seats = cohortRows.reduce((acc, c) => acc + c.capacity, 0);
  const filled = cohortRows.reduce((acc, c) => acc + c.registered, 0);

  return (
    <div>
      <PageHeader
        eyebrow="Admissions"
        title="Dashboard"
        description="Pipeline health across all programs."
        actions={
          can(session.roles, "admissions.read") ? (
            <ButtonLink href="/admin/applications" variant="dark">
              Open the queue
            </ButtonLink>
          ) : null
        }
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Total applications" value={a.total} />
        <Stat label="Needs review" value={needsReview} hint="Submitted + in screening" />
        <Stat label="Awaiting assessment" value={awaitingExam} />
        <Link href="/admin/applications?status=agreements_submitted" className="block rounded-2xl transition hover:-translate-y-0.5 hover:shadow-md">
          <Stat label="Ready to confirm" value={toVerify} hint={toVerify ? "Enrolled & signed · review now →" : "Enrolled & signed"} />
        </Link>
        <Stat label="In training (confirmed)" value={confirmed} hint={seats ? `${filled}/${seats} seats filled` : undefined} />
        <Stat label="Program graduates" value={graduates} hint="Completed + hired" />
        <Stat label="Hired" value={hired} />
        <Stat label="Placement rate" value={graduates ? `${Math.round((hired / graduates) * 100)}%` : "—"} hint="Hired ÷ graduates" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="font-black">Admissions funnel</h2>
          <p className="text-sm text-ink/50">Applications that have ever reached each stage</p>
          <div className="mt-5">
            <Bars data={FUNNEL.map(([k, label]) => ({ label, value: a.reached[k] ?? 0 }))} total={a.reached.submitted ?? a.total} />
          </div>
        </Card>
        <Card>
          <h2 className="font-black">Current stage</h2>
          <p className="text-sm text-ink/50">Where applications are right now</p>
          <div className="mt-5">
            <Bars
              accent="gold"
              data={Object.entries(a.by_status)
                .sort((x, y) => y[1] - x[1])
                .map(([k, v]) => ({ label: STATUS_LABEL[k as Status] ?? k, value: v }))}
              total={a.total}
            />
          </div>
        </Card>
        <Card className="xl:col-span-2">
          <h2 className="font-black">Applications over time</h2>
          <p className="text-sm text-ink/50">Last 60 days</p>
          <div className="mt-4">
            <Sparkline points={a.daily} />
          </div>
        </Card>
        <Card>
          <h2 className="font-black">Cohort fill</h2>
          <div className="mt-5">
            <Bars data={cohortRows.map((c) => ({ label: `${c.name} (${c.registered}/${c.capacity})`, value: c.registered }))} />
          </div>
        </Card>
        <Card>
          <h2 className="font-black">Where applicants come from</h2>
          <div className="mt-5">
            <Bars data={Object.entries(a.by_source).map(([k, v]) => ({ label: k, value: v }))} total={a.total} />
          </div>
          <h2 className="mt-8 font-black">Education</h2>
          <div className="mt-5">
            <Bars accent="gold" data={Object.entries(a.by_education).map(([k, v]) => ({ label: EDUCATION_LABEL[k] ?? k, value: v }))} total={a.total} />
          </div>
          <h2 className="mt-8 font-black">Visa sponsorship</h2>
          <div className="mt-5">
            <Bars data={Object.entries(a.visa).map(([k, v]) => ({ label: VISA_LABEL[k] ?? k, value: v }))} total={a.total} />
          </div>
        </Card>
      </div>
    </div>
  );
}
