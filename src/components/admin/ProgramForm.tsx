import { saveProgram } from "@/app/admin/actions";
import { ActionForm, SubmitButton } from "@/components/ui/forms";
import { Input, Label, Textarea } from "@/components/ui";
import { EMPLOYER_FIELD_OPTIONS } from "@/lib/validation";
import type { Program } from "@/lib/data";

/** Edits program content. Admissions-only fields (exam link, employer visibility, active) are shown to program admins. */
export function ProgramForm({ program, adminFields }: { program?: Partial<Program> & { default_exam_url?: string | null }; adminFields: boolean }) {
  const p = program ?? {};
  const json = (v: unknown) => JSON.stringify(v ?? [], null, 2);
  return (
    <ActionForm action={saveProgram} className="grid gap-5">
      {p.id && <input type="hidden" name="id" value={p.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        {!p.id && (
          <div>
            <Label>URL slug</Label>
            <Input name="slug" required placeholder="new-program" />
          </div>
        )}
        <div>
          <Label>Program name</Label>
          <Input name="name" defaultValue={p.name} required />
        </div>
        <div>
          <Label>Short name</Label>
          <Input name="short_name" defaultValue={p.short_name} required />
        </div>
        <div>
          <Label>Partners line</Label>
          <Input name="partner_name" defaultValue={p.partner_name ?? ""} />
        </div>
        <div className="sm:col-span-2">
          <Label>Tagline</Label>
          <Input name="tagline" defaultValue={p.tagline ?? ""} />
        </div>
        <div className="sm:col-span-2">
          <Label>Summary</Label>
          <Textarea name="summary" defaultValue={p.summary ?? ""} />
        </div>
        <div>
          <Label>Hours label</Label>
          <Input name="hours_label" defaultValue={p.hours_label ?? ""} />
        </div>
        <div>
          <Label>Cost label</Label>
          <Input name="cost_label" defaultValue={p.cost_label ?? ""} />
        </div>
        <div>
          <Label>Duration label</Label>
          <Input name="duration_label" defaultValue={p.duration_label ?? ""} />
        </div>
        <div>
          <Label>Eligibility</Label>
          <Input name="eligibility" defaultValue={p.eligibility ?? ""} />
        </div>
      </div>
      <details className="rounded-2xl border border-ink/10 p-4">
        <summary className="cursor-pointer font-bold">Advanced content (JSON): topics, formats, FAQs, stats</summary>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {(["topics", "formats", "faqs", "stats"] as const).map((k) => (
            <div key={k}>
              <Label className="capitalize">{k}</Label>
              <Textarea name={k} defaultValue={json(p[k])} className="min-h-48 font-mono text-xs" spellCheck={false} />
            </div>
          ))}
        </div>
      </details>
      {adminFields && (
        <div className="grid gap-4 rounded-2xl bg-mist p-5">
          <div>
            <Label>Default TestGorilla assessment link</Label>
            <Input name="default_exam_url" type="url" defaultValue={p.default_exam_url ?? ""} placeholder="https://app.testgorilla.com/…" />
          </div>
          <fieldset>
            <legend className="text-sm font-bold">Fields partner employers can see (for consenting applicants)</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {EMPLOYER_FIELD_OPTIONS.map((f) => (
                <label key={f.key} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="employer_visible_fields" value={f.key} defaultChecked={(p.employer_visible_fields ?? []).includes(f.key)} className="h-4 w-4 accent-maroon" />
                  {f.label}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex items-center gap-2 text-sm font-bold">
            <input type="checkbox" name="active" defaultChecked={p.active ?? false} className="h-4 w-4 accent-maroon" /> Accepting applications (listed publicly)
          </label>
        </div>
      )}
      <SubmitButton variant="dark" className="justify-self-start" pendingText="Saving…">
        {p.id ? "Save program" : "Create program"}
      </SubmitButton>
    </ActionForm>
  );
}
