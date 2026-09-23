-- Talent-Vault Training Programs: core schema
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('applicant', 'employer', 'program_admin', 'it_admin', 'web_developer');

create type public.application_status as enum (
  'submitted',
  'screening',
  'screening_passed',
  'not_selected',
  'exam_invited',
  'exam_passed',
  'exam_failed',
  'cohort_selection',
  'cohort_registered',
  'waitlisted',
  'agreements_pending',
  'agreements_submitted',
  'confirmed',
  'withdrawn'
);

create type public.education_level as enum (
  'hs_ged', 'some_college', 'certificate', 'associate', 'bachelor', 'master_plus'
);

create type public.visa_need as enum ('now', 'future', 'no');

create type public.enrollment_status as enum ('registered', 'waitlisted', 'released');

-- ---------------------------------------------------------------------------
-- Shared trigger: updated_at
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- People, roles, organizations
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.profiles is 'One row per auth user. Created automatically on sign-up.';

create table public.employer_orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  domain text,
  created_at timestamptz not null default now()
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.app_role not null,
  employer_org_id uuid references public.employer_orgs (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint employer_needs_org check (role <> 'employer' or employer_org_id is not null)
);
create unique index user_roles_unique on public.user_roles (user_id, role, coalesce(employer_org_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index user_roles_user on public.user_roles (user_id);

-- ---------------------------------------------------------------------------
-- Program catalog
-- ---------------------------------------------------------------------------
create table public.programs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  short_name text not null,
  partner_name text,
  tagline text,
  summary text,
  hours_label text,
  cost_label text,
  duration_label text,
  eligibility text,
  topics jsonb not null default '[]'::jsonb,
  formats jsonb not null default '[]'::jsonb,
  faqs jsonb not null default '[]'::jsonb,
  stats jsonb not null default '[]'::jsonb,
  hero_video text,
  hero_poster text,
  default_exam_url text,
  employer_visible_fields text[] not null default array['first_name', 'last_name', 'highest_education', 'major', 'status', 'exam_result', 'cohort'],
  active boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger programs_touch before update on public.programs for each row execute function public.touch_updated_at();

create table public.program_partners (
  program_id uuid not null references public.programs (id) on delete cascade,
  employer_org_id uuid not null references public.employer_orgs (id) on delete cascade,
  primary key (program_id, employer_org_id)
);

create table public.cohorts (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (id) on delete cascade,
  name text not null,
  format text not null,
  start_date date not null,
  end_date date not null,
  schedule text not null,
  location text not null,
  address text,
  capacity integer not null check (capacity >= 0),
  status text not null default 'open' check (status in ('open', 'closed', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index cohorts_program on public.cohorts (program_id, start_date);
create trigger cohorts_touch before update on public.cohorts for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Applications and workflow
-- ---------------------------------------------------------------------------
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (id) on delete restrict,
  user_id uuid not null references public.profiles (id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text not null,
  highest_education public.education_level not null,
  major text,
  resume_path text,
  visa_sponsorship public.visa_need not null,
  will_be_18_by_completion boolean not null,
  share_with_employers boolean not null default false,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  status public.application_status not null default 'submitted',
  exam_url text,
  exam_invited_at timestamptz,
  exam_self_reported_at timestamptz,
  exam_reminders_sent integer not null default 0,
  exam_last_reminded_at timestamptz,
  exam_result text check (exam_result in ('passed', 'failed')),
  exam_result_at timestamptz,
  assigned_cohort_id uuid references public.cohorts (id) on delete set null,
  confirmed_at timestamptz,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (program_id, user_id),
  constraint degree_needs_major check (
    highest_education in ('hs_ged', 'some_college', 'certificate') or coalesce(length(trim(major)), 0) > 0
  )
);
create index applications_status on public.applications (program_id, status);
create index applications_user on public.applications (user_id);
create trigger applications_touch before update on public.applications for each row execute function public.touch_updated_at();

create table public.application_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  from_status public.application_status,
  to_status public.application_status not null,
  actor_id uuid references public.profiles (id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);
comment on table public.application_events is 'Append-only status history. Notes here are visible to the applicant; internal notes live in messages.internal.';
create index application_events_app on public.application_events (application_id, created_at);

create table public.cohort_preferences (
  application_id uuid not null references public.applications (id) on delete cascade,
  cohort_id uuid not null references public.cohorts (id) on delete cascade,
  rank smallint not null check (rank between 1 and 3),
  created_at timestamptz not null default now(),
  primary key (application_id, rank),
  unique (application_id, cohort_id)
);

create table public.cohort_enrollments (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  cohort_id uuid not null references public.cohorts (id) on delete cascade,
  status public.enrollment_status not null,
  waitlist_position integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (application_id, cohort_id)
);
create index cohort_enrollments_cohort on public.cohort_enrollments (cohort_id, status, waitlist_position);
create trigger cohort_enrollments_touch before update on public.cohort_enrollments for each row execute function public.touch_updated_at();

create table public.agreement_templates (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (id) on delete cascade,
  title text not null,
  body text not null,
  version integer not null default 1,
  required boolean not null default true,
  sort integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger agreement_templates_touch before update on public.agreement_templates for each row execute function public.touch_updated_at();

create table public.agreement_signatures (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  template_id uuid not null references public.agreement_templates (id) on delete restrict,
  template_version integer not null,
  typed_name text not null,
  signature_path text not null,
  pdf_path text,
  ip text,
  user_agent text,
  signed_at timestamptz not null default now(),
  unique (application_id, template_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  sender_id uuid references public.profiles (id) on delete set null,
  body text not null check (length(body) between 1 and 5000),
  internal boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index messages_app on public.messages (application_id, created_at);

-- ---------------------------------------------------------------------------
-- Employer collaboration
-- ---------------------------------------------------------------------------
create table public.employer_shortlist (
  application_id uuid not null references public.applications (id) on delete cascade,
  employer_org_id uuid not null references public.employer_orgs (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (application_id, employer_org_id)
);

create table public.employer_notes (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  employer_org_id uuid not null references public.employer_orgs (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  kind text not null default 'note' check (kind in ('note', 'interview_interest', 'exam_result_proposal')),
  body text not null check (length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index employer_notes_app on public.employer_notes (application_id, created_at);

-- ---------------------------------------------------------------------------
-- Operations: email, audit, content, flags, settings
-- ---------------------------------------------------------------------------
create table public.email_log (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references public.applications (id) on delete set null,
  to_email text not null,
  template text not null,
  subject text not null,
  status text not null default 'sent' check (status in ('sent', 'simulated', 'failed')),
  provider_id text,
  error text,
  created_at timestamptz not null default now()
);
create index email_log_app on public.email_log (application_id, created_at);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  ip text,
  created_at timestamptz not null default now()
);
create index audit_log_created on public.audit_log (created_at desc);

create table public.site_content (
  key text primary key,
  value jsonb not null,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.feature_flags (
  key text primary key,
  enabled boolean not null default false,
  description text,
  updated_at timestamptz not null default now()
);

create table public.system_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.cron_runs (
  job text primary key,
  last_run_at timestamptz not null default now(),
  last_result jsonb
);
