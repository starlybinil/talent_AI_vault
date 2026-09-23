import { ButtonLink } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-950 px-4 text-center text-white">
      <div>
        <p className="text-7xl font-black text-gold">404</p>
        <h1 className="mt-4 text-3xl font-black">This page isn&apos;t in the vault</h1>
        <ButtonLink href="/" className="mt-8">Back to home</ButtonLink>
      </div>
    </main>
  );
}
