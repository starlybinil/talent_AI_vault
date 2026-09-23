import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthForm } from "@/components/auth/AuthForm";
import { safeNext } from "@/lib/utils";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next, "/portal");
  return (
    <AuthShell title="Welcome back" subtitle="Sign in to continue your application or manage your program.">
      {sp.error && (
        <p className="mb-6 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          We couldn&apos;t complete sign-in. Please try again.
        </p>
      )}
      <AuthForm mode="login" next={next} />
    </AuthShell>
  );
}
