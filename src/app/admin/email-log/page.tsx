import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/session";
import { Alert, Badge, PageHeader } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Email log" };

export default async function EmailLogPage() {
  await requirePermission("email_log.read", "/admin/email-log");
  const supabase = await createClient();
  const { data: rows } = await supabase.from("email_log").select("*").order("created_at", { ascending: false }).limit(300);
  const configured = !!process.env.RESEND_API_KEY;
  return (
    <div>
      <PageHeader eyebrow="Communications" title="Email log" description="Every notification sent to applicants." />
      {!configured && (
        <Alert tone="warn" title="Email delivery is in simulation mode" className="mb-4">
          RESEND_API_KEY is not set, so emails are recorded here as “simulated” but not delivered.
        </Alert>
      )}
      <div className="overflow-x-auto rounded-2xl border border-ink/10 bg-white">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-mist text-xs uppercase tracking-wider text-ink/50">
            <tr>
              <th className="px-4 py-3">Sent</th>
              <th className="px-4 py-3">To</th>
              <th className="px-4 py-3">Subject</th>
              <th className="px-4 py-3">Template</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/5">
            {(rows ?? []).map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap px-4 py-2.5 text-ink/60">{formatDateTime(r.created_at)}</td>
                <td className="px-4 py-2.5">
                  {r.application_id ? (
                    <Link href={`/admin/applications/${r.application_id}`} className="hover:text-maroon">
                      {r.to_email}
                    </Link>
                  ) : (
                    r.to_email
                  )}
                </td>
                <td className="px-4 py-2.5 font-bold">{r.subject}</td>
                <td className="px-4 py-2.5 font-mono text-xs">{r.template}</td>
                <td className="px-4 py-2.5">
                  <Badge tone={r.status === "sent" ? "success" : r.status === "failed" ? "danger" : "neutral"}>{r.status}</Badge>
                  {r.error && <p className="mt-1 text-xs text-red-700">{r.error}</p>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
