import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/session";
import { toggleFlag } from "@/app/admin/actions";
import { ActionForm, SubmitButton } from "@/components/ui/forms";
import { Badge, Card, PageHeader } from "@/components/ui";

export const metadata = { title: "Feature flags" };

export default async function FlagsPage() {
  await requirePermission("flags.manage", "/admin/flags");
  const supabase = await createClient();
  const { data: flags } = await supabase.from("feature_flags").select("*").order("key");
  return (
    <div>
      <PageHeader eyebrow="Web" title="Feature flags" description="Turn site features on or off without a deploy." />
      <div className="grid gap-4 md:grid-cols-2">
        {(flags ?? []).map((f) => (
          <Card key={f.key} className="flex items-center justify-between gap-4">
            <div>
              <p className="font-mono text-sm font-bold">{f.key}</p>
              <p className="text-sm text-ink/60">{f.description}</p>
              <Badge tone={f.enabled ? "success" : "neutral"} className="mt-2">
                {f.enabled ? "On" : "Off"}
              </Badge>
            </div>
            <ActionForm action={toggleFlag}>
              <input type="hidden" name="key" value={f.key} />
              <input type="hidden" name="enabled" value={f.enabled ? "0" : "1"} />
              <SubmitButton size="sm" variant={f.enabled ? "outline" : "dark"}>
                {f.enabled ? "Turn off" : "Turn on"}
              </SubmitButton>
            </ActionForm>
          </Card>
        ))}
      </div>
    </div>
  );
}
