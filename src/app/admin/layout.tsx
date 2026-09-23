import { AppHeader } from "@/components/shell/AppHeader";
import { AdminSidebar } from "@/components/admin/Sidebar";
import { requireSession } from "@/lib/session";
import { ADMIN_NAV, permissionsFor } from "@/lib/rbac";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession("/admin");
  const perms = permissionsFor(session.roles);
  const items = ADMIN_NAV.filter((n) => perms.has(n.permission)).map(({ href, label, icon }) => ({ href, label, icon }));
  return (
    <div className="min-h-screen bg-mist">
      <AppHeader session={session} area="admin" />
      <div className="mx-auto grid max-w-[1400px] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[220px_1fr] lg:px-8 lg:py-10">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <AdminSidebar items={items} />
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
