import "server-only";

import { createPublicClient } from "@/lib/supabase/server";

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
