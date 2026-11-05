import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/session";
import { Projector } from "@/components/checkin/Projector";
import { isOpen, loadSessionContext } from "@/lib/checkin-data";
import { shortDate } from "@/lib/schedule";

export const metadata = { title: "Check-in" };

export default async function ScreenPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireSession(`/sessions/${id}/screen`);
  const supabase = await createClient();
  const ctx = await loadSessionContext(supabase, id);
  if (!ctx) notFound();
  if (!ctx.window || !isOpen(ctx.window)) redirect(`/sessions/${id}`);
  return <Projector windowId={ctx.window.id} sessionId={id} title={ctx.cohort.name} subtitle={`${shortDate(ctx.session.session_date)} · ${ctx.cohort.location}`} />;
}
