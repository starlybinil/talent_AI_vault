import { AppHeader } from "@/components/shell/AppHeader";
import { requireSession } from "@/lib/session";
import { can } from "@/lib/rbac";
import { redirect } from "next/navigation";

export default async function SessionsLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession("/sessions");
  if (!(can(session.roles, "cohorts.teach") || can(session.roles, "cohorts.track"))) redirect("/forbidden");
  const area = can(session.roles, "cohorts.track") ? "cohorts" : "teach";
  return (
    <div className="min-h-screen bg-mist">
      <AppHeader session={session} area={area} />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">{children}</main>
    </div>
  );
}
