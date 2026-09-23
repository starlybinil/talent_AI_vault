import { AppHeader } from "@/components/shell/AppHeader";
import { requireSession } from "@/lib/session";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession("/portal");
  return (
    <div className="min-h-screen bg-mist">
      <AppHeader session={session} area="portal" />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">{children}</main>
    </div>
  );
}
