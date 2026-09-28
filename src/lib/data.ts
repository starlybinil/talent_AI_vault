import "server-only";

import { createPublicClient } from "@/lib/supabase/server";
import { SUPABASE_URL } from "@/lib/env";
import { IMAGES } from "@/lib/media";

export type Topic = { title: string; desc: string; icon: string };
export type Format = { key: string; name: string; cadence: string; weeks: number; best_for: string };
export type Faq = { q: string; a: string };
export type StatItem = { value: string; label: string; prefix?: string; suffix?: string };

export type Program = {
  id: string;
  slug: string;
  name: string;
  short_name: string;
  partner_name: string | null;
  tagline: string | null;
  summary: string | null;
  hours_label: string | null;
  cost_label: string | null;
  duration_label: string | null;
  eligibility: string | null;
  topics: Topic[];
  formats: Format[];
  faqs: Faq[];
  stats: StatItem[];
  default_exam_url: string | null;
  employer_visible_fields: string[];
  active: boolean;
  sort?: number;
  hero_video?: string | null;
  hero_poster?: string | null;
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
  audiences?: string[];
  keywords?: string[];
  featured?: boolean;
  learn_more_url?: string | null;
};

export type CohortAvailability = {
  cohort_id: string;
  program_id: string;
  name: string;
  format: string;
  start_date: string;
  end_date: string;
  schedule: string;
  location: string;
  address: string | null;
  capacity: number;
  status: string;
  registered: number;
  waitlisted: number;
  seats_left: number;
};

export async function getProgram(slug: string): Promise<Program | null> {
  const supabase = createPublicClient();
  const { data } = await supabase.from("programs").select("*").eq("slug", slug).maybeSingle();
  return (data as Program) ?? null;
}

export async function listPrograms(): Promise<Program[]> {
  const supabase = createPublicClient();
  const { data } = await supabase.from("programs").select("*").order("sort");
  return (data as Program[]) ?? [];
}

export async function getCohortAvailability(programId: string): Promise<CohortAvailability[]> {
  const supabase = createPublicClient();
  const { data } = await supabase.rpc("cohort_availability", { p_program: programId });
  return (data as CohortAvailability[]) ?? [];
}

export async function getFlags(): Promise<Record<string, boolean>> {
  const supabase = createPublicClient();
  const { data } = await supabase.from("feature_flags").select("key, enabled");
  return Object.fromEntries((data ?? []).map((f) => [f.key, f.enabled]));
}

export async function getContent<T = Record<string, unknown>>(key: string): Promise<T | null> {
  const supabase = createPublicClient();
  const { data } = await supabase.from("site_content").select("value").eq("key", key).maybeSingle();
  return (data?.value as T) ?? null;
}

export type SiteImage = { src: string; alt: string };

/**
 * Photos for the public site, from the media library (real program photos uploaded by IT / web developers,
 * plus generated fab imagery). Shuffled on each render so pages don't show the same picture every time.
 */
export async function getSiteImages(): Promise<SiteImage[]> {
  const supabase = createPublicClient();
  const { data } = await supabase.from("site_media").select("path, url, alt, source").eq("active", true).order("sort").order("created_at", { ascending: false });
  const rows = (data ?? []) as Array<{ path: string | null; url: string | null; alt: string; source: string }>;
  const toImage = (r: (typeof rows)[number]) => ({
    src: r.path ? `${SUPABASE_URL}/storage/v1/object/public/site-media/${r.path.split("/").map(encodeURIComponent).join("/")}` : (r.url as string),
    alt: r.alt,
  });
  // Real program photos lead; generated imagery fills in.
  const uploads = shuffle(rows.filter((r) => r.source === "upload").map(toImage));
  const generated = shuffle(rows.filter((r) => r.source !== "upload").map(toImage));
  const pool = [...uploads, ...generated];
  return pool.length ? pool : [{ src: IMAGES.wafer, alt: "Trainee holding a silicon wafer in a cleanroom" }];
}

/** Pick the i-th image from a pool, cycling when there are fewer images than slots. */
export function pickImage(pool: SiteImage[], i: number): SiteImage {
  return pool[i % pool.length];
}

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
