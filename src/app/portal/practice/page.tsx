import Link from "next/link";
import { ArrowLeft, ArrowRight, Brain, Keyboard, Lock, MessagesSquare, Wrench } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/session";
import { ButtonLink, PageHeader } from "@/components/ui";
import { TypingTest } from "@/components/practice/TypingTest";
import { CognitiveTest } from "@/components/practice/CognitiveTest";
import { JudgementTest } from "@/components/practice/JudgementTest";
import { ToolsModule } from "@/components/practice/ToolsModule";
import { cn, formatDateTime } from "@/lib/utils";

export const metadata = { title: "Practice Lab" };

const ACTIVITIES = {
  cognitive: { label: "Cognitive ability", blurb: "Numerical, logic & attention to detail", icon: Brain, unit: "%" },
  judgement: { label: "Situational judgement", blurb: "What would you do on the job?", icon: MessagesSquare, unit: "%" },
  tools: { label: "Hand tools", blurb: "Recognize the tools of the trade", icon: Wrench, unit: "%" },
  typing: { label: "Typing speed", blurb: "Speed and accuracy at the keyboard", icon: Keyboard, unit: " wpm" },
} as const;
type Activity = keyof typeof ACTIVITIES;

type Attempt = { id: string; activity: string; score: number; accuracy: number; created_at: string; details: Record<string, unknown> | null };

export default async function PracticePage({ searchParams }: { searchParams: Promise<{ activity?: string }> }) {
  const session = await requireSession("/portal/practice");
  const { activity: requested } = await searchParams;
  const activity: Activity = requested && requested in ACTIVITIES ? (requested as Activity) : "cognitive";
  const supabase = await createClient();
  const [{ count: applications }, { data }] = await Promise.all([
    supabase.from("applications").select("id", { count: "exact", head: true }).eq("user_id", session.userId),
    supabase.from("practice_attempts").select("id, activity, score, accuracy, created_at, details").order("created_at", { ascending: false }).limit(200),
  ]);

  // Practice opens once they've applied: it's meant for the wait during screening and before the assessment.
  if (!applications) {
    return (
      <div>
        <PageHeader eyebrow="Practice Lab" title="Get ready for your assessment" />
        <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-ink/10">
          <div className="bg-gradient-to-br from-ink to-ink-800 p-8 text-white">
            <Lock className="h-8 w-8 text-gold" aria-hidden />
            <p className="mt-3 text-2xl font-black">Unlocks when you apply</p>
            <p className="mt-2 max-w-xl text-white/70">
              Once your application is submitted, you can practise cognitive ability, situational judgement, hand-tool recognition and
              typing as often as you like while admissions reviews it.
            </p>
            <ButtonLink href="/portal" className="mt-6">
              Start my application <ArrowRight className="h-4 w-4" aria-hidden />
            </ButtonLink>
          </div>
        </div>
      </div>
    );
  }

  const attempts = ((data ?? []) as Attempt[]).map((a) => ({ ...a, score: Number(a.score), accuracy: Number(a.accuracy) }));
  const of = (k: Activity) => attempts.filter((a) => a.activity === k);
  const best = (k: Activity) => (of(k).length ? Math.max(...of(k).map((a) => a.score)) : null);
  // Items from the last two attempts go to the back of the queue next time.
  const recentSeen = (k: Activity) =>
    of(k)
      .slice(0, 2)
      .flatMap((a) => (Array.isArray(a.details?.seen) ? (a.details!.seen as string[]) : []));
  const recent = of(activity).slice(0, 10);
  const maxRecent = Math.max(1, ...recent.map((a) => a.score));
  const unit = ACTIVITIES[activity].unit;

  return (
    <div>
      <Link href="/portal" className="mb-4 inline-flex items-center gap-1.5 text-sm font-bold text-maroon hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden /> My applications
      </Link>
      <PageHeader
        eyebrow="Practice Lab"
        title="Get ready for your assessment"
        description="Four practice assessments to use while admissions reviews your application. Every attempt is different, so practise as often as you like."
      />

      <nav className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Practice assessments">
        {(Object.keys(ACTIVITIES) as Activity[]).map((k) => {
          const A = ACTIVITIES[k];
          const b = best(k);
          const tries = of(k).length;
          return (
            <Link
              key={k}
              href={`?activity=${k}`}
              scroll={false}
              aria-current={activity === k ? "page" : undefined}
              className={cn(
                "flex flex-col gap-3 rounded-2xl border-2 bg-white p-4 transition sm:flex-row sm:items-center",
                activity === k ? "border-maroon shadow-md" : "border-transparent shadow-sm hover:border-ink/20",
              )}
            >
              <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl", activity === k ? "bg-maroon text-white" : "bg-gold/20 text-maroon")}>
                <A.icon className="h-5 w-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-black leading-tight text-ink">{A.label}</span>
                <span className="block text-xs text-ink/60">{tries ? `${tries} attempt${tries === 1 ? "" : "s"} · best ${Math.round(b!)}${A.unit}` : A.blurb}</span>
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          {activity === "cognitive" && <CognitiveTest personalBest={best("cognitive")} recent={recentSeen("cognitive")} />}
          {activity === "judgement" && <JudgementTest personalBest={best("judgement")} recent={recentSeen("judgement")} />}
          {activity === "tools" && <ToolsModule personalBest={best("tools")} recent={recentSeen("tools")} />}
          {activity === "typing" && <TypingTest personalBest={best("typing")} />}
        </div>

        <aside className="grid content-start gap-4">
          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-ink/10">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-maroon">Your progress</p>
            <p className="mt-1 font-black">{ACTIVITIES[activity].label}</p>
            {recent.length === 0 ? (
              <p className="mt-3 text-sm text-ink/60">Your results will appear here after your first attempt.</p>
            ) : (
              <>
                <div className="mt-4 flex h-24 items-end gap-1.5" aria-label="Recent scores, oldest to newest">
                  {[...recent].reverse().map((a) => (
                    <div
                      key={a.id}
                      className="flex-1 rounded-t-md bg-gradient-to-t from-maroon to-maroon/60"
                      style={{ height: `${Math.max(6, (a.score / maxRecent) * 100)}%` }}
                      title={`${Math.round(a.score)}${unit} · ${formatDateTime(a.created_at)}`}
                    />
                  ))}
                </div>
                <ul className="mt-4 divide-y divide-ink/5 text-sm">
                  {recent.slice(0, 5).map((a) => (
                    <li key={a.id} className="flex items-center justify-between py-2">
                      <span className="text-ink/60">{formatDateTime(a.created_at)}</span>
                      <span className="font-black tabular-nums">
                        {Math.round(a.score)}
                        {unit}
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
              Practice results are only visible to you. They aren&apos;t shared with admissions or employers, and they don&apos;t
              affect your application. This isn&apos;t the official TestGorilla assessment.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
