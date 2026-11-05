import { AppHeader } from "@/components/shell/AppHeader";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { CheckInFlow } from "@/components/checkin/CheckInFlow";
import { Card } from "@/components/ui";

export const metadata = { title: "Check in" };

/** Opened by scanning the classroom QR code. Signs the trainee in if needed, then checks them in. */
export default async function CheckInPage({ params, searchParams }: { params: Promise<{ window: string }>; searchParams: Promise<{ c?: string }> }) {
  const { window } = await params;
  const { c } = await searchParams;
  const code = (c ?? "").replace(/[^A-Za-z0-9]/g, "").slice(0, 8);
  const session = await requireSession(`/checkin/${window}${code ? `?c=${code}` : ""}`);
  const supabase = await createClient();
  const { data: open } = await supabase.rpc("trainee_open_checkin");
  const info = open as { window: string; require_location: boolean } | null;
  return (
    <div className="min-h-screen bg-mist">
      <AppHeader session={session} area="portal" />
      <main className="mx-auto max-w-md px-4 py-10">
        <Card>
          <p className="text-xs font-bold uppercase tracking-widest text-maroon">Class check-in</p>
          <h1 className="mt-1 text-2xl font-black">Check in to class</h1>
          <p className="mb-5 text-sm text-ink/60">Signed in as {session.email}</p>
          <CheckInFlow windowId={/^[0-9a-f-]{36}$/i.test(window) ? window : null} code={code} requireLocation={!!info?.require_location} auto={!!code} />
        </Card>
      </main>
    </div>
  );
}
