"use client";

import * as React from "react";
import { Loader2, Upload } from "lucide-react";
import { addSiteMedia } from "@/app/admin/actions";
import { createClient } from "@/lib/supabase/client";
import { Alert, Button, Input, Label } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";

const MAX_MB = 10;

/** Uploads a program photo straight to the public site-media bucket, then records it in the library. */
export function MediaUploader() {
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<ActionState>(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const file = fd.get("file") as File | null;
    setResult(null);
    if (!file || !file.size) return setResult({ error: "Choose a photo to upload." });
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return setResult({ error: "Use a JPG, PNG or WebP photo." });
    if (file.size > MAX_MB * 1024 * 1024) return setResult({ error: `Photos must be ${MAX_MB} MB or smaller.` });
    setBusy(true);
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `program/${crypto.randomUUID()}.${ext}`;
    const { error } = await createClient().storage.from("site-media").upload(path, file, { contentType: file.type });
    if (error) {
      setBusy(false);
      return setResult({ error: `Upload failed: ${error.message}` });
    }
    const res = await addSiteMedia({ path, alt: String(fd.get("alt") || ""), caption: String(fd.get("caption") || "") });
    setBusy(false);
    setResult(res);
    if (res?.ok) formRef.current?.reset();
  }

  return (
    <form ref={formRef} onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Label htmlFor="media-file">Photo (JPG, PNG or WebP · up to {MAX_MB} MB · landscape works best)</Label>
        <Input id="media-file" name="file" type="file" accept="image/jpeg,image/png,image/webp" required className="pt-2.5" />
      </div>
      <div>
        <Label htmlFor="media-alt">What&apos;s in the photo? (required)</Label>
        <Input id="media-alt" name="alt" required maxLength={200} placeholder="Trainees calibrating a vacuum gauge in the lab" />
      </div>
      <div>
        <Label htmlFor="media-caption">Caption (optional)</Label>
        <Input id="media-caption" name="caption" maxLength={120} placeholder="Chandler lab · Cohort ETA4" />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" variant="dark" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload photo
        </Button>
        <p className="mt-2 text-xs text-ink/50">Only upload photos you have permission to use, and with consent from anyone clearly shown.</p>
      </div>
      {result?.error && <Alert tone="danger" className="sm:col-span-2">{result.error}</Alert>}
      {result?.ok && <Alert tone="success" className="sm:col-span-2">{result.message}</Alert>}
    </form>
  );
}
