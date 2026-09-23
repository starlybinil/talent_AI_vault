"use client";

import * as React from "react";
import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Alert, Button } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";

export function SubmitButton({
  children,
  pendingText,
  variant,
  size,
  className,
  ...rest
}: React.ComponentProps<typeof Button> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || rest.disabled} variant={variant} size={size} className={className} {...rest}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {pending ? pendingText ?? "Working…" : children}
    </Button>
  );
}

/**
 * Form bound to a server action returning ActionState. Shows the result inline.
 * `resetOnSuccess` clears inputs after a successful submit (e.g. message composer).
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess,
  confirm,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  confirm?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form
      ref={ref}
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
      {state?.error && (
        <Alert tone="danger" className="mt-3">
          {state.error}
        </Alert>
      )}
      {state?.ok && state.message && (
        <Alert tone="success" className="mt-3">
          {state.message}
        </Alert>
      )}
    </form>
  );
}
