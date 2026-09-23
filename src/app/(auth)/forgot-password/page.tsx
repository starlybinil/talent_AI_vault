"use client";

import * as React from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AuthShell } from "@/components/auth/AuthShell";
import { Alert, Button, Input, Label } from "@/components/ui";

export default function ForgotPasswordPage() {
  const [sent, setSent] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const email = String(new FormData(e.currentTarget).get("email") || "").trim();
    const { error } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setBusy(false);
    if (error) setError(error.message);
    else setSent(email);
  }
  return (
    <AuthShell title="Reset your password" subtitle="We'll email you a secure link.">
      {sent ? (
        <Alert tone="success" title="Check your inbox">
          If an account exists for {sent}, a reset link is on its way.
        </Alert>
      ) : (
        <form onSubmit={onSubmit} className="grid gap-4">
          <div>
            <Label htmlFor="email">Email address</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          {error && <Alert tone="danger">{error}</Alert>}
          <Button type="submit" size="lg" disabled={busy}>
            Send reset link
          </Button>
        </form>
      )}
      <p className="mt-8 text-center text-sm">
        <Link href="/login" className="font-bold text-maroon hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}
