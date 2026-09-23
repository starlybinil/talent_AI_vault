import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/session";
import { Card, Input, PageHeader, buttonClass } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Audit log" };

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ action?: string }> }) {
  const sp = await searchParams;
  await requirePermission("audit.read", "/admin/audit");
  const supabase = await createClient();
  let q = supabase.from("audit_log").select("id, actor_id, action, entity, entity_id, metadata, ip, created_at").order("created_at", { ascending: false }).limit(300);
  const term = (sp.action ?? "").replace(/[^a-z0-9._]/gi, "");
  if (term) q = q.ilike("action", `%${term}%`);
  const { data: rows } = await q;
  const ids = Array.from(new Set((rows ?? []).map((r) => r.actor_id).filter(Boolean))) as string[];
  const { data: people } = ids.length ? await supabase.from("profiles").select("id, email").in("id", ids) : { data: [] };
  const who = Object.fromEntries((people ?? []).map((p) => [p.id, p.email]));

  return (
    <div>
      <PageHeader eyebrow="IT administration" title="Audit log" description="Sign-ins, applicant record views, file access, exports, workflow and role changes." />
      <Card className="mb-4 p-4">
        <form method="get" className="flex gap-3">
          <Input name="action" defaultValue={sp.action} placeholder="Filter by action (e.g. export, role, file.view)" aria-label="Filter" className="mt-0" />
          <button className={buttonClass("dark", "md", "shrink-0")}>Filter</button>
        </form>
      </Card>
      <div className="overflow-x-auto rounded-2xl border border-ink/10 bg-white">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="bg-mist text-xs uppercase tracking-wider text-ink/50">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Who</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Target</th>
              <th className="px-4 py-3">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/5">
            {(rows ?? []).map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap px-4 py-2.5 text-ink/60">{formatDateTime(r.created_at)}</td>
                <td className="px-4 py-2.5">{r.actor_id ? who[r.actor_id] ?? r.actor_id.slice(0, 8) : "system"}</td>
                <td className="px-4 py-2.5 font-mono text-xs font-bold">{r.action}</td>
                <td className="px-4 py-2.5 text-xs text-ink/60">
                  {r.entity} {r.entity_id ? `· ${String(r.entity_id).slice(0, 40)}` : ""}
                </td>
                <td className="max-w-xs truncate px-4 py-2.5 font-mono text-xs text-ink/50" title={JSON.stringify(r.metadata)}>
                  {r.ip ? `${r.ip} ` : ""}
                  {Object.keys(r.metadata ?? {}).length ? JSON.stringify(r.metadata) : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
