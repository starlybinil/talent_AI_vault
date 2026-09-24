import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight, BadgeCheck, CheckCircle2, ChevronDown, GraduationCap, Handshake, Sparkles } from "lucide-react";
import { SiteHeader } from "@/components/site/Header";
import { SiteFooter } from "@/components/site/Footer";
import { Announcement } from "@/components/site/Announcement";
import { HeroVideo } from "@/components/brand/HeroVideo";
import { Marquee } from "@/components/brand/Marquee";
import { CountUp, Reveal, Stagger, StaggerItem } from "@/components/brand/motion";
import { TopicIcon } from "@/components/program/TopicIcon";
import { CohortDetails, SeatsBar } from "@/components/program/CohortCard";
import { ButtonLink } from "@/components/ui";
import { getCohortAvailability, getFlags, getProgram } from "@/lib/data";
import { HERO_CLIPS, IMAGES } from "@/lib/media";
import { STAGES } from "@/lib/workflow";
import { programCopy } from "@/lib/program";

const COUNT_WORDS = ["", "One", "Two", "Three", "Four", "Five", "Six"];

/** The leading figure of a label like "$0 to participants" or "192+ hours". */
function lead(label: string | null | undefined) {
  return label?.trim().split(/\s+/)[0] || null;
}

export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const program = await getProgram(slug);
  if (!program) return {};
  return { title: program.short_name, description: program.summary ?? programCopy(program).pitch };
}

