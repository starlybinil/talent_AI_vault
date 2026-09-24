import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/session";
import { Badge, ButtonLink, PageHeader } from "@/components/ui";

export const metadata = { title: "Programs" };

export default async function ProgramsPage() {
  await requirePermission("programs.manage", "/admin/programs");
  const supabase = await createClient();
  const { data: programs } = await supabase.from("programs").select("id, slug, name, partner_name, active").order("sort");
  return (
    <div>
      <PageHeader
        eyebrow="Catalog"
        title="Programs"
        description="Every FoundryReady training program, its landing content, agreements and employer partners."
        actions={
          <ButtonLink href="/admin/programs/new" variant="dark">
            <Plus className="h-4 w-4" /> New program
          </ButtonLink>
        }
      />
      <div className="grid gap-4 md:grid-cols-2">
        {(programs ?? []).map((p) => (
          <Link key={p.id} href={`/admin/programs/${p.id}`} className="rounded-2xl border border-ink/10 bg-white p-6 shadow-sm transition hover:border-maroon">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-widest text-maroon">/{p.slug}</p>
              <Badge tone={p.active ? "success" : "neutral"}>{p.active ? "Active" : "Inactive"}</Badge>
            </div>
            <p className="mt-2 text-xl font-black">{p.name}</p>
            <p className="text-sm text-ink/60">{p.partner_name}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
