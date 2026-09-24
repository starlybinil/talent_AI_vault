"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui";

/** Shown once when the applicant finishes enrollment (cohorts chosen + all agreements signed). */
export function StepCompleteDialog({ title, message }: { title: string; message: string }) {
  const [open, setOpen] = useState(true);
  const okRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    // Drop ?done=1 so a refresh doesn't show the dialog again.
    const url = new URL(window.location.href);
    url.searchParams.delete("done");
    url.searchParams.delete("chosen");
    window.history.replaceState(null, "", url.toString());
  }, []);

  useEffect(() => {
    if (!open) return;
    okRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center" role="presentation">
      <div className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm" onClick={close} aria-hidden />
      <div role="alertdialog" aria-modal="true" aria-labelledby="step-complete-title" aria-describedby="step-complete-body" className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white text-center shadow-2xl">
        <div className="h-1.5 bg-gradient-to-r from-maroon via-gold to-maroon" />
        <button type="button" onClick={close} className="absolute right-4 top-5 cursor-pointer rounded-full p-1.5 text-ink/40 hover:bg-mist hover:text-ink" aria-label="Close">
          <X className="h-5 w-5" />
        </button>
        <div className="p-7 sm:p-8">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-success">
            <CheckCircle2 className="h-8 w-8" aria-hidden />
          </span>
          <p className="mt-4 text-xs font-bold uppercase tracking-[0.2em] text-success">Step complete</p>
          <h2 id="step-complete-title" className="mt-1 text-2xl font-black tracking-tight text-ink">
            {title}
          </h2>
          <p id="step-complete-body" className="mt-2 text-ink/70">
            {message}
          </p>
          <Button ref={okRef} type="button" variant="dark" className="mt-6 w-full" onClick={close}>
            Got it
          </Button>
        </div>
      </div>
    </div>
  );
}
