import Link from "next/link";
import { ArrowRight, Briefcase, Layers, LineChart, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/site/Header";
import { SiteFooter } from "@/components/site/Footer";
import { Announcement } from "@/components/site/Announcement";
import { HeroVideo } from "@/components/brand/HeroVideo";
import { Reveal, Stagger, StaggerItem } from "@/components/brand/motion";
import { ButtonLink } from "@/components/ui";
import { getContent, listPrograms } from "@/lib/data";
import { HERO_CLIPS, IMAGES } from "@/lib/media";

export const revalidate = 60;

type HomeHero = { eyebrow: string; title: string; subtitle: string };

export default async function Home() {
  const [programs, hero] = await Promise.all([listPrograms(), getContent<HomeHero>("home_hero")]);
  const featured = programs.find((p) => p.slug === "asu-tsmc");
  return (
    <div className="bg-ink-950 text-white">
      <Announcement />
      <div className="relative">
        <SiteHeader overlay />
        <section className="relative flex min-h-[92svh] items-center overflow-hidden pb-20 pt-32">
          <HeroVideo clips={[...HERO_CLIPS].reverse()} poster={IMAGES.fabExterior} />
          <div className="relative mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <Reveal>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-gold">{hero?.eyebrow ?? "Advanced manufacturing careers"}</p>
              <h1 className="mt-5 max-w-4xl text-5xl font-black leading-[0.95] tracking-[-0.03em] sm:text-7xl lg:text-8xl">
                {hero?.title ?? "Unlock the career that builds the future."}
              </h1>
              <p className="mt-6 max-w-2xl text-lg text-white/75 sm:text-xl">
                {hero?.subtitle ??
                  "Talent-Vault connects ambitious people with no-cost, industry-built training programs and the employers who need them."}
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <ButtonLink href="/programs/asu-tsmc" size="lg">
                  Explore the ASU-TSMC program <ArrowRight className="h-5 w-5" aria-hidden />
                </ButtonLink>
                <ButtonLink href="#programs" variant="outline-light" size="lg">
                  All programs
                </ButtonLink>
              </div>
            </Reveal>
          </div>
        </section>
      </div>

      {featured && (
        <section className="relative -mt-16 px-4 sm:px-6 lg:px-8">
          <Reveal className="mx-auto max-w-7xl">
            <Link
              href="/programs/asu-tsmc"
              className="group grid overflow-hidden rounded-[2rem] bg-gold text-ink shadow-2xl md:grid-cols-[1.2fr_1fr]"
            >
              <div className="p-8 sm:p-12">
                <p className="text-xs font-black uppercase tracking-[0.25em] text-maroon">Now enrolling · Featured program</p>
                <h2 className="mt-3 text-3xl font-black leading-tight tracking-tight sm:text-5xl">{featured.name}</h2>
                <p className="mt-4 max-w-xl text-ink/75">{featured.tagline}</p>
                <div className="mt-6 flex flex-wrap gap-2 text-sm font-bold">
                  {[featured.cost_label, featured.hours_label, featured.duration_label].map((x) => (
                    <span key={x} className="rounded-full bg-ink px-4 py-1.5 text-gold">
                      {x}
                    </span>
                  ))}
                </div>
                <span className="mt-8 inline-flex items-center gap-2 text-lg font-black">
                  View program <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" aria-hidden />
                </span>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={IMAGES.wafer} alt="Trainee holding a silicon wafer in a cleanroom" className="h-64 w-full object-cover md:h-full" />
            </Link>
          </Reveal>
        </section>
      )}

      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-gold">Why Talent-Vault</p>
            <h2 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">From application to offer — in one place.</h2>
          </Reveal>
          <Stagger className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              [ShieldCheck, "No-cost training", "Programs funded by industry and university partners."],
              [LineChart, "Live status tracking", "See exactly where your application stands, every step."],
              [Layers, "Hands-on credentials", "Industry-recognized skills on real equipment."],
              [Briefcase, "Employer pathways", "Direct connections to hiring partners like TSMC Arizona."],
            ].map(([Icon, t, d]) => {
              const I = Icon as typeof ShieldCheck;
              return (
                <StaggerItem key={t as string}>
                  <div className="h-full rounded-3xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-gold/60">
                    <I className="h-8 w-8 text-gold" aria-hidden />
                    <h3 className="mt-5 text-xl font-black">{t as string}</h3>
                    <p className="mt-2 text-white/60">{d as string}</p>
                  </div>
                </StaggerItem>
              );
            })}
          </Stagger>
        </div>
      </section>

      <section id="programs" className="scroll-mt-20 bg-white py-24 text-ink">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-maroon">Program catalog</p>
            <h2 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">
              Pick your <span className="highlight-gold">pathway.</span>
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-5 md:grid-cols-2">
            {programs.map((p) => (
              <Reveal key={p.id}>
                <div className="flex h-full flex-col rounded-3xl border border-ink/10 p-8">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-bold uppercase tracking-widest text-maroon">{p.partner_name}</p>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${p.active ? "bg-emerald-50 text-emerald-800" : "bg-ink/5 text-ink/60"}`}
                    >
                      {p.active ? "Enrolling" : "Coming soon"}
                    </span>
                  </div>
                  <h3 className="mt-3 text-2xl font-black">{p.name}</h3>
                  <p className="mt-2 flex-1 text-ink/60">{p.tagline}</p>
                  {p.active ? (
                    <ButtonLink href={`/programs/${p.slug}`} variant="dark" className="mt-6 self-start">
                      Learn more <ArrowRight className="h-4 w-4" aria-hidden />
                    </ButtonLink>
                  ) : (
                    <p className="mt-6 text-sm font-bold text-ink/40">Details announced soon</p>
                  )}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
