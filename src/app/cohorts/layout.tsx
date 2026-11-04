import { AppHeader } from "@/components/shell/AppHeader";
import { requirePermission } from "@/lib/session";

export default async function CohortsLayout({ children }: { children: React.ReactNode }) {
  const session = await requirePermission("cohorts.track", "/cohorts");
  return (
    <div className="min-h-screen bg-mist">
      <AppHeader session={session} area="cohorts" />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">{children}</main>
    </div>
  );
}
