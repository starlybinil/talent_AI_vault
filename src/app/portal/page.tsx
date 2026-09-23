import Link from "next/link";
import { ArrowRight, Settings } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/session";
import { StatusTracker } from "@/components/portal/StatusTracker";
import { Badge, ButtonLink, Card, PageHeader } from "@/components/ui";
import { STATUS_LABEL, STATUS_TONE, applicantNextAction, type Status } from "@/lib/workflow";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "My applications" };

export default async function PortalHome() {
  const session = await requireSession("/portal");
  const supabase = await createClient();
  const [{ data: apps }, { data: programs }] = await Promise.all([
    supabase
      .from("applications")
      .select("id, status, submitted_at, programs(slug, name, short_name)")
      .eq("user_id", session.userId)
      .order("submitted_at", { ascending: false }),
    supabase.from("programs").select("slug, name, tagline, active").eq("active", true).order("sort"),
  ]);
  const applied = new Set((apps ?? []).map((a) => (Array.isArray(a.programs) ? a.programs[0] : a.programs)?.slug));
  const available = (programs ?? []).filter((p) => !applied.has(p.slug));
  const firstName = session.fullName?.split(" ")[0];

  return (
    <div>
      <PageHeader eyebrow="Applicant portal" title={firstName ? `Welcome, ${firstName}` : "Welcome"} description="Track every step of your application in real time."
        actions={
          <ButtonLink href="/portal/account" variant="outline" size="sm">
            <Settings className="h-4 w-4" aria-hidden /> Account settings
          </ButtonLink>
        }
      />

      {(apps ?? []).length === 0 ? (
        <Card className="overflow-hidden p-0">
          <div className="bg-gradient-to-br from-maroon to-maroon-900 p-8 text-white sm:p-10">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold">Get started</p>
            <h2 className="mt-2 text-3xl font-black">You haven&apos;t applied yet</h2>
            <p className="mt-2 max-w-xl text-white/75">The application takes about 5 minutes. Have your resume ready.</p>
          </div>
          <div className="grid gap-4 p-6 sm:p-8">
            {available.map((p) => (
              <div key={p.slug} className="flex flex-col justify-between gap-4 rounded-2xl border border-ink/10 p-5 sm:flex-row sm:items-center">
                <div>
                  <p className="font-black text-ink">{p.name}</p>
                  <p className="text-sm text-ink/60">{p.tagline}</p>
                </div>
                <ButtonLink href={`/portal/apply/${p.slug}`}>
                  Start application <ArrowRight className="h-4 w-4" />
                </ButtonLink>
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <div className="grid gap-6">
          {(apps ?? []).map((a) => {
            const program = Array.isArray(a.programs) ? a.programs[0] : a.programs;
            const status = a.status as Status;
            const next = applicantNextAction(status);
            return (
              <Card key={a.id} className="p-0">
                <div className="flex flex-col gap-3 border-b border-ink/10 p-6 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-maroon">Applied {formatDate(a.submitted_at)}</p>
                    <h2 className="mt-1 text-xl font-black text-ink">{program?.name}</h2>
                  </div>
                  <Badge tone={STATUS_TONE[status]} className="self-start text-sm">
                    {STATUS_LABEL[status]}
                  </Badge>
                </div>
                <div className="p-6">
                  <StatusTracker status={status} />
                  <div className="mt-6 flex flex-col justify-between gap-4 rounded-2xl bg-mist p-5 sm:flex-row sm:items-center">
                    <div>
                      <p className="font-black text-ink">{next.title}</p>
                      <p className="text-sm text-ink/60">{next.body}</p>
                    </div>
                    <ButtonLink href={`/portal/applications/${a.id}${next.tab ? `?tab=${next.tab}` : ""}`} variant={next.tab ? "gold" : "dark"} className="shrink-0">
                      {next.tab ? "Take action" : "View details"} <ArrowRight className="h-4 w-4" />
                    </ButtonLink>
                  </div>
                </div>
              </Card>
            );
          })}
          {available.length > 0 && (
            <p className="text-sm text-ink/60">
              Interested in more?{" "}
              {available.map((p) => (
                <Link key={p.slug} href={`/portal/apply/${p.slug}`} className="font-bold text-maroon hover:underline">
                  Apply to {p.name}
                </Link>
              ))}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
