import { Loader2 } from "lucide-react";

/** Shown by route-level loading.tsx files while a portal page is being prepared. */
export function PageLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-ink/60" role="status" aria-live="polite">
      <Loader2 className="h-8 w-8 animate-spin text-maroon" aria-hidden />
      <p className="text-sm font-bold">{label}</p>
    </div>
  );
}