export default async function ProgramPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const program = await getProgram(slug);
  if (!program) notFound();
  const [cohorts, flags] = await Promise.all([getCohortAvailability(program.id), getFlags()]);
  const open = cohorts.filter((c) => c.status === "open");
  const applyHref = `/apply/${program.slug}`;
  const accepting = program.active && flags.applications_open !== false;
  const copy = programCopy(program);
  const heroClips = program.hero_video ? [program.hero_video] : HERO_CLIPS;
  const heroPoster = program.hero_poster || IMAGES.wafer;
  const heroStats = [
    lead(program.cost_label) && [lead(program.cost_label), "Tuition"],
    lead(program.hours_label) && [lead(program.hours_label), "Hands-on hours"],
    copy.outcomeBadge ? [copy.outcomeBadge, "Hiring partner*"] : program.duration_label && [program.duration_label, "Duration"],
  ].filter(Boolean) as string[][];
  const marquee = copy.keywords.length ? copy.keywords : program.topics.map((t) => t.title);
  const tools = copy.keywords.slice(0, 4).join(", ");

  return (
    <div className="bg-ink-950 text-white">
      <Announcement />
      <div className="relative">
        <SiteHeader overlay program={program} />

        {/* HERO */}
        <section className="relative flex min-h-[100svh] items-end overflow-hidden pb-16 pt-32 sm:items-center sm:pb-24">
          <HeroVideo clips={heroClips} poster={heroPoster} />
          <div className="grain absolute inset-0" aria-hidden />
          <div className="relative mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <Reveal>
              <p className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-ink-950/50 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.22em] text-gold backdrop-blur">
                <Sparkles className="h-3.5 w-3.5" aria-hidden /> {copy.partners ?? program.short_name}
              </p>
            </Reveal>
            <Reveal delay={0.08}>
              <h1 className="mt-6 max-w-4xl text-[2.7rem] font-black leading-[0.95] tracking-[-0.03em] sm:text-7xl lg:text-8xl">
                {copy.heroHeadline} <span className="highlight-gold-solid">{copy.heroHighlight}</span>
              </h1>
            </Reveal>
            <Reveal delay={0.16}>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/80 sm:text-xl">
                The <strong className="text-white">{program.name}</strong> {copy.pitch.charAt(0).toLowerCase() + copy.pitch.slice(1)}
              </p>
            </Reveal>
            <Reveal delay={0.24}>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                {accepting ? (
                  <ButtonLink href={applyHref} size="lg" className="group">
                    Start my application
                    <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" aria-hidden />
                  </ButtonLink>
                ) : (
                  <span className="inline-flex h-14 items-center rounded-full bg-white/10 px-8 font-bold">Applications are currently closed</span>
                )}
                <ButtonLink href="#cohorts" variant="outline-light" size="lg">
                  See upcoming cohorts
                </ButtonLink>
              </div>
            </Reveal>
            <Reveal delay={0.32}>
              <dl
                className="mt-12 grid max-w-3xl gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 backdrop-blur-md"
                style={{ gridTemplateColumns: `repeat(${Math.max(heroStats.length, 1)}, minmax(0, 1fr))` }}
              >
                {heroStats.map(([v, l]) => (
                  <div key={l} className="bg-ink-950/60 px-4 py-4 sm:px-6">
                    <dt className="text-[11px] font-bold uppercase tracking-widest text-white/60 sm:text-xs">{l}</dt>
                    <dd className="mt-1 text-2xl font-black text-gold sm:text-4xl">{v}</dd>
                  </div>
                ))}
              </dl>
              {copy.outcomeBadge && (
                <p className="mt-3 text-xs text-white/50">
                  *{copy.outcomeTitle}
                  {copy.outcomeDetail ? ` ${copy.outcomeDetail.charAt(0).toLowerCase()}${copy.outcomeDetail.slice(1)}` : "."}
                </p>
              )}
            </Reveal>
          </div>
          <a
            href="#stats"
            className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 text-white/60 hover:text-gold sm:block"
            aria-label="Scroll to learn more"
          >
            <ChevronDown className="h-7 w-7 animate-bounce" />
          </a>
        </section>
      </div>

      {marquee.length > 0 && <Marquee items={marquee} />}

      {/* STATS */}
      <section id="stats" className="relative bg-ink-950 py-20 sm:py-28">
        <div className="grid-lines absolute inset-0 opacity-60" aria-hidden />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <Reveal>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-gold">Why this program</p>
              <h2 className="mt-4 text-4xl font-black leading-[1.02] tracking-tight sm:text-6xl">
                <SplitAccent text={copy.whyHeadline} />
              </h2>
              <p className="mt-6 text-lg text-white/70">{program.summary}</p>
            </Reveal>
            <Stagger className="grid grid-cols-2 gap-4">
              {program.stats.map((s) => (
                <StaggerItem key={s.label}>
                  <div className="group rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-transparent p-6 transition hover:border-gold/50 sm:p-8">
                    <p className="text-5xl font-black tracking-tight text-white sm:text-6xl">
                      <CountUp to={Number(s.value)} prefix={s.prefix} suffix={s.suffix} />
                    </p>
                    <p className="mt-2 text-sm font-bold uppercase tracking-wider text-white/60 group-hover:text-gold">{s.label}</p>
                  </div>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </div>
      </section>

      {/* OUTCOMES split */}
      <section className="bg-white py-20 text-ink sm:py-28">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:items-center lg:px-8">
          <Reveal className="relative">
            <div className="absolute -left-4 -top-4 h-full w-full rounded-[2rem] bg-gold" aria-hidden />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={IMAGES.oscilloscope}
              alt="Technician trainee troubleshooting an electronics board with an oscilloscope"
              className="relative aspect-[4/3] w-full rounded-[2rem] object-cover shadow-2xl"
              loading="lazy"
            />
          </Reveal>
          <Reveal delay={0.1}>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-maroon">What you walk away with</p>
            <h2 className="mt-4 text-4xl font-black leading-tight tracking-tight sm:text-5xl">
              Skills employers <span className="highlight-gold">actually hire for.</span>
            </h2>
            <ul className="mt-8 space-y-5">
              {[
                [BadgeCheck, "Industry-recognized credentials", `Recognized across the ${copy.industry.toLowerCase()} sector — not just at one company.`],
                [Handshake, copy.outcomeTitle, copy.outcomeDetail ?? "Meet the employers who are hiring as you finish the program."],
                [GraduationCap, "Real tools, real labs", `${tools || "Industry-standard equipment"} — hands-on from day one.`],
              ].map(([Icon, title, body]) => {
                const I = Icon as typeof BadgeCheck;
                return (
                  <li key={title as string} className="flex gap-4">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-maroon text-gold">
                      <I className="h-6 w-6" aria-hidden />
                    </span>
                    <div>
                      <p className="text-lg font-black">{title as string}</p>
                      <p className="text-ink/60">{body as string}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Reveal>
        </div>
      </section>

      {program.topics.length > 0 && (
      <section id="curriculum" className="scroll-mt-20 bg-mist py-20 text-ink sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-maroon">Curriculum</p>
            <h2 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">
              {program.hours_label} across <span className="highlight-gold">{program.topics.length} topic areas.</span>
            </h2>
            <p className="mt-4 text-lg text-ink/60">Directly aligned to what a {copy.role} does every day.</p>
          </Reveal>
          <Stagger className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {program.topics.map((t, i) => (
              <StaggerItem key={t.title}>
                <div className="group relative h-full overflow-hidden rounded-3xl border border-ink/10 bg-white p-6 transition duration-300 hover:-translate-y-1 hover:border-maroon hover:shadow-xl">
                  <span className="absolute right-5 top-4 text-5xl font-black text-ink/5 transition group-hover:text-gold/40">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ink text-gold transition group-hover:bg-maroon">
                    <TopicIcon name={t.icon} className="h-6 w-6" />
                  </span>
                  <h3 className="mt-5 text-lg font-black leading-snug">{t.title}</h3>
                  <p className="mt-2 text-sm text-ink/60">{t.desc}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>
      )}

      {program.formats.length > 0 && (
      <section className="relative overflow-hidden bg-maroon py-20 sm:py-28">
        <div className="absolute -right-40 -top-40 h-[32rem] w-[32rem] rounded-full bg-gold/20 blur-3xl" aria-hidden />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-gold">
              {program.formats.length === 1 ? "One way to train" : `${COUNT_WORDS[program.formats.length] ?? program.formats.length} ways to train`}
            </p>
            <h2 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">A format that fits your life.</h2>
          </Reveal>
          <Stagger className="mt-12 grid gap-5 md:grid-cols-3">
            {program.formats.map((f, i) => (
              <StaggerItem key={f.key}>
                <div className={`h-full rounded-3xl p-8 ${i === 0 ? "bg-gold text-ink" : "border border-white/20 bg-white/5 backdrop-blur"}`}>
                  <p className={`text-7xl font-black tracking-tighter ${i === 0 ? "" : "text-gold"}`}>{f.weeks}</p>
                  <p className="text-sm font-bold uppercase tracking-widest opacity-70">weeks</p>
                  <h3 className="mt-6 text-2xl font-black">{f.name}</h3>
                  <p className="mt-1 font-bold opacity-80">{f.cadence}</p>
                  <p className="mt-4 opacity-70">{f.best_for}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>
      )}

      {/* HOW ADMISSIONS WORKS */}
      <section className="bg-ink-950 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-gold">How admissions works</p>
            <h2 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">From application to hired. Full visibility at every step.</h2>
            <p className="mt-4 text-lg text-white/60">Track your status live in your FoundryReady portal, with an email at every milestone.</p>
          </Reveal>
          <Stagger className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STAGES.map((s, i) => (
              <StaggerItem key={s.key}>
                <div className="relative h-full rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gold text-sm font-black text-ink">{i + 1}</span>
                  <h3 className="mt-5 text-lg font-black">{s.label}</h3>
                  <p className="mt-1 text-sm text-white/60">{s.description}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* COHORTS */}
      <section id="cohorts" className="scroll-mt-20 bg-white py-20 text-ink sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-maroon">Upcoming cohorts</p>
              <h2 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">
                Seats are <span className="highlight-gold">limited.</span>
              </h2>
              <p className="mt-4 text-lg text-ink/60">
                Each cohort lists its training location and schedule. After you pass the assessment you&apos;ll rank your top 3.
              </p>
            </div>
            {accepting && (
              <ButtonLink href={applyHref} size="lg">
                Apply now <ArrowRight className="h-5 w-5" aria-hidden />
              </ButtonLink>
            )}
          </Reveal>
          {open.length === 0 ? (
            <p className="mt-10 rounded-2xl bg-mist p-8 text-center text-ink/60">New cohort dates are coming soon.</p>
          ) : (
            <Stagger className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {open.map((c) => (
                <StaggerItem key={c.cohort_id}>
                  <article className="flex h-full flex-col rounded-3xl border border-ink/10 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
                    <p className="text-xs font-bold uppercase tracking-widest text-maroon">{c.format}</p>
                    <h3 className="mt-2 text-xl font-black">{c.name}</h3>
                    <div className="mt-4 flex-1">
                      <CohortDetails c={c} />
                    </div>
                    {flags.show_seat_counts !== false && (
                      <div className="mt-6">
                        <SeatsBar c={c} />
                      </div>
                    )}
                  </article>
                </StaggerItem>
              ))}
            </Stagger>
          )}
        </div>
      </section>

      {/* ELIGIBILITY */}
      <section className="relative overflow-hidden bg-ink-950 py-20 sm:py-28">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={IMAGES.pneumaticsLab} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" loading="lazy" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink-950 via-ink-950/90 to-ink-950/40" aria-hidden />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-gold">Who should apply</p>
            <h2 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">No experience required. Just drive.</h2>
            <ul className="mt-8 space-y-4 text-lg">
              {copy.audiences.map((x) => (
                <li key={x} className="flex items-center gap-3">
                  <CheckCircle2 className="h-6 w-6 shrink-0 text-gold" aria-hidden /> {x}
                </li>
              ))}
            </ul>
            <p className="mt-8 rounded-2xl border border-white/15 bg-white/5 p-5 text-white/80 backdrop-blur">
              <strong className="text-white">Requirements:</strong> {program.eligibility}
            </p>
          </Reveal>
        </div>
      </section>

      {program.faqs.length > 0 && (
      <section id="faq" className="scroll-mt-20 bg-mist py-20 text-ink sm:py-28">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <p className="text-center text-xs font-bold uppercase tracking-[0.25em] text-maroon">FAQ</p>
            <h2 className="mt-4 text-center text-4xl font-black tracking-tight sm:text-5xl">Questions, answered.</h2>
          </Reveal>
          <div className="mt-12 space-y-3">
            {program.faqs.map((f) => (
              <details key={f.q} className="group rounded-2xl border border-ink/10 bg-white p-5 open:shadow-lg">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-black">
                  {f.q}
                  <ChevronDown className="h-5 w-5 shrink-0 text-maroon transition group-open:rotate-180" aria-hidden />
                </summary>
                <p className="mt-3 leading-relaxed text-ink/70">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* FINAL CTA */}
      <section className="relative overflow-hidden py-24 sm:py-32">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={IMAGES.fabExterior} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/70 to-maroon/40" aria-hidden />
        <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <Reveal>
            <h2 className="text-4xl font-black leading-[1] tracking-tight sm:text-7xl">
              Your seat is <span className="highlight-gold-solid">waiting.</span>
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-lg text-white/80">
              The application takes about 5 minutes. Have your resume ready.
            </p>
            {accepting && (
              <ButtonLink href={applyHref} size="lg" className="mt-10">
                Start my application <ArrowRight className="h-5 w-5" aria-hidden />
              </ButtonLink>
            )}
          </Reveal>
        </div>
      </section>

      <SiteFooter />

      {/* Sticky mobile CTA */}
      {accepting && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-ink-950/90 p-3 backdrop-blur sm:hidden">
          <Link href={applyHref} className="flex h-12 items-center justify-center rounded-full bg-gold font-black text-ink">
            Apply now — it&apos;s free
          </Link>
        </div>
      )}
    </div>
  );
}

/** Splits "First sentence. Second sentence." and puts the second in gold. */
function SplitAccent({ text }: { text: string }) {
  const m = text.match(/^(.+?[.!?])\s+(.+)$/);
  if (!m) return <>{text}</>;
  return (
    <>
      {m[1]} <span className="text-gradient-gold animate-shine">{m[2]}</span>
    </>
  );
}
