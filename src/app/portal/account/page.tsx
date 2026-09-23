import Link from "next/link";
import { ArrowLeft, Mail, ShieldAlert, User } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/session";
import { Alert, Card, PageHeader } from "@/components/ui";
import { DeleteAccountForm } from "@/components/portal/DeleteAccountForm";
import { ROLE_LABEL } from "@/lib/rbac";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Account settings" };

export default async function AccountPage() {
  const session = await requireSession("/portal/account");
  const supabase = await createClient();
  const [{ data: profile }, { data: apps }] = await Promise.all([
    supabase.from("profiles").select("created_at").eq("id", session.userId).maybeSingle(),
    supabase.from("applications").select("id, cohort_enrollments(status)").eq("user_id", session.userId),
  ]);
  const hasSeat = (apps ?? []).some((a) =>
    ((a.cohort_enrollments ?? []) as Array<{ status: string }>).some((e) => e.status === "registered" || e.status === "waitlisted"),
  );
  const staff = session.roles.some((r) => r !== "applicant");

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/portal" className="mb-4 inline-flex items-center gap-1.5 text-sm font-bold text-maroon hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden /> My applications
      </Link>
      <PageHeader eyebrow="Applicant portal" title="Account settings" description="Your sign-in details and privacy controls." />

      <Card className="p-6 sm:p-8">
        <h2 className="text-lg font-black text-ink">Your account</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="flex items-start gap-3">
            <User className="mt-0.5 h-5 w-5 text-maroon" aria-hidden />
            <div>
              <dt className="text-xs font-bold uppercase tracking-widest text-ink/50">Name</dt>
              <dd className="font-bold text-ink">{session.fullName || "—"}</dd>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Mail className="mt-0.5 h-5 w-5 text-maroon" aria-hidden />
            <div>
              <dt className="text-xs font-bold uppercase tracking-widest text-ink/50">Email</dt>
              <dd className="break-all font-bold text-ink">{session.email}</dd>
            </div>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-widest text-ink/50">Member since</dt>
            <dd className="font-bold text-ink">{profile?.created_at ? formatDate(profile.created_at) : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-widest text-ink/50">Applications</dt>
            <dd className="font-bold text-ink">{(apps ?? []).length}</dd>
          </div>
        </dl>
      </Card>

      <Card id="delete" className="mt-6 overflow-hidden border-red-200 p-0">
        <div className="flex items-start gap-4 border-b border-red-100 bg-red-50/70 p-6 sm:px-8">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-red-700 shadow-sm">
            <ShieldAlert className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-700">Danger zone</p>
            <h2 className="mt-1 text-lg font-black text-ink">Delete my Talent-Vault account</h2>
            <p className="mt-1 text-sm text-ink/70">
              Permanently erase your account and everything tied to it. This can&apos;t be undone.
            </p>
          </div>
        </div>
        <div className="p-6 sm:p-8">
          {staff ? (
            <Alert tone="warn" title="Managed account">
              Your account has {session.roles.filter((r) => r !== "applicant").map((r) => ROLE_LABEL[r]).join(", ")} access.
              Ask your IT administrator to remove it.
            </Alert>
          ) : (
            <>
              <ul className="mb-6 grid gap-2 text-sm text-ink/75">
                {hasSeat && <li>• Your cohort seat or waitlist spot is released to the next applicant.</li>}
                <li>• Your applications, status history and messages are erased.</li>
                <li>• Your resume, signatures and signed agreements are deleted.</li>
                <li>• Your sign-in is removed. You can register again later with the same email.</li>
              </ul>
              <p className="mb-6 text-sm text-ink/60">
                Only want to stop this program? You can{" "}
                {apps && apps.length > 0 ? (
                  <Link href={`/portal/applications/${apps[0].id}?tab=details#withdraw`} className="font-bold text-maroon hover:underline">
                    withdraw your application
                  </Link>
                ) : (
                  "withdraw your application"
                )}{" "}
                instead and keep your account.
              </p>
              <DeleteAccountForm email={session.email} hasSeat={hasSeat} />
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
