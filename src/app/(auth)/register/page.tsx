import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthForm } from "@/components/auth/AuthForm";
import { safeNext } from "@/lib/utils";

export const metadata: Metadata = { title: "Create your account" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next, "/portal");
  return (
    <AuthShell
      title="Create your account"
      subtitle={
        next.startsWith("/portal/apply/")
          ? "One quick step before your application — it takes about 5 minutes."
          : "Apply to programs and track your progress in one place."
      }
    >
      <AuthForm mode="register" next={next} />
    </AuthShell>
  );
}
