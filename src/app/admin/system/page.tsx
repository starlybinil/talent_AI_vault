import { createClient, createPublicClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/session";
import { Badge, Card, PageHeader } from "@/components/ui";
import { SITE_URL } from "@/lib/env";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "System health" };
export const dynamic = "force-dynamic";

export default async function SystemPage() {
  await requirePermission("system.read", "/admin/system");
  const supabase = await createClient();
  const started = Date.now();
  const { error: dbError } = await createPublicClient().from("programs").select("id").limit(1);
  const latency = Date.now() - started;
  const { data: cron } = await supabase.from("cron_runs").select("*");
  const checks: Array<[string, boolean, string]> = [
    ["Database reachable", !dbError, dbError ? dbError.message : `${latency} ms`],
    ["Site URL", !!process.env.NEXT_PUBLIC_SITE_URL, SITE_URL],
    ["Email provider", !!process.env.RESEND_API_KEY, process.env.RESEND_API_KEY ? "Resend" : "Simulation mode"],
    ["Reminder cron credentials", !!process.env.SUPABASE_SERVICE_ROLE_KEY && !!process.env.CRON_SECRET, "SUPABASE_SERVICE_ROLE_KEY + CRON_SECRET"],
  ];
  return (
    <div>
      <PageHeader eyebrow="Web" title="System health" description={`Runtime: Node ${process.version} · ${process.env.VERCEL_ENV ?? process.env.NODE_ENV}`} />
      <div className="grid gap-4 md:grid-cols-2">
        {checks.map(([name, ok, detail]) => (
          <Card key={name} className="flex items-center justify-between gap-3">
            <div>
              <p className="font-bold">{name}</p>
              <p className="text-sm text-ink/60">{detail}</p>
            </div>
            <Badge tone={ok ? "success" : "warn"}>{ok ? "OK" : "Check"}</Badge>
          </Card>
        ))}
      </div>
      <Card className="mt-6">
        <h2 className="font-black">Scheduled jobs</h2>
        {(cron ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-ink/60">No runs recorded yet. The exam reminder job runs daily at 16:00 UTC (9 AM Arizona).</p>
        ) : (
          <ul className="mt-3 divide-y divide-ink/5 text-sm">
            {(cron ?? []).map((c) => (
              <li key={c.job} className="flex justify-between py-2">
                <span className="font-mono font-bold">{c.job}</span>
                <span className="text-ink/60">
                  {formatDateTime(c.last_run_at)} · {JSON.stringify(c.last_result)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
