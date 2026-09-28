"use client";

import * as React from "react";
import { ExternalLink, FileText, Loader2, Upload } from "lucide-react";
import { addProgramResource, deleteProgramResource } from "@/app/admin/actions";
import { createClient } from "@/lib/supabase/client";
import { ActionForm, SubmitButton } from "@/components/ui/forms";
import { Alert, Button, Input, Label, Select, Textarea } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";

type Resource = { id: string; title: string; description: string | null; url: string | null; file_name: string | null; cohort_id: string | null };

const MAX_MB = 25;

/** Admins add links or files for trainees; files go straight to private storage from the browser. */
export function ProgramResources({
  programId,
  resources,
  cohorts,
}: {
  programId: string;
  resources: Resource[];
  cohorts: Array<{ id: string; name: string }>;
}) {
  const [kind, setKind] = React.useState<"file" | "link">("file");
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<ActionState>(null);
  const formRef = React.useRef<HTMLFormElement>(null);
  const cohortName = Object.fromEntries(cohorts.map((c) => [c.id, c.name]));

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setResult(null);
    let filePath: string | null = null;
    let fileName: string | null = null;
    if (kind === "file") {
      const file = fd.get("file") as File | null;
      if (!file || !file.size) {
        setBusy(false);
        return setResult({ error: "Choose a file to upload." });
      }
      if (file.size > MAX_MB * 1024 * 1024) {
        setBusy(false);
        return setResult({ error: `Files must be ${MAX_MB} MB or smaller.` });
      }
      fileName = file.name;
      filePath = `${programId}/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]+/g, "_").slice(-120)}`;
      const { error } = await createClient().storage.from("program-resources").upload(filePath, file, { contentType: file.type || undefined });
      if (error) {
        setBusy(false);
        return setResult({ error: `Upload failed: ${error.message}` });
      }
    }
    const res = await addProgramResource({
      programId,
      cohortId: String(fd.get("cohort_id") || "") || null,
      title: String(fd.get("title") || ""),
      description: String(fd.get("description") || ""),
      url: kind === "link" ? String(fd.get("url") || "") : null,
      filePath,
      fileName,
    });
    setBusy(false);
    setResult(res);
    if (res?.ok) formRef.current?.reset();
  }

  return (
    <div>
      <h2 className="text-lg font-black">Program resources</h2>
      <p className="text-sm text-ink/60">
        Schedules, guides, safety sheets and links for trainees. They appear on each confirmed trainee&apos;s In program tab (for the whole
        program, or only one cohort).
      </p>

      {resources.length > 0 && (
        <ul className="mt-4 divide-y divide-ink/5 rounded-2xl border border-ink/10">
          {resources.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-bold">
                  {r.url ? <ExternalLink className="h-4 w-4 shrink-0 text-maroon" aria-hidden /> : <FileText className="h-4 w-4 shrink-0 text-maroon" aria-hidden />}
                  <span className="truncate">{r.title}</span>
                </p>
                <p className="truncate text-xs text-ink/50">
                  {r.cohort_id ? `Only ${cohortName[r.cohort_id] ?? "one cohort"}` : "Whole program"} · {r.url ?? r.file_name}
                </p>
              </div>
              <ActionForm action={deleteProgramResource} confirm={`Remove "${r.title}"? Trainees will no longer see it.`}>
                <input type="hidden" name="resource_id" value={r.id} />
                <SubmitButton variant="ghost" size="sm">
                  Remove
                </SubmitButton>
              </ActionForm>
            </li>
          ))}
        </ul>
      )}

      <form ref={formRef} onSubmit={submit} className="mt-5 grid gap-3 rounded-2xl bg-mist p-4 sm:grid-cols-2">
        <div className="sm:col-span-2 flex gap-2">
          {(["file", "link"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`cursor-pointer rounded-full px-4 py-1.5 text-sm font-bold ${kind === k ? "bg-ink text-white" : "bg-white text-ink/60"}`}
            >
              {k === "file" ? "Upload a file" : "Add a link"}
            </button>
          ))}
        </div>
        <div>
          <Label htmlFor="res-title">Title</Label>
          <Input id="res-title" name="title" required maxLength={160} placeholder="Week 1 schedule" />
        </div>
        <div>
          <Label htmlFor="res-cohort">Who sees it</Label>
          <Select id="res-cohort" name="cohort_id" defaultValue="">
            <option value="">Everyone in the program</option>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                Only {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="res-desc">Description (optional)</Label>
          <Textarea id="res-desc" name="description" maxLength={500} className="min-h-16" placeholder="What it is and when trainees need it" />
        </div>
        <div className="sm:col-span-2">
          {kind === "file" ? (
            <>
              <Label htmlFor="res-file">File (PDF, Word, slides, images · up to {MAX_MB} MB)</Label>
              <Input id="res-file" name="file" type="file" className="pt-2.5" />
            </>
          ) : (
            <>
              <Label htmlFor="res-url">Link</Label>
              <Input id="res-url" name="url" type="url" placeholder="https://…" />
            </>
          )}
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" variant="dark" disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Add resource
          </Button>
        </div>
      </form>
      {result?.error && <Alert tone="danger" className="mt-3">{result.error}</Alert>}
      {result?.ok && <Alert tone="success" className="mt-3">{result.message}</Alert>}
    </div>
  );
}
