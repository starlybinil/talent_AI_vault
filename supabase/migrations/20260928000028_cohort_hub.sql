-- Cohort hub: instructors per cohort and announcements to everyone in a cohort.

create table if not exists public.cohort_instructors (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.cohorts(id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 120),
  role text not null default 'Instructor',
  email text,
  phone text,
  sort integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists cohort_instructors_cohort on public.cohort_instructors (cohort_id, sort);

create table if not exists public.cohort_announcements (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.cohorts(id) on delete cascade,
  subject text not null check (length(trim(subject)) between 3 and 150),
  body text not null check (length(trim(body)) between 3 and 5000),
  audience text not null default 'trainees' check (audience in ('trainees', 'all_placed')),
  recipients integer not null default 0,
  sent_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists cohort_announcements_cohort on public.cohort_announcements (cohort_id, created_at desc);

-- Is the signed-in applicant placed in (or training with) this cohort?
create or replace function public.in_cohort(p_cohort uuid, p_trainees_only boolean default false)
returns boolean language sql stable security definer set search_path to 'public'
as $$
  select exists (
    select 1 from public.applications a
    where a.user_id = auth.uid() and a.assigned_cohort_id = p_cohort
      and a.status::text = any (case when p_trainees_only then array['confirmed', 'completed', 'hired']
                                     else array['cohort_registered', 'agreements_pending', 'agreements_submitted', 'confirmed', 'completed', 'hired'] end)
  );
$$;
revoke all on function public.in_cohort(uuid, boolean) from public, anon;
grant execute on function public.in_cohort(uuid, boolean) to authenticated;

alter table public.cohort_instructors enable row level security;
drop policy if exists cohort_instructors_read on public.cohort_instructors;
create policy cohort_instructors_read on public.cohort_instructors for select to authenticated
  using (public.can_read_applicants() or public.in_cohort(cohort_id, true));
drop policy if exists cohort_instructors_write on public.cohort_instructors;
create policy cohort_instructors_write on public.cohort_instructors for all to authenticated
  using (public.is_program_admin()) with check (public.is_program_admin());

alter table public.cohort_announcements enable row level security;
drop policy if exists cohort_announcements_read on public.cohort_announcements;
create policy cohort_announcements_read on public.cohort_announcements for select to authenticated
  using (public.can_read_applicants() or public.in_cohort(cohort_id, audience = 'trainees'));
drop policy if exists cohort_announcements_write on public.cohort_announcements;
create policy cohort_announcements_write on public.cohort_announcements for all to authenticated
  using (public.is_program_admin()) with check (public.is_program_admin());
