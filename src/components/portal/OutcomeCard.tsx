import { Briefcase, CalendarCheck, GraduationCap } from "lucide-react";
import { formatDate } from "@/lib/utils";

export type OutcomeView = {
  completedOn: string | null;
  completionNote: string | null;
  employer: string | null;
  jobTitle: string | null;
  startDate: string | null;
};

/** Program completion and hire, shown to the trainee (their record) and to partner employers. */
export function OutcomeCard({ outcome, audience, name }: { outcome: OutcomeView; audience: "applicant" | "employer"; name?: string }) {
  const hired = !!outcome.employer;
  const you = audience === "applicant";
  return (
    <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-maroon to-maroon-900 text-white shadow-lg">
      <div className="h-1.5 bg-gradient-to-r from-gold via-[#fff3c4] to-gold" />
      <div className="p-6 sm:p-7">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold">{hired ? "Hired" : "Program completed"}</p>
        <p className="mt-2 text-2xl font-black leading-tight">
          {hired
            ? you
              ? `You're hired at ${outcome.employer}!`
              : `Hired by ${outcome.employer}`
            : you
              ? "You completed the program!"
              : `${name ?? "This candidate"} completed the program`}
        </p>

        <ul className="mt-5 grid gap-3">
          <li className="flex items-start gap-3 rounded-2xl bg-white/10 p-4">
            <GraduationCap className="mt-0.5 h-5 w-5 shrink-0 text-gold" aria-hidden />
            <div className="text-sm">
              <p className="font-black">Successfully completed{outcome.completedOn ? ` · ${formatDate(outcome.completedOn)}` : ""}</p>
              {outcome.completionNote && <p className="mt-0.5 text-white/75">{outcome.completionNote}</p>}
            </div>
          </li>
          {hired ? (
            <li className="flex items-start gap-3 rounded-2xl bg-white/10 p-4">
              <Briefcase className="mt-0.5 h-5 w-5 shrink-0 text-gold" aria-hidden />
              <div className="text-sm">
                <p className="font-black">
                  {outcome.jobTitle ? `${outcome.jobTitle} · ` : ""}
                  {outcome.employer}
                </p>
                {outcome.startDate && (
                  <p className="mt-0.5 flex items-center gap-1.5 text-white/75">
                    <CalendarCheck className="h-4 w-4" aria-hidden /> Starts {formatDate(outcome.startDate)}
                  </p>
                )}
              </div>
            </li>
          ) : (
            <li className="flex items-start gap-3 rounded-2xl border border-dashed border-white/25 p-4 text-sm text-white/75">
              <Briefcase className="mt-0.5 h-5 w-5 shrink-0 text-white/50" aria-hidden />
              {you
                ? "Next: interviews with employer partners. Admissions records your hire when you accept an offer."
                : "Available to hire. Admissions records the hire once an offer is accepted."}
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
