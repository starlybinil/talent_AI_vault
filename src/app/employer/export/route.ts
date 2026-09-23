import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/session";
import { can } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { FIELD_LABEL, displayField, matchesStage, type Candidate } from "@/lib/employer";
import { toCsv } from "@/lib/utils";

/** CSV of the policy-limited candidate fields this employer is allowed to see. */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || !can(session.roles, "employer.portal")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const sp = request.nextUrl.searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("employer_list_candidates", { p_program: sp.get("program") || null });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let rows = (data ?? []) as Candidate[];
  if (sp.get("shortlisted") === "1") rows = rows.filter((r) => r.shortlisted);
  rows = rows.filter((r) => matchesStage(r, sp.get("stage")));

  const keys = Array.from(new Set(rows.flatMap((r) => Object.keys(r.fields)))).filter((k) => k !== "resume");
  const csv = toCsv(
    ["Candidate ID", "Program", ...keys.map((k) => FIELD_LABEL[k] ?? k), "Shortlisted"],
    rows.map((r) => [r.application_id, r.program_name, ...keys.map((k) => displayField(k, r.fields[k])), r.shortlisted ? "Yes" : "No"]),
  );
  await audit(supabase, "employer.candidates.export", "employer_portal", null, { rows: rows.length });
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="candidates-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
