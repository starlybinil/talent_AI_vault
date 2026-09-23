import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/session";
import { saveSetting } from "@/app/admin/actions";
import { ActionForm, SubmitButton } from "@/components/ui/forms";
import { Badge, Card, Input, Label, PageHeader, Textarea } from "@/components/ui";

export const metadata = { title: "Settings" };

const INTEGRATIONS = [
  ["Supabase", !!process.env.NEXT_PUBLIC_SUPABASE_URL],
  ["Resend (email delivery)", !!process.env.RESEND_API_KEY],
  ["Service role key (reminder cron)", !!process.env.SUPABASE_SERVICE_ROLE_KEY],
  ["Cron secret", !!process.env.CRON_SECRET],
] as const;

export default async function SettingsPage() {
  await requirePermission("settings.manage", "/admin/settings");
  const supabase = await createClient();
  const { data: settings } = await supabase.from("system_settings").select("key, value, updated_at").order("key");
  return (
    <div>
      <PageHeader eyebrow="IT administration" title="Settings & integrations" />
      <Card>
        <h2 className="font-black">Integrations</h2>
        <p className="text-sm text-ink/60">Configured through environment variables on the hosting platform.</p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {INTEGRATIONS.map(([name, ok]) => (
            <li key={name} className="flex items-center justify-between rounded-xl bg-mist px-4 py-3 text-sm font-bold">
              {name}
              <Badge tone={ok ? "success" : "warn"}>{ok ? "Configured" : "Not set"}</Badge>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-ink/60">
          Social sign-in (Google, Facebook, Apple) is enabled in the Supabase dashboard under Authentication → Providers.
        </p>
      </Card>
      <Card className="mt-6">
        <h2 className="font-black">System settings</h2>
        <p className="text-sm text-ink/60">Values are JSON — wrap text in double quotes.</p>
        <div className="mt-4 space-y-4">
          {(settings ?? []).map((s) => (
            <ActionForm key={s.key} action={saveSetting} className="grid gap-2 rounded-2xl border border-ink/10 p-4 sm:grid-cols-[200px_1fr_auto] sm:items-start">
              <input type="hidden" name="key" value={s.key} />
              <p className="pt-3 font-mono text-sm font-bold">{s.key}</p>
              <Textarea name="value" defaultValue={JSON.stringify(s.value)} className="mt-0 min-h-12 font-mono text-xs" aria-label={s.key} />
              <SubmitButton size="sm" variant="dark" className="sm:mt-1">Save</SubmitButton>
            </ActionForm>
          ))}
          <ActionForm action={saveSetting} resetOnSuccess className="grid gap-2 rounded-2xl border border-dashed border-ink/20 p-4 sm:grid-cols-[200px_1fr_auto] sm:items-end">
            <div>
              <Label>New key</Label>
              <Input name="key" placeholder="setting_key" />
            </div>
            <div>
              <Label>Value (JSON)</Label>
              <Input name="value" placeholder='"text" or 123 or {"a":1}' />
            </div>
            <SubmitButton size="sm" variant="dark">Add</SubmitButton>
          </ActionForm>
        </div>
      </Card>
    </div>
  );
}
