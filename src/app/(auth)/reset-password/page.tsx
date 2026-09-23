"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AuthShell } from "@/components/auth/AuthShell";
import { Alert, Button, Input, Label } from "@/components/ui";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const password = String(new FormData(e.currentTarget).get("password") || "");
    if (password.length < 8) return setError("Use at least 8 characters.");
    setBusy(true);
    const { error } = await createClient().auth.updateUser({ password });
    setBusy(false);
    if (error) setError(error.message);
    else router.replace("/auth/after");
  }
  return (
    <AuthShell title="Choose a new password">
      <form onSubmit={onSubmit} className="grid gap-4">
        <div>
          <Label htmlFor="password">New password</Label>
          <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
        </div>
        {error && <Alert tone="danger">{error}</Alert>}
        <Button type="submit" size="lg" disabled={busy}>
          Save password
        </Button>
      </form>
    </AuthShell>
  );
}
