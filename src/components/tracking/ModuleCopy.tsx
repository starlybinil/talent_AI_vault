import { Copy } from "lucide-react";
import { copyModules } from "@/app/cohorts/actions";
import { ActionForm, SubmitButton } from "@/components/ui/forms";
import { Card, Label, Select } from "@/components/ui";
import { shortDate } from "@/lib/schedule";

type Other = { id: string; name: string; start: string; modules: number };

/** Reuse a module list across cohorts of the same program, in either direction. */
export function ModuleCopy({ cohortId, hasModules, others }: { cohortId: string; hasModules: boolean; others: Other[] }) {
  const withModules = others.filter((o) => o.modules > 0);
  return (
    <div className="grid h-fit gap-6">
      <Card>
        <h2 className="flex items-center gap-2 font-black">
          <Copy className="h-4 w-4 text-maroon" aria-hidden /> Copy these modules to other cohorts
        </h2>
        <p className="mt-1 text-xs text-ink/60">Same program only. Modules a cohort already has are skipped; scores are never copied.</p>
        {!hasModules ? (
          <p className="mt-3 text-sm text-ink/50">Add modules to this cohort first.</p>
        ) : others.length === 0 ? (
          <p className="mt-3 text-sm text-ink/50">There are no other cohorts in this program.</p>
        ) : (
          <ActionForm action={copyModules} className="mt-3 grid gap-2">
            <input type="hidden" name="cohort_id" value={cohortId} />
            <input type="hidden" name="direction" value="to" />
            <ul className="max-h-72 space-y-1 overflow-y-auto rounded-xl bg-mist p-2">
              {others.map((o) => (
                <li key={o.id}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-white">
                    <input type="checkbox" name="cohort_ids" value={o.id} className="h-4 w-4 accent-maroon" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold leading-tight">{o.name}</span>
                      <span className="text-xs text-ink/50">
                        Starts {shortDate(o.start)} · {o.modules ? `${o.modules} module${o.modules === 1 ? "" : "s"} now` : "no modules yet"}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <SubmitButton size="sm" variant="dark" className="justify-self-start" pendingText="Copying…">
              Copy to selected cohorts
            </SubmitButton>
          </ActionForm>
        )}
      </Card>

      {withModules.length > 0 && (
        <Card>
          <h2 className="font-black">Copy modules from another cohort</h2>
          <p className="mt-1 text-xs text-ink/60">Adds that cohort&apos;s modules here, after any this cohort already has.</p>
          <ActionForm action={copyModules} className="mt-3 grid gap-2">
            <input type="hidden" name="cohort_id" value={cohortId} />
            <input type="hidden" name="direction" value="from" />
            <Label htmlFor="copy-from" className="sr-only">
              Cohort to copy from
            </Label>
            <Select id="copy-from" name="cohort_ids" required defaultValue="">
              <option value="" disabled>
                Choose a cohort…
              </option>
              {withModules.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} ({o.modules} modules)
                </option>
              ))}
            </Select>
            <SubmitButton size="sm" variant="outline" className="justify-self-start" pendingText="Copying…">
              Copy into this cohort
            </SubmitButton>
          </ActionForm>
        </Card>
      )}
    </div>
  );
}
