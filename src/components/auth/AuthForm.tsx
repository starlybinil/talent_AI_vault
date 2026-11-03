"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Alert, Button, Input, Label } from "@/components/ui";
import { cn } from "@/lib/utils";

type Mode = "login" | "register";
export function AuthForm({ mode, next, defaultEmail }: { mode: Mode; next: string; defaultEmail?: string }) {
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);
  const [useMagic, setUseMagic] = React.useState(false);
  const [existing, setExisting] = React.useState<string | null>(null);

  const callback = (path = next) =>
    `${window.location.origin}/auth/callback?next=${encodeURIComponent(path)}`;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") || "").trim();
    const password = String(fd.get("password") || "");
    const fullName = String(fd.get("full_name") || "").trim();
    setBusy("email");
    try {
      if (useMagic) {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: callback(), shouldCreateUser: mode === "register", data: fullName ? { full_name: fullName } : undefined },
        });
        if (error) throw error;
        setInfo(`We sent a sign-in link to ${email}. Open it on this device to continue.`);
        return;
      }
      if (mode === "register") {
        if (password.length < 8) throw new Error("Use a password with at least 8 characters.");
        if (password !== String(fd.get("confirm_password") || "")) throw new Error("The passwords don't match. Please re-enter them.");
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: callback(), data: { full_name: fullName } },
        });
        if (error) throw error;
        // Supabase answers a sign-up for an existing email with a user that has no identities and sends no email.
        if (data.user && (data.user.identities?.length ?? 0) === 0) {
          setError("An account with this email already exists. Sign in instead, or use \"Forgot password?\" on the sign-in page.");
          setExisting(email);
          return;
        }
        if (!data.session) {
          setInfo(`Check your inbox — we sent a confirmation link to ${email}. Click it to activate your account and continue your application.`);
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      router.replace(`/auth/after?next=${encodeURIComponent(next)}`);
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(/invalid login credentials/i.test(msg) ? "That email and password don't match. Try again or use a sign-in link." : msg);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <form onSubmit={onSubmit} className="grid gap-4" noValidate={false}>
        {mode === "register" && (
          <div>
            <Label htmlFor="full_name">Full name</Label>
            <Input id="full_name" name="full_name" autoComplete="name" required placeholder="Alex Rivera" />
          </div>
        )}
        <div>
          <Label htmlFor="email">Email address</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required placeholder="you@yahoo.com" defaultValue={defaultEmail} />
        </div>
        {!useMagic && (
          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              {mode === "login" && (
                <Link href="/forgot-password" className="text-sm font-bold text-maroon hover:underline">
                  Forgot password?
                </Link>
              )}
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              required
              minLength={mode === "register" ? 8 : undefined}
              placeholder={mode === "register" ? "At least 8 characters" : "••••••••"}
            />
          </div>
        )}
        {!useMagic && mode === "register" && (
          <div>
            <Label htmlFor="confirm_password">Confirm password</Label>
            <Input id="confirm_password" name="confirm_password" type="password" autoComplete="new-password" required minLength={8} placeholder="Re-enter your password" />
          </div>
        )}
        {error && (
          <Alert tone="danger">
            {error}
            {existing && (
              <Link href={`/login?next=${encodeURIComponent(next)}&email=${encodeURIComponent(existing)}`} className="ml-1 font-bold underline">
                Go to sign in
              </Link>
            )}
          </Alert>
        )}
        {info && <Alert tone="success">{info}</Alert>}
        <Button type="submit" size="lg" disabled={!!busy} className="w-full">
          {busy === "email" && <Loader2 className="h-5 w-5 animate-spin" />}
          {useMagic ? "Email me a sign-in link" : mode === "register" ? "Create my account" : "Sign in"}
        </Button>
        <button
          type="button"
          onClick={() => setUseMagic((v) => !v)}
          className={cn("cursor-pointer text-sm font-bold text-ink/60 hover:text-maroon")}
        >
          {useMagic ? "Use a password instead" : "Prefer no password? Email me a sign-in link"}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-ink/60">
        {mode === "login" ? (
          <>
            New to FoundryReady?{" "}
            <Link href={`/register?next=${encodeURIComponent(next)}`} className="font-bold text-maroon hover:underline">
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link href={`/login?next=${encodeURIComponent(next)}`} className="font-bold text-maroon hover:underline">
              Sign in
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
