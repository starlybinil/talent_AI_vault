import { AuthShell } from "@/components/auth/AuthShell";
import { SubmitButton } from "@/components/ui/forms";
import { confirmLink } from "./actions";

export const metadata = { title: "Continue" };

/** Where the next page should go, read from the link's redirect_to (which may itself be /auth/callback?next=…). */
function nextFrom(redirectTo: string | undefined): string {
  if (!redirectTo) return "";
  try {
    const u = new URL(redirectTo, "https://foundryready.org");
    if (u.pathname === "/auth/callback") return u.searchParams.get("next") ?? "";
    return u.pathname + u.search;
  } catch {
    return "";
  }
}

const COPY: Record<string, { title: string; button: string }> = {
  recovery: { title: "Reset your password", button: "Continue to set a new password" },
  signup: { title: "Confirm your email", button: "Confirm and continue" },
  invite: { title: "Accept your invitation", button: "Continue" },
  email_change: { title: "Confirm your new email", button: "Confirm" },
};

/**
 * Landing page for emailed links. The token is checked only when the person presses the button, so email
 * security scanners (such as Outlook Safe Links) that open links ahead of time can't use it up.
 */
export default async function ConfirmPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const type = sp.type ?? "magiclink";
  const copy = COPY[type] ?? { title: "Sign in to FoundryReady", button: "Sign me in" };
  return (
    <AuthShell title={copy.title} subtitle="Press the button to finish. This link works in any browser and can be used once.">
      <form action={confirmLink} className="grid gap-4">
        <input type="hidden" name="token_hash" value={sp.token_hash ?? ""} />
        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="next" value={nextFrom(sp.redirect_to)} />
        <SubmitButton size="lg" pendingText="Signing you in…">
          {copy.button}
        </SubmitButton>
      </form>
    </AuthShell>
  );
}
