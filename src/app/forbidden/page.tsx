import { ButtonLink } from "@/components/ui";
import { getSession } from "@/lib/session";
import { homeFor } from "@/lib/rbac";

export default async function Forbidden() {
  const session = await getSession();
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-950 px-4 text-center text-white">
      <div>
        <p className="text-7xl font-black text-gold">403</p>
        <h1 className="mt-4 text-3xl font-black">You don&apos;t have access to that page</h1>
        <p className="mt-2 text-white/60">If you think this is a mistake, contact your Talent-Vault administrator.</p>
        <ButtonLink href={session ? homeFor(session.roles) : "/"} className="mt-8">
          Take me home
        </ButtonLink>
      </div>
    </main>
  );
}
