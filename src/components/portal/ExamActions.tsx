"use client";

import * as React from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { markExamComplete } from "@/app/portal/actions";
import { Alert, Button } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";

export function MarkExamComplete({ applicationId, done }: { applicationId: string; done: boolean }) {
  const [pending, start] = React.useTransition();
  const [res, setRes] = React.useState<ActionState>(null);
  if (done || res?.ok)
    return (
      <Alert tone="success" title="Marked as complete">
        {res?.message ?? "Thanks! Admissions will update your result once TSMC Arizona shares it."}
      </Alert>
    );
  return (
    <div>
      <Button variant="outline" disabled={pending} onClick={() => start(async () => setRes(await markExamComplete(applicationId)))}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
        I&apos;ve completed the assessment
      </Button>
      {res?.error && <Alert tone="danger" className="mt-3">{res.error}</Alert>}
    </div>
  );
}
