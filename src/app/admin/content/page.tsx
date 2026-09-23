import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/session";
import { saveContent } from "@/app/admin/actions";
import { ProgramForm } from "@/components/admin/ProgramForm";
import { ActionForm, SubmitButton } from "@/components/ui/forms";
import { Card, Input, Label, PageHeader, Textarea } from "@/components/ui";
import type { Program } from "@/lib/data";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Site content" };

export default async function ContentPage({ searchParams }: { searchParams: Promise<{ program?: string }> }) {
  const sp = await searchParams;
  await requirePermission("content.manage", "/admin/content");
  const supabase = await createClient();
  const [{ data: blocks }, { data: programs }] = await Promise.all([
    supabase.from("site_content").select("key, value, updated_at").order("key"),
    supabase.from("programs").select("*").order("sort"),
  ]);
  const selected = (programs ?? []).find((p) => p.id === sp.program) ?? (programs ?? [])[0];

  return (
    <div>
      <PageHeader eyebrow="Web" title="Site content" description="Edit landing-page copy and content blocks. Changes publish within a minute." />
      <Card>
        <h2 className="font-black">Content blocks</h2>
        <div className="mt-4 space-y-4">
          {(blocks ?? []).map((b) => (
            <ActionForm key={b.key} action={saveContent} className="grid gap-2 rounded-2xl border border-ink/10 p-4">
              <input type="hidden" name="key" value={b.key} />
              <div className="flex items-center justify-between">
                <p className="font-mono text-sm font-bold">{b.key}</p>
                <p className="text-xs text-ink/50">Updated {formatDateTime(b.updated_at)}</p>
              </div>
              <Textarea name="value" defaultValue={JSON.stringify(b.value, null, 2)} className="min-h-28 font-mono text-xs" spellCheck={false} aria-label={b.key} />
              <SubmitButton size="sm" variant="dark" className="justify-self-start">Publish</SubmitButton>
            </ActionForm>
          ))}
          <ActionForm action={saveContent} resetOnSuccess className="grid gap-2 rounded-2xl border border-dashed border-ink/20 p-4">
            <Label>New block key</Label>
            <Input name="key" placeholder="block_key" />
            <Textarea name="value" placeholder='{"text": "…"}' className="font-mono text-xs" />
            <SubmitButton size="sm" variant="dark" className="justify-self-start">Create</SubmitButton>
          </ActionForm>
        </div>
      </Card>

      {selected && (
        <Card className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-black">Program landing content</h2>
            <div className="flex flex-wrap gap-2">
              {(programs ?? []).map((p) => (
                <Link key={p.id} href={`?program=${p.id}`} className={`rounded-full px-3 py-1 text-sm font-bold ${p.id === selected.id ? "bg-ink text-white" : "bg-mist"}`}>
                  {p.short_name}
                </Link>
              ))}
            </div>
          </div>
          <div className="mt-5">
            <ProgramForm key={selected.id} program={selected as Program} adminFields={false} />
          </div>
        </Card>
      )}
    </div>
  );
}
