import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthForm } from "@/components/auth/AuthForm";
import { safeNext } from "@/lib/utils";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; email?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next, "/portal");
  return (
    <AuthShell title="Welcome back" subtitle="Sign in to continue your application or manage your program.">
      {sp.error && (
        <p className="mb-6 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          {sp.error === "reset_link"
            ? "That password reset link has expired or was already used. Request a new one below (Forgot password)."
            : sp.error === "link" || sp.error === "callback"
              ? "That sign-in link has expired or was already used. Enter your email to get a new one, or sign in with your password."
              : "We couldn't complete sign-in. Please try again."}
        </p>
      )}
      <AuthForm mode="login" next={next} defaultEmail={sp.email?.slice(0, 200)} />
    </AuthShell>
  );
}
