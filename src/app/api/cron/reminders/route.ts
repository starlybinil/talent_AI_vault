import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { notifyTemplate } from "@/lib/notify";

export const dynamic = "force-dynamic";

/**
 * Daily job (see vercel.json): emails applicants whose TestGorilla assessment has been open
 * 3 or 7 days without being marked complete. Protected by CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = createServiceClient();
  if (!supabase) return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not configured" }, { status: 500 });

  const { data, error } = await supabase.rpc("due_exam_reminders");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const due = (data ?? []) as Array<{ application_id: string }>;
  let sent = 0;
  for (const row of due) {
    await notifyTemplate(supabase, row.application_id, "exam_reminder");
    const { error: e } = await supabase.rpc("admin_record_exam_reminder", { p_app: row.application_id });
    if (!e) sent++;
  }

  const result = { due: due.length, sent, at: new Date().toISOString() };
  await supabase.from("cron_runs").upsert({ job: "exam_reminders", last_run_at: result.at, last_result: result });
  return NextResponse.json(result);
}
