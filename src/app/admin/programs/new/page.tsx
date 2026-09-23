import { requirePermission } from "@/lib/session";
import { ProgramForm } from "@/components/admin/ProgramForm";
import { Card, PageHeader } from "@/components/ui";

export default async function NewProgram() {
  await requirePermission("programs.manage", "/admin/programs/new");
  return (
    <div>
      <PageHeader eyebrow="Catalog" title="New program" />
      <Card>
        <ProgramForm adminFields />
      </Card>
    </div>
  );
}
