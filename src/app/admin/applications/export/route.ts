import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/session";
import { can } from "@/lib/rbac";
import { queueQuery } from "@/lib/admin-queries";
import { audit } from "@/lib/audit";
import { EDUCATION_LABEL, STATUS_LABEL, VISA_LABEL, type Status } from "@/lib/workflow";
import { toCsv } from "@/lib/utils";

type Row = Record<string, unknown> & { programs?: { short_name: string } | null; cohorts?: { name: string } | null };

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || !can(session.roles, "admissions.read")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const f = Object.fromEntries(request.nextUrl.searchParams);
  const supabase = await createClient();
  const { data, error } = await queueQuery(supabase, f).limit(10000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = (data ?? []) as unknown as Row[];
  const csv = toCsv(
    ["Application ID", "Program", "First name", "Last name", "Email", "Phone", "Education", "Major", "Visa sponsorship", "18+ by completion", "Shares with employers", "Status", "Assessment", "Cohort", "Source", "Submitted", "Updated"],
    rows.map((r) => [
      r.id,
      r.programs?.short_name,
      r.first_name,
      r.last_name,
      r.email,
      r.phone,
      EDUCATION_LABEL[r.highest_education as string],
      r.major,
      VISA_LABEL[r.visa_sponsorship as string],
      r.will_be_18_by_completion ? "Yes" : "No",
      r.share_with_employers ? "Yes" : "No",
      STATUS_LABEL[r.status as Status],
      r.exam_result,
      r.cohorts?.name,
      r.utm_source,
      r.submitted_at,
      r.updated_at,
    ]),
  );
  await audit(supabase, "applications.export", "application", null, { rows: rows.length, filters: f });
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="applications-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
