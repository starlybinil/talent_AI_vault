import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/session";
import { getFlags } from "@/lib/data";
import { ApplicationForm } from "@/components/portal/ApplicationForm";
import { Alert } from "@/components/ui";

export const metadata = { title: "Apply" };

export default async function ApplyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await requireSession(`/portal/apply/${slug}`);
  const supabase = await createClient();
  const { data: program } = await supabase.from("programs").select("id, slug, name, active").eq("slug", slug).maybeSingle();
  if (!program) notFound();

  const { data: existing } = await supabase
    .from("applications")
    .select("id")
    .eq("program_id", program.id)
    .eq("user_id", session.userId)
    .maybeSingle();
  if (existing) redirect(`/portal/applications/${existing.id}`);

  const flags = await getFlags();
  if (!program.active || flags.applications_open === false) {
    return <Alert tone="warn" title="Applications are closed">This program isn&apos;t accepting applications right now. Please check back soon.</Alert>;
  }

  const { data: profile } = await supabase.from("profiles").select("full_name, phone").eq("id", session.userId).maybeSingle();
  const [first, ...rest] = (profile?.full_name ?? session.fullName ?? "").split(" ");

  return (
    <div className="mx-auto max-w-3xl">
      <ApplicationForm
        programSlug={program.slug}
        programName={program.name}
        userId={session.userId}
        email={session.email}
        defaults={{ first_name: first ?? "", last_name: rest.join(" "), phone: profile?.phone ?? "" }}
      />
    </div>
  );
}
