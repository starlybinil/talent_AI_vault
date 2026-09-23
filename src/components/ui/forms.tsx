"use client";

import * as React from "react";
import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { AlertTriangle, Loader2, X } from "lucide-react";
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

export type ConfirmOptions = {
  title: string;
  body?: React.ReactNode;
  /** Bulleted consequences shown under the body. */
  points?: string[];
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "default";
};

/** Branded, accessible confirmation modal (replaces window.confirm). */
export function ConfirmDialog({
  open,
  options,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  options: ConfirmOptions;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onCancel]);
  if (!open) return null;
  const danger = options.tone !== "default";
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center" role="presentation">
      <div className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm" onClick={onCancel} aria-hidden />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        <div className={danger ? "h-1.5 bg-gradient-to-r from-red-600 to-maroon" : "h-1.5 bg-gradient-to-r from-maroon to-gold"} />
        <button type="button" onClick={onCancel} className="absolute right-4 top-5 cursor-pointer rounded-full p-1.5 text-ink/40 hover:bg-mist hover:text-ink" aria-label="Close">
          <X className="h-5 w-5" />
        </button>
        <div className="p-6 sm:p-7">
          <div className="flex items-start gap-4">
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${danger ? "bg-red-50 text-red-700" : "bg-gold/20 text-maroon"}`}>
              <AlertTriangle className="h-5 w-5" aria-hidden />
            </span>
            <div className="pr-6">
              <h2 id="confirm-title" className="text-lg font-black leading-snug text-ink">{options.title}</h2>
              {options.body && <div className="mt-1.5 text-sm leading-relaxed text-ink/70">{options.body}</div>}
            </div>
          </div>
          {options.points && options.points.length > 0 && (
            <ul className="mt-5 space-y-2 rounded-2xl bg-mist p-4 text-sm text-ink/80">
              {options.points.map((pt) => (
                <li key={pt} className="flex gap-2">
                  <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${danger ? "bg-red-600" : "bg-maroon"}`} aria-hidden />
                  {pt}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onCancel}>
              {options.cancelLabel ?? "Cancel"}
            </Button>
            <Button ref={confirmRef} type="button" variant={danger ? "danger" : "dark"} onClick={onConfirm}>
              {options.confirmLabel ?? "Confirm"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Form bound to a server action returning ActionState. Shows the result inline.
 * `resetOnSuccess` clears inputs after a successful submit (e.g. message composer).
 * `confirm` shows a branded confirmation dialog before submitting.
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
  confirm?: string | ConfirmOptions;
}) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  const confirmed = useRef(false);
  const [asking, setAsking] = React.useState(false);
  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  const options: ConfirmOptions | null = !confirm
    ? null
    : typeof confirm === "string"
      ? { title: "Are you sure?", body: confirm, confirmLabel: "Yes, continue" }
      : confirm;
  const cancel = React.useCallback(() => setAsking(false), []);
  return (
    <form
      ref={ref}
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (options && !confirmed.current) {
          e.preventDefault();
          setAsking(true);
          return;
        }
        confirmed.current = false;
      }}
    >
      {children}
      {options && (
        <ConfirmDialog
          open={asking}
          options={options}
          onCancel={cancel}
          onConfirm={() => {
            setAsking(false);
            confirmed.current = true;
            ref.current?.requestSubmit();
          }}
        />
      )}
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
