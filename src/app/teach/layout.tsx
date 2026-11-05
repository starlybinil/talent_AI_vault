import { AppHeader } from "@/components/shell/AppHeader";
import { requirePermission } from "@/lib/session";

export default async function TeachLayout({ children }: { children: React.ReactNode }) {
  const session = await requirePermission("cohorts.teach", "/teach");
  return (
    <div className="min-h-screen bg-mist">
      <AppHeader session={session} area="teach" />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">{children}</main>
    </div>
  );
}
