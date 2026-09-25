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
          <Input name="partner_name" defaultValue={p.partner_name ?? ""} placeholder="Arizona State University × Amkor Technology" />
        </div>
        <div>
          <Label>Academic / training partner</Label>
          <Input name="academic_partner" defaultValue={p.academic_partner ?? ""} placeholder="Arizona State University" />
        </div>
        <div>
          <Label>Employer / hiring partner</Label>
          <Input name="employer_partner" defaultValue={p.employer_partner ?? ""} placeholder="Amkor Technology" />
        </div>
        <div>
          <Label>Industry</Label>
          <Input name="industry" defaultValue={p.industry ?? ""} placeholder="Semiconductor packaging" />
        </div>
        <div>
          <Label>Career role (lowercase)</Label>
          <Input name="career_role" defaultValue={p.career_role ?? ""} placeholder="semiconductor packaging technician" />
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
      <details className="rounded-2xl border border-ink/10 p-4" open={!p.id}>
        <summary className="cursor-pointer font-bold">Landing page copy</summary>
        <p className="mt-2 text-sm text-ink/60">Leave any field blank to use generic wording built from the partner names above.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Hero headline</Label>
            <Input name="hero_headline" defaultValue={p.hero_headline ?? ""} placeholder="Build the chips that" />
          </div>
          <div>
            <Label>Hero highlight (shown in gold)</Label>
            <Input name="hero_highlight" defaultValue={p.hero_highlight ?? ""} placeholder="build the future." />
          </div>
          <div className="sm:col-span-2">
            <Label>&ldquo;Why this program&rdquo; headline (the second sentence is shown in gold)</Label>
            <Input name="why_headline" defaultValue={p.why_headline ?? ""} />
          </div>
          <div>
            <Label>Outcome badge (short, e.g. employer name)</Label>
            <Input name="outcome_badge" defaultValue={p.outcome_badge ?? ""} placeholder="TSMC" />
          </div>
          <div>
            <Label>Outcome headline</Label>
            <Input name="outcome_title" defaultValue={p.outcome_title ?? ""} placeholder="A guaranteed TSMC Arizona interview" />
          </div>
          <div className="sm:col-span-2">
            <Label>Outcome condition / fine print</Label>
            <Input name="outcome_detail" defaultValue={p.outcome_detail ?? ""} placeholder="Upon successful completion of program milestones." />
          </div>
          <div>
            <Label>Who should apply (one per line)</Label>
            <Textarea name="audiences" defaultValue={(p.audiences ?? []).join("\n")} className="min-h-32" />
          </div>
          <div>
            <Label>Skills &amp; equipment keywords (one per line, scrolls across the page)</Label>
            <Textarea name="keywords" defaultValue={(p.keywords ?? []).join("\n")} className="min-h-32" />
          </div>
          <div className="sm:col-span-2">
            <Label>External &ldquo;Learn more&rdquo; page (optional; otherwise the program page on this site)</Label>
            <Input name="learn_more_url" type="url" defaultValue={p.learn_more_url ?? ""} placeholder="https://asuengineeringonline.com/…" />
          </div>
          <div>
            <Label>Hero image URL (optional)</Label>
            <Input name="hero_poster" type="url" defaultValue={p.hero_poster ?? ""} placeholder="https://…" />
          </div>
          <div>
            <Label>Hero video URL (optional, MP4)</Label>
            <Input name="hero_video" type="url" defaultValue={p.hero_video ?? ""} placeholder="https://…" />
          </div>
        </div>
      </details>
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
          <label className="flex items-center gap-2 text-sm font-bold">
            <input type="checkbox" name="featured" defaultChecked={p.featured ?? false} className="h-4 w-4 accent-maroon" /> Feature on the home page
          </label>
        </div>
      )}
      <SubmitButton variant="dark" className="justify-self-start" pendingText="Saving…">
        {p.id ? "Save program" : "Create program"}
      </SubmitButton>
    </ActionForm>
  );
}
