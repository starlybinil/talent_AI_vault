import { saveAgreementTemplate } from "@/app/admin/actions";
import { ActionForm, SubmitButton } from "@/components/ui/forms";
import { Card, Input, Label, Textarea } from "@/components/ui";

export type AgreementTemplate = { id: string; title: string; body: string; version: number; required: boolean; active: boolean };

/** One place to manage the agreements every applicant to a program signs. */
export function AgreementsEditor({ programId, templates }: { programId: string; templates: AgreementTemplate[] }) {
  return (
    <Card>
      <h2 className="text-lg font-black">Program agreements</h2>
      <p className="text-sm text-ink/60">
        These agreements apply to every applicant in this program. Applicants can read them from the start and sign them once registered in a
        cohort. Editing the text creates a new version — applicants who haven&apos;t finished signing must sign the new version.
      </p>
      <div className="mt-5 space-y-5">
          {templates.map((t) => (
            <ActionForm key={t.id} action={saveAgreementTemplate} className="grid gap-3 rounded-2xl border border-ink/10 p-4">
              <input type="hidden" name="id" value={t.id} />
              <input type="hidden" name="program_id" value={programId} />
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex-1">
                  <Label>Title <span className="font-normal text-ink/50">· version {t.version}</span></Label>
                  <Input name="title" defaultValue={t.title} required />
                </div>
                <label className="flex items-center gap-2 pb-3 text-sm font-bold">
                  <input type="checkbox" name="required" defaultChecked={t.required} className="h-4 w-4 accent-maroon" /> Required
                </label>
                <label className="flex items-center gap-2 pb-3 text-sm font-bold">
                  <input type="checkbox" name="active" defaultChecked={t.active} className="h-4 w-4 accent-maroon" /> Active
                </label>
              </div>
              <Textarea name="body" defaultValue={t.body} className="min-h-40 text-sm" required />
              <SubmitButton size="sm" variant="dark" className="justify-self-start">Save agreement</SubmitButton>
            </ActionForm>
          ))}
          <ActionForm action={saveAgreementTemplate} resetOnSuccess className="grid gap-3 rounded-2xl border border-dashed border-ink/20 p-4">
            <input type="hidden" name="program_id" value={programId} />
            <p className="font-bold">Add an agreement</p>
            <Input name="title" placeholder="Title" required />
            <Textarea name="body" placeholder="Agreement text" className="min-h-32 text-sm" required />
            <label className="flex items-center gap-2 text-sm font-bold">
              <input type="checkbox" name="required" defaultChecked className="h-4 w-4 accent-maroon" /> Required
            </label>
            <SubmitButton size="sm" variant="dark" className="justify-self-start">Add agreement</SubmitButton>
          </ActionForm>
        </div>
    </Card>
  );
}
