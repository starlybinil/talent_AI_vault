"use client";

import * as React from "react";
import { resetEmailTemplate, saveEmailTemplate } from "@/app/admin/actions";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { ActionForm, SubmitButton } from "@/components/ui/forms";
import { Card, Input, Label } from "@/components/ui";

type Wording = { subject: string; heading: string; body: string; cta_label: string | null };

/** Subject, heading, body and button label for one email; plus "reset to default". */
export function EmailTemplateEditor({
  templateKey,
  current,
  defaults,
  hasButton,
  customized,
}: {
  templateKey: string;
  current: Wording;
  defaults: Wording;
  hasButton: boolean;
  customized: boolean;
}) {
  return (
    <Card>
      <ActionForm action={saveEmailTemplate} className="grid gap-4">
        <input type="hidden" name="key" value={templateKey} />
        <div>
          <Label htmlFor="subject">Subject line</Label>
          <Input id="subject" name="subject" defaultValue={current.subject} required maxLength={200} />
        </div>
        <div>
          <Label htmlFor="heading">Heading (large title at the top of the email)</Label>
          <Input id="heading" name="heading" defaultValue={current.heading} required maxLength={200} />
        </div>
        <div>
          <Label>Email text</Label>
          <RichTextEditor name="body" defaultValue={current.body} required />
        </div>
        {hasButton && (
          <div>
            <Label htmlFor="cta_label">Button label</Label>
            <Input id="cta_label" name="cta_label" defaultValue={current.cta_label ?? defaults.cta_label ?? ""} maxLength={80} />
            <p className="mt-1 text-xs text-ink/50">Where the button goes is set automatically (portal, scheduling, application or assessment link).</p>
          </div>
        )}
        <SubmitButton variant="dark" className="justify-self-start" pendingText="Saving…">
          Save template
        </SubmitButton>
      </ActionForm>
      {customized && (
        <ActionForm
          action={resetEmailTemplate}
          className="mt-4 border-t border-ink/10 pt-4"
          confirm={{ title: "Restore the default wording?", body: "Your customized subject, heading, text and button label for this email are removed.", confirmLabel: "Restore default", tone: "danger" }}
        >
          <input type="hidden" name="key" value={templateKey} />
          <SubmitButton size="sm" variant="ghost" className="text-red-700" pendingText="Restoring…">
            Restore default wording
          </SubmitButton>
        </ActionForm>
      )}
    </Card>
  );
}
