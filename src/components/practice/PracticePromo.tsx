import Link from "next/link";
import { ArrowRight, Brain, Keyboard, MessagesSquare, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { key: "cognitive", label: "Cognitive ability", icon: Brain },
  { key: "judgement", label: "Situational judgement", icon: MessagesSquare },
  { key: "tools", label: "Hand tools", icon: Wrench },
  { key: "typing", label: "Typing speed", icon: Keyboard },
] as const;

/** Invites applicants to the Practice Lab while they wait for screening and the assessment. */
export function PracticePromo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-ink to-ink-800 text-white shadow-sm">
      <div className={compact ? "p-5" : "p-6 sm:p-7"}>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold">While you wait · Practice Lab</p>
        <p className={compact ? "mt-2 text-lg font-black" : "mt-2 text-xl font-black"}>Get ready for your assessment</p>
        <p className="mt-1 text-sm text-white/70">Four practice assessments, new questions every attempt. Only you see your results.</p>
        <div className={cn("mt-4 grid gap-2", !compact && "sm:grid-cols-2")}>
          {ITEMS.map(({ key, label, icon: Icon }) => (
            <Link key={key} href={`/portal/practice?activity=${key}`} className="group flex items-center gap-3 rounded-xl bg-white/10 p-3 transition hover:bg-white/15">
              <Icon className="h-5 w-5 shrink-0 text-gold" aria-hidden />
              <span className="flex-1 text-sm font-bold">{label}</span>
              <ArrowRight className="h-4 w-4 opacity-60 transition group-hover:translate-x-0.5" aria-hidden />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
