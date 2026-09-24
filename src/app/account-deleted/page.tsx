import { ArrowRight, CheckCircle2 } from "lucide-react";
import { SiteHeader } from "@/components/site/Header";
import { SiteFooter } from "@/components/site/Footer";
import { ButtonLink } from "@/components/ui";

export const metadata = { title: "Account deleted" };

export default function AccountDeletedPage() {
  return (
    <div className="flex min-h-screen flex-col bg-mist">
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center px-4 py-20">
        <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white text-center shadow-xl">
          <div className="h-1.5 bg-gradient-to-r from-maroon via-gold to-maroon" />
          <div className="p-8 sm:p-10">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gold/20 text-maroon">
              <CheckCircle2 className="h-7 w-7" aria-hidden />
            </span>
            <h1 className="mt-5 text-3xl font-black tracking-tight text-ink">Your account has been deleted</h1>
            <p className="mt-3 text-ink/70">
              We&apos;ve erased your FoundryReady account, applications, messages and uploaded files. Thanks for your interest in our
              programs. You&apos;re welcome back any time.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <ButtonLink href="/">
                Back to FoundryReady <ArrowRight className="h-4 w-4" aria-hidden />
              </ButtonLink>
              <ButtonLink href="/register" variant="outline">
                Create a new account
              </ButtonLink>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
