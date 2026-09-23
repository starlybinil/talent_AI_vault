import Link from "next/link";
import { MapPin, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/session";
import { deleteLocation, saveLocation } from "@/app/admin/actions";
import { ActionForm, SubmitButton } from "@/components/ui/forms";
import { Badge, Card, EmptyState, Input, Label, PageHeader, Textarea } from "@/components/ui";

export const metadata = { title: "Training locations" };

type Location = { id: string; name: string; address: string; notes: string | null; active: boolean };

function LocationFields({ l }: { l?: Location }) {
  const key = l?.id ?? "new";
  return (
    <>
      {l && <input type="hidden" name="id" value={l.id} />}
      <div>
        <Label htmlFor={`name-${key}`}>Location name</Label>
        <Input id={`name-${key}`} name="name" defaultValue={l?.name} required maxLength={120} placeholder="Tempe" />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor={`address-${key}`}>Address</Label>
        <Input id={`address-${key}`} name="address" defaultValue={l?.address} required maxLength={200} placeholder="ASU Tempe campus, 1151 S Forest Ave, Tempe, AZ 85281" />
      </div>
      <div className="sm:col-span-3">
        <Label htmlFor={`notes-${key}`}>Notes for admins (optional)</Label>
        <Textarea id={`notes-${key}`} name="notes" defaultValue={l?.notes ?? ""} maxLength={500} placeholder="Parking, building, room, contact…" className="min-h-16 text-sm" />
      </div>
    </>
  );
}

export default async function LocationsPage() {
  await requirePermission("cohorts.manage", "/admin/locations");
  const supabase = await createClient();
  const [{ data: locations }, { data: cohorts }] = await Promise.all([
    supabase.from("training_locations").select("id, name, address, notes, active").order("name"),
    supabase.from("cohorts").select("id, name, location_id"),
  ]);
  const usedBy = new Map<string, Array<{ id: string; name: string }>>();
  for (const c of cohorts ?? []) {
    if (!c.location_id) continue;
    usedBy.set(c.location_id, [...(usedBy.get(c.location_id) ?? []), { id: c.id, name: c.name }]);
  }
  const rows = (locations ?? []) as Location[];

  return (
    <div>
      <PageHeader
        eyebrow="Scheduling"
        title="Training locations"
        description="Add each training site once. When you set up a cohort, you pick its location from this list. Editing a location updates every cohort there."
      />

      <Card>
        <h2 className="mb-5 text-lg font-black">Add a location</h2>
        <ActionForm action={saveLocation} resetOnSuccess className="grid gap-4 sm:grid-cols-3">
          <LocationFields />
          <div className="sm:col-span-3">
            <SubmitButton variant="dark" pendingText="Adding…">
              Add location
            </SubmitButton>
          </div>
        </ActionForm>
      </Card>

      <div className="mt-6 grid gap-4">
        {rows.length === 0 && <EmptyState title="No training locations yet" />}
        {rows.map((l) => {
          const used = usedBy.get(l.id) ?? [];
          return (
            <Card key={l.id}>
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/20 text-maroon">
                  <MapPin className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-black text-ink">{l.name}</p>
                  <p className="text-sm text-ink/60">{l.address}</p>
                </div>
                <Badge tone={l.active ? "success" : "neutral"}>{l.active ? "Active" : "Inactive"}</Badge>
                <Badge tone="neutral">
                  {used.length} cohort{used.length === 1 ? "" : "s"}
                </Badge>
              </div>
              {used.length > 0 && (
                <p className="mb-4 text-xs text-ink/50">
                  Used by:{" "}
                  {used.map((c, i) => (
                    <span key={c.id}>
                      {i > 0 && ", "}
                      <Link href={`/admin/cohorts/${c.id}`} className="underline hover:text-maroon">
                        {c.name}
                      </Link>
                    </span>
                  ))}
                </p>
              )}
              <details className="group">
                <summary className="cursor-pointer text-sm font-bold text-maroon">Edit location</summary>
                <ActionForm action={saveLocation} className="mt-4 grid gap-4 sm:grid-cols-3">
                  <LocationFields l={l} />
                  <label className="flex items-center gap-2 text-sm font-bold sm:col-span-3">
                    <input type="checkbox" name="active" defaultChecked={l.active} className="h-4 w-4 accent-maroon" />
                    Active (shown in the cohort location dropdown)
                  </label>
                  <div className="sm:col-span-3">
                    <SubmitButton variant="dark" size="sm" pendingText="Saving…">
                      Save changes
                    </SubmitButton>
                  </div>
                </ActionForm>
                <ActionForm
                  action={deleteLocation}
                  className="mt-4 border-t border-ink/10 pt-4"
                  confirm={{
                    title: `Delete "${l.name}"?`,
                    body: used.length
                      ? `${used.length} cohort(s) still use this location, so it can't be deleted yet. Move them first, or mark it inactive.`
                      : "This removes the location from the list. It can't be undone.",
                    confirmLabel: "Delete location",
                    cancelLabel: "Keep location",
                    tone: "danger",
                  }}
                >
                  <input type="hidden" name="id" value={l.id} />
                  <SubmitButton variant="outline" size="sm" pendingText="Deleting…" disabled={used.length > 0}>
                    <Trash2 className="h-4 w-4" aria-hidden /> Delete location
                  </SubmitButton>
                  {used.length > 0 && <p className="mt-2 text-xs text-ink/50">In use by {used.length} cohort(s). Mark it inactive to hide it from new cohorts.</p>}
                </ActionForm>
              </details>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
