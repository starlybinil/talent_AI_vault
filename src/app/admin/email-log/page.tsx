import Link from "next/link";
import { Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/session";
import { Alert, Badge, Input, PageHeader, Select, buttonClass } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Email log" };

type Filters = { q?: string; template?: string; status?: string; from?: string; to?: string };

const STATUSES = ["sent", "simulated", "failed"] as const;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const LIMIT = 500;

/** Arizona has no daylight saving, so a calendar day there is always UTC-7. */
const azStart = (d: string) => `${d}T00:00:00-07:00`;
const azEnd = (d: string) => `${d}T23:59:59.999-07:00`;

export default async function EmailLogPage({ searchParams }: { searchParams: Promise<Filters> }) {
  await requirePermission("email_log.read", "/admin/email-log");
  const sp = await searchParams;
  const supabase = await createClient();

  // Search matches the recipient address or the subject line.
  const term = (sp.q ?? "").replace(/[^\p{L}\p{N}@.\-_+ ]/gu, "").trim().slice(0, 120);
  let query = supabase.from("email_log").select("*", { count: "exact" }).order("created_at", { ascending: false });
  if (term) query = query.or(`to_email.ilike.%${term}%,subject.ilike.%${term}%`);
  if (sp.template && /^[a-z_]+$/.test(sp.template)) query = query.eq("template", sp.template);
  if (sp.status && (STATUSES as readonly string[]).includes(sp.status)) query = query.eq("status", sp.status);
  if (sp.from && DATE_RE.test(sp.from)) query = query.gte("created_at", azStart(sp.from));
  if (sp.to && DATE_RE.test(sp.to)) query = query.lte("created_at", azEnd(sp.to));

  const [{ data: rows, count }, { data: templateRows }] = await Promise.all([
    query.limit(LIMIT),
    supabase.from("email_log").select("template").order("template").limit(5000),
  ]);
  const templates = Array.from(new Set((templateRows ?? []).map((r) => r.template as string))).sort();
  const filtered = !!(term || sp.template || sp.status || sp.from || sp.to);
  const total = count ?? rows?.length ?? 0;
  const configured = !!process.env.RESEND_API_KEY;
  const withQ = (q: string) => `/admin/email-log?${new URLSearchParams({ ...Object.fromEntries(Object.entries(sp).filter(([, v]) => v)), q }).toString()}`;

  return (
    <div>
      <PageHeader eyebrow="Communications" title="Email log" description="Every notification sent to applicants." />
      {!configured && (
        <Alert tone="warn" title="Email delivery is in simulation mode" className="mb-4">
          RESEND_API_KEY is not set, so emails are recorded here as “simulated” but not delivered.
        </Alert>
      )}

      <form method="get" className="mb-4 grid gap-3 rounded-2xl border border-ink/10 bg-white p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1.4fr_1fr]">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" aria-hidden />
          <Input name="q" defaultValue={sp.q} placeholder="Email address or subject" className="pl-9" aria-label="Search email address or subject" />
        </div>
        <Select name="template" defaultValue={sp.template ?? ""} aria-label="Template">
          <option value="">All templates</option>
          {templates.map((t) => (
            <option key={t} value={t}>
              {t.replace(/_/g, " ")}
            </option>
          ))}
        </Select>
        <Select name="status" defaultValue={sp.status ?? ""} aria-label="Status">
          <option value="">Any status</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s[0].toUpperCase() + s.slice(1)}
            </option>
          ))}
        </Select>
        <label className="grid gap-1 text-[11px] font-bold uppercase tracking-wider text-ink/50">
          Sent from
          <Input type="date" name="from" defaultValue={sp.from ?? ""} />
        </label>
        <label className="grid gap-1 text-[11px] font-bold uppercase tracking-wider text-ink/50">
          Sent to
          <Input type="date" name="to" defaultValue={sp.to ?? ""} />
        </label>
        <div className="flex items-end gap-2">
          <button type="submit" className={buttonClass("dark", "md")}>
            Filter
          </button>
          <Link href="/admin/email-log" className={buttonClass("ghost", "md")}>
            Reset
          </Link>
        </div>
      </form>

      <p className="mb-3 text-sm text-ink/60">
        {total === 0
          ? "No emails match these filters."
          : `${total.toLocaleString()} email${total === 1 ? "" : "s"}${filtered ? " match" : ""}${total > LIMIT ? `, showing the newest ${LIMIT}` : ""}.`}{" "}
        <span className="text-ink/40">Dates are Arizona time. Click an address to see every email sent to it.</span>
      </p>

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
                  <Link href={withQ(r.to_email)} className="hover:text-maroon hover:underline" title="Show every email sent to this address">
                    {r.to_email}
                  </Link>
                  {r.application_id && (
                    <Link href={`/admin/applications/${r.application_id}`} className="block text-xs font-bold text-maroon/80 hover:underline">
                      Open application →
                    </Link>
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
