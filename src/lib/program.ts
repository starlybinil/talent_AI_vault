/**
 * Program copy with generic fallbacks. Every partnership (ASU-TSMC, ASU-Amkor, ASU-Intel, …) is a row in
 * `programs`; pages read their partner names and headlines from here instead of hard-coding one partnership.
 */
export type ProgramCopyInput = {
  name: string;
  short_name?: string | null;
  partner_name?: string | null;
  academic_partner?: string | null;
  employer_partner?: string | null;
  industry?: string | null;
  career_role?: string | null;
  hero_headline?: string | null;
  hero_highlight?: string | null;
  why_headline?: string | null;
  outcome_badge?: string | null;
  outcome_title?: string | null;
  outcome_detail?: string | null;
  audiences?: string[] | null;
  keywords?: string[] | null;
};

const DEFAULT_AUDIENCES = [
  "Recent high school graduates",
  "Community college students",
  "Career changers and working adults",
  "Veterans and anyone ready to build a technical career",
];

export function programCopy(p: ProgramCopyInput) {
  const employer = p.employer_partner?.trim() || null;
  const academic = p.academic_partner?.trim() || null;
  const partners = p.partner_name?.trim() || [academic, employer].filter(Boolean).join(" × ") || null;
  const role = p.career_role?.trim() || "technician";
  const industry = p.industry?.trim() || "Advanced manufacturing";
  const outcomeTitle = p.outcome_title?.trim() || (employer ? `An interview pathway with ${employer}` : "A direct pathway to hiring employers");
  return {
    employer,
    academic,
    partners,
    industry,
    role,
    /** "the employer partner" when a program has none named yet. */
    employerOrGeneric: employer ?? "the employer partner",
    heroHeadline: p.hero_headline?.trim() || "Train for the career",
    heroHighlight: p.hero_highlight?.trim() || "that builds the future.",
    whyHeadline: p.why_headline?.trim() || `${industry} employers are hiring. Get trained, get ready, get hired.`,
    outcomeBadge: p.outcome_badge?.trim() || null,
    outcomeTitle,
    outcomeDetail: p.outcome_detail?.trim() || null,
    audiences: p.audiences?.length ? p.audiences : DEFAULT_AUDIENCES,
    keywords: p.keywords ?? [],
    /** One sentence for hero and meta copy. */
    pitch: `Trains you for ${role} roles in weeks, not years. Hands-on. No cost.${employer ? ` Built with ${employer}.` : ""}`,
  };
}

/** Pick the home page's featured program: the one flagged featured, else the first active one. */
export function pickFeatured<T extends { featured?: boolean; active: boolean }>(programs: T[]): T | undefined {
  return programs.find((p) => p.featured && p.active) ?? programs.find((p) => p.active);
}
