import Link from "next/link";
import {
  ArrowRight,
  Briefcase,
  Factory,
  GraduationCap,
  Landmark,
  Layers,
  LineChart,
  ShieldCheck,
} from "lucide-react";
import { LogoMark } from "@/components/brand/Logo";
import { BRAND } from "@/lib/brand";
import { SiteHeader } from "@/components/site/Header";
import { SiteFooter } from "@/components/site/Footer";
import { Announcement } from "@/components/site/Announcement";
import { HeroVideo } from "@/components/brand/HeroVideo";
import { Reveal, Stagger, StaggerItem } from "@/components/brand/motion";
import { ButtonLink } from "@/components/ui";
import { getContent, listPrograms } from "@/lib/data";
import { HERO_CLIPS, IMAGES } from "@/lib/media";
import { pickFeatured, programCopy } from "@/lib/program";

export const revalidate = 60;

type HomeHero = { eyebrow: string; title: string; subtitle: string };

export default async function Home() {
  const [programs, hero] = await Promise.all([
    listPrograms(),
    getContent<HomeHero>("home_hero"),
  ]);
  const featured = pickFeatured(programs);
  // Enrolling programs first, then the ones still coming.
  const catalog = [...programs].sort(
    (a, b) => Number(b.active) - Number(a.active),
  );
  return (
    <div className="bg-ink-950 text-white">
      <Announcement />
      <div className="relative">
        <SiteHeader overlay />
        <section className="relative flex min-h-[92svh] items-center overflow-hidden pb-20 pt-32">
          <HeroVideo
            clips={[...HERO_CLIPS].reverse()}
            poster={IMAGES.fabExterior}
          />
          <div className="relative mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <Reveal>
              <p className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.25em] text-gold">
                <LogoMark className="h-7 w-7" />
                {hero?.eyebrow ??
                  `${BRAND.name} · Advanced manufacturing careers`}
              </p>
              <h1 className="mt-5 max-w-5xl text-5xl font-black leading-[0.95] tracking-[-0.03em] sm:text-7xl lg:text-8xl">
                <HeroTitle text={hero?.title ?? BRAND.tagline} />
              </h1>
              <p className="mt-6 max-w-2xl text-lg text-white/75 sm:text-xl">
                {hero?.subtitle ??
                  "No-cost, hands-on training for semiconductor and advanced manufacturing careers, funded by government and industry and built with the employers who are hiring."}
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <ButtonLink href="#programs" size="lg">
                  Find your program{" "}
                  <ArrowRight className="h-5 w-5" aria-hidden />
                </ButtonLink>
                <ButtonLink
                  href="#how-it-works"
                  variant="outline-light"
                  size="lg"
                >
                  How it works
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
              href={featured.learn_more_url || `/programs/${featured.slug}`}
              {...(featured.learn_more_url ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="group grid overflow-hidden rounded-[2rem] bg-gold text-ink shadow-2xl md:grid-cols-[1.2fr_1fr]"
            >
              <div className="p-8 sm:p-12">
                <p className="text-xs font-black uppercase tracking-[0.25em] text-maroon">
                  Now enrolling ·{" "}
                  {programCopy(featured).partners ?? "Featured program"}
                </p>
                <h2 className="mt-3 text-3xl font-black leading-tight tracking-tight sm:text-5xl">
                  {featured.name}
                </h2>
                <p className="mt-4 max-w-xl text-ink/75">{featured.tagline}</p>
                <div className="mt-6 flex flex-wrap gap-2 text-sm font-bold">
                  {[
                    featured.cost_label,
                    featured.hours_label,
                    featured.duration_label,
                  ]
                    .filter(Boolean)
                    .map((x) => (
                      <span
                        key={x}
                        className="rounded-full bg-ink px-4 py-1.5 text-gold"
                      >
                        {x}
                      </span>
                    ))}
                </div>
                <span className="mt-8 inline-flex items-center gap-2 text-lg font-black">
                  View program{" "}
                  <ArrowRight
                    className="h-5 w-5 transition group-hover:translate-x-1"
                    aria-hidden
                  />
                </span>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={featured.hero_poster || IMAGES.wafer}
                alt={`${featured.short_name} trainee at work`}
                className="h-64 w-full object-cover md:h-full"
              />
            </Link>
          </Reveal>
        </section>
      )}

      <section id="how-it-works" className="scroll-mt-20 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-gold">
              Why {BRAND.name}
            </p>
            <h2 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">
              From first class to first paycheck.
            </h2>
          </Reveal>
          <Stagger className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              [
                ShieldCheck,
                "No-cost training",
                "Funded by government and industry partners, so learners pay nothing.",
              ],
              [
                Layers,
                "Hands-on credentials",
                "Industry-recognized, non-degree credentials earned on real equipment.",
              ],
              [
                LineChart,
                "Live status tracking",
                "See exactly where your application stands, every step of the way.",
              ],
              [
                Briefcase,
                "Employer pathways",
                "Every program is built with a university and a hiring employer, with interviews at the finish line.",
              ],
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

      <section
        id="partners"
        className="scroll-mt-20 border-t border-white/10 bg-ink py-24"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-gold">
              One foundry. Three partners.
            </p>
            <h2 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">
              Where talent is <span className="text-gradient-gold">forged</span>{" "}
              for the jobs of tomorrow.
            </h2>
          </Reveal>
          <Stagger className="mt-12 grid gap-4 lg:grid-cols-3">
            {[
              {
                icon: GraduationCap,
                who: "For learners",
                title: "No degree. No cost. A real career.",
                body: "Short, hands-on programs that take you from beginner to job-ready, with an employer interview waiting at the end.",
                cta: { href: "#programs", label: "Find your program" },
              },
              {
                icon: Factory,
                who: "For employers",
                title: "Hire people who are ready on day one.",
                body: "Shape the curriculum, meet pre-screened graduates, and fill technician roles faster with talent trained on your equipment.",
                cta: {
                  href: `mailto:${BRAND.supportEmail}?subject=Employer%20partnership`,
                  label: "Become a hiring partner",
                },
              },
              {
                icon: Landmark,
                who: "For funders",
                title: "Every dollar tied to outcomes.",
                body: "Government and industry funding backed by transparent enrollment, completion and placement data from application to hire.",
                cta: {
                  href: `mailto:${BRAND.supportEmail}?subject=Funding%20partnership`,
                  label: "Partner with us",
                },
              },
            ].map((a) => (
              <StaggerItem key={a.who}>
                <div className="flex h-full flex-col rounded-3xl bg-gradient-to-br from-white/[0.07] to-white/[0.02] p-7 ring-1 ring-white/10">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gold text-ink">
                    <a.icon className="h-6 w-6" aria-hidden />
                  </span>
                  <p className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-gold">
                    {a.who}
                  </p>
                  <h3 className="mt-2 text-2xl font-black leading-tight">
                    {a.title}
                  </h3>
                  <p className="mt-3 flex-1 text-white/65">{a.body}</p>
                  <a
                    href={a.cta.href}
                    className="mt-6 inline-flex items-center gap-2 font-black text-gold hover:underline"
                  >
                    {a.cta.label} <ArrowRight className="h-4 w-4" aria-hidden />
                  </a>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      <section id="programs" className="scroll-mt-20 bg-white py-24 text-ink">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-maroon">
              Program catalog
            </p>
            <h2 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">
              Pick your <span className="highlight-gold">pathway.</span>
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {catalog.map((p) => {
              const c = programCopy(p);
              return (
                <Reveal key={p.id}>
                  <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-ink/10 transition hover:border-maroon/40 hover:shadow-xl">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.hero_poster || IMAGES.wafer}
                      alt={`${p.short_name} trainee at work`}
                      className={`aspect-[16/9] w-full bg-ink object-cover ${p.active ? "" : "grayscale opacity-60"}`}
                      loading="lazy"
                    />
                    <div className="flex flex-1 flex-col p-8">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-xs font-bold uppercase tracking-widest text-maroon">
                          {c.partners ?? c.industry}
                        </p>
                        <span
                          className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${p.active ? "bg-emerald-50 text-emerald-800" : "bg-ink/5 text-ink/60"}`}
                        >
                          {p.active ? "Enrolling" : "Coming soon"}
                        </span>
                      </div>
                      <h3 className="mt-3 text-2xl font-black leading-tight">
                        {p.name}
                      </h3>
                      <p className="mt-2 flex-1 text-ink/60">{p.tagline}</p>
                      <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold">
                        <span className="rounded-full bg-maroon/10 px-3 py-1 text-maroon">
                          {c.industry}
                        </span>
                        {p.active &&
                          [p.cost_label, p.hours_label]
                            .filter(Boolean)
                            .map((x) => (
                              <span
                                key={x}
                                className="rounded-full bg-ink/5 px-3 py-1 text-ink/70"
                              >
                                {x}
                              </span>
                            ))}
                      </div>
                      {p.active ? (
                        <div className="mt-6 grid grid-cols-2 gap-2">
                          {p.learn_more_url ? (
                            <ButtonLink
                              href={p.learn_more_url}
                              variant="outline"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Learn more
                            </ButtonLink>
                          ) : (
                            <ButtonLink
                              href={`/programs/${p.slug}`}
                              variant="outline"
                            >
                              Learn more
                            </ButtonLink>
                          )}
                          {/* Sign in to the applicant portal, then straight into this program's application. */}
                          <ButtonLink
                            href={`/login?next=${encodeURIComponent(`/portal/apply/${p.slug}`)}`}
                          >
                            Apply <ArrowRight className="h-4 w-4" aria-hidden />
                          </ButtonLink>
                        </div>
                      ) : (
                        <p className="mt-6 text-sm font-bold text-ink/40">
                          Details announced soon
                        </p>
                      )}
                    </div>
                  </div>
                </Reveal>
              );
            })}
            <Reveal>
              <a
                href={`mailto:${BRAND.supportEmail}?subject=New%20program%20partnership`}
                className="group flex h-full flex-col justify-between rounded-3xl border-2 border-dashed border-ink/15 p-8 transition hover:border-maroon"
              >
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-ink/50">
                    Universities &amp; employers
                  </p>
                  <h3 className="mt-3 text-2xl font-black leading-tight">
                    Launch the next program with us.
                  </h3>
                  <p className="mt-2 text-ink/60">
                    Each {BRAND.name} program pairs a training partner with a
                    hiring employer. Bring a role you need filled and we&apos;ll
                    build the pathway together.
                  </p>
                </div>
                <span className="mt-6 inline-flex items-center gap-2 font-black text-maroon">
                  Start a partnership{" "}
                  <ArrowRight
                    className="h-4 w-4 transition group-hover:translate-x-1"
                    aria-hidden
                  />
                </span>
              </a>
            </Reveal>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

/** "Trained today. Ready on day one." → second sentence in gold, on its own line. */
function HeroTitle({ text }: { text: string }) {
  const parts = text.split(/(?<=[.!?])\s+/);
  if (parts.length < 2) return <>{text}</>;
  return (
    <>
      {parts[0]}
      <br />
      <span className="text-gradient-gold">{parts.slice(1).join(" ")}</span>
    </>
  );
}
