import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthForm } from "@/components/auth/AuthForm";
import { safeNext } from "@/lib/utils";

export const metadata: Metadata = { title: "Create your account" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string; email?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next, "/portal");
  // Invitation emails link here with the invited address filled in.
  const email = typeof sp.email === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(sp.email) ? sp.email.slice(0, 254) : undefined;
  return (
    <AuthShell
      title="Create your account"
      subtitle={
        email
          ? "You've been invited to FoundryReady. Create your account with this email and your access is set up automatically."
          : next.startsWith("/portal/apply/")
          ? "One quick step before your application — it takes about 5 minutes."
          : "Apply to programs and track your progress in one place."
      }
    >
      <AuthForm mode="register" next={next} defaultEmail={email} />
    </AuthShell>
  );
}
