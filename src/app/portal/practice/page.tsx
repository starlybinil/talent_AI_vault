import Link from "next/link";
import { ArrowLeft, Eye, Keyboard, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/session";
import { PageHeader } from "@/components/ui";
import { TypingTest } from "@/components/practice/TypingTest";
import { AttentionDrill } from "@/components/practice/AttentionDrill";
import { cn, formatDateTime } from "@/lib/utils";

export const metadata = { title: "Practice Lab" };

type Attempt = { id: string; activity: "typing" | "attention"; score: number; accuracy: number; duration_seconds: number; created_at: string };

const ACTIVITIES = {
  typing: { label: "Typing speed", icon: Keyboard, unit: "wpm" },
  attention: { label: "Attention to detail", icon: Eye, unit: "%" },
} as const;

export default async function PracticePage({ searchParams }: { searchParams: Promise<{ activity?: string }> }) {
  await requireSession("/portal/practice");
  const { activity: requested } = await searchParams;
  const activity: keyof typeof ACTIVITIES = requested === "attention" ? "attention" : "typing";
  const supabase = await createClient();
  const { data } = await supabase
    .from("practice_attempts")
    .select("id, activity, score, accuracy, duration_seconds, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  const attempts = ((data ?? []) as Attempt[]).map((a) => ({ ...a, score: Number(a.score), accuracy: Number(a.accuracy) }));
  const of = (k: keyof typeof ACTIVITIES) => attempts.filter((a) => a.activity === k);
  const best = (k: keyof typeof ACTIVITIES) => (of(k).length ? Math.max(...of(k).map((a) => a.score)) : null);
  const recent = of(activity).slice(0, 10);
  const maxRecent = Math.max(1, ...recent.map((a) => a.score));

  return (
    <div>
      <Link href="/portal" className="mb-4 inline-flex items-center gap-1.5 text-sm font-bold text-maroon hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden /> My applications
      </Link>
      <PageHeader
        eyebrow="Practice Lab"
        title="Get ready for your assessment"
        description="Sharpen the skills technicians use every day. Practise as often as you like; every round is new."
      />

      <nav className="mb-6 grid gap-3 sm:grid-cols-2" aria-label="Practice activities">
        {(Object.keys(ACTIVITIES) as Array<keyof typeof ACTIVITIES>).map((k) => {
          const A = ACTIVITIES[k];
          const b = best(k);
          return (
            <Link
              key={k}
              href={`?activity=${k}`}
              scroll={false}
              aria-current={activity === k ? "page" : undefined}
              className={cn(
                "flex items-center gap-4 rounded-2xl border-2 bg-white p-4 transition",
                activity === k ? "border-maroon shadow-md" : "border-transparent shadow-sm hover:border-ink/20",
              )}
            >
              <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl", activity === k ? "bg-maroon text-white" : "bg-gold/20 text-maroon")}>
                <A.icon className="h-6 w-6" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-black text-ink">{A.label}</span>
                <span className="block text-sm text-ink/60">
                  {of(k).length ? `${of(k).length} attempt${of(k).length === 1 ? "" : "s"} · best ${Math.round(b!)}${A.unit === "%" ? "%" : " wpm"}` : "Not tried yet"}
                </span>
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div>{activity === "typing" ? <TypingTest personalBest={best("typing")} /> : <AttentionDrill personalBest={best("attention")} />}</div>

        <aside className="grid content-start gap-4">
          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-ink/10">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-maroon">Your progress</p>
            <p className="mt-1 font-black">{ACTIVITIES[activity].label}</p>
            {recent.length === 0 ? (
              <p className="mt-3 text-sm text-ink/60">Your results will appear here after your first round.</p>
            ) : (
              <>
                <div className="mt-4 flex h-24 items-end gap-1.5" aria-label="Recent scores, oldest to newest">
                  {[...recent].reverse().map((a) => (
                    <div
                      key={a.id}
                      className="flex-1 rounded-t-md bg-gradient-to-t from-maroon to-maroon/60"
                      style={{ height: `${Math.max(6, (a.score / maxRecent) * 100)}%` }}
                      title={`${Math.round(a.score)}${activity === "typing" ? " wpm" : "%"} · ${formatDateTime(a.created_at)}`}
                    />
                  ))}
                </div>
                <ul className="mt-4 divide-y divide-ink/5 text-sm">
                  {recent.slice(0, 5).map((a) => (
                    <li key={a.id} className="flex items-center justify-between py-2">
                      <span className="text-ink/60">{formatDateTime(a.created_at)}</span>
                      <span className="font-black tabular-nums">
                        {Math.round(a.score)}
                        {activity === "typing" ? " wpm" : "%"}
                        {activity === "typing" && <span className="ml-1.5 font-bold text-ink/40">{Math.round(a.accuracy)}% acc.</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
          <div className="rounded-3xl bg-mist p-5 text-sm text-ink/70">
            <p className="flex items-center gap-2 font-black text-ink">
              <Lock className="h-4 w-4" aria-hidden /> Private practice
            </p>
            <p className="mt-1">
              Practice results are only visible to you. They aren&apos;t shared with admissions, employers or TSMC Arizona, and they don&apos;t
              affect your application. This isn&apos;t the official TestGorilla assessment.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
