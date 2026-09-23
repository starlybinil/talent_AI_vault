import { Logo } from "@/components/brand/Logo";
import { IMAGES } from "@/lib/media";

export function AuthShell({ children, title, subtitle }: { children: React.ReactNode; title: string; subtitle?: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-ink-950 lg:block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={IMAGES.wafer} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/40 to-maroon/30" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Logo dark />
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-gold">ASU × TSMC Arizona</p>
            <p className="mt-4 max-w-md text-4xl font-black leading-[1.05] tracking-tight text-white">
              Your fab career <span className="whitespace-nowrap">starts <span className="accent-gold">here.</span></span>
            </p>
            <p className="mt-4 max-w-md text-white/70">$0 tuition · 192+ hands-on hours · a guaranteed TSMC Arizona interview upon successful completion.</p>
          </div>
        </div>
      </aside>
      <main className="flex items-center justify-center bg-white px-4 py-12 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-ink">{title}</h1>
          {subtitle && <div className="mt-2 text-ink/60">{subtitle}</div>}
          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  );
}
