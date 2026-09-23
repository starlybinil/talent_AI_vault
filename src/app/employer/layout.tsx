import { AppHeader } from "@/components/shell/AppHeader";
import { requirePermission } from "@/lib/session";
import { getFlags } from "@/lib/data";
import { Alert } from "@/components/ui";

export default async function EmployerLayout({ children }: { children: React.ReactNode }) {
  const session = await requirePermission("employer.portal", "/employer");
  const flags = await getFlags();
  return (
    <div className="min-h-screen bg-mist">
      <AppHeader session={session} area="employer" />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        {flags.employer_portal === false ? <Alert tone="warn" title="The employer portal is temporarily unavailable." /> : children}
      </main>
    </div>
  );
}
