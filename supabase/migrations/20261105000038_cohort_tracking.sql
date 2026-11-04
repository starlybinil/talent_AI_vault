-- Cohort tracking: per-cohort modules with one score per student, class sessions with attendance,
-- scoped to cohort managers by program. Program admins can see and edit everything.

-- Which programs each cohort manager covers (they see every cohort in these programs).
create table if not exists public.cohort_manager_programs (
  user_id uuid not null references public.profiles(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, program_id)
);

create or replace function public.manages_program(p_program uuid)
returns boolean language sql stable security definer set search_path to 'public'
as $$
  select public.is_program_admin()
    or (public.has_role('cohort_manager') and exists (
      select 1 from public.cohort_manager_programs m where m.user_id = auth.uid() and m.program_id = p_program));
$$;

create or replace function public.manages_cohort(p_cohort uuid)
returns boolean language sql stable security definer set search_path to 'public'
as $$
  select p_cohort is not null and exists (
    select 1 from public.cohorts c where c.id = p_cohort and public.manages_program(c.program_id));
$$;

revoke all on function public.manages_program(uuid) from public, anon;
revoke all on function public.manages_cohort(uuid) from public, anon;
grant execute on function public.manages_program(uuid) to authenticated;
grant execute on function public.manages_cohort(uuid) to authenticated;

create table if not exists public.cohort_modules (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.cohorts(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  sort integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists cohort_modules_cohort on public.cohort_modules (cohort_id, sort);

create table if not exists public.module_grades (
  module_id uuid not null references public.cohort_modules(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  score numeric(5,2) not null check (score between 0 and 100),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  primary key (module_id, application_id)
);
create index if not exists module_grades_app on public.module_grades (application_id);

create table if not exists public.cohort_sessions (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.cohorts(id) on delete cascade,
  session_date date not null,
  canceled boolean not null default false,
  note text check (note is null or length(note) <= 200),
  created_at timestamptz not null default now(),
  unique (cohort_id, session_date)
);

create table if not exists public.session_attendance (
  session_id uuid not null references public.cohort_sessions(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  status text not null check (status in ('present', 'late', 'absent', 'excused')),
  note text check (note is null or length(note) <= 200),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  primary key (session_id, application_id)
);
create index if not exists session_attendance_app on public.session_attendance (application_id);

-- Row helpers (security definer, so policies don't recurse through RLS).
create or replace function public.module_cohort(p_module uuid) returns uuid
language sql stable security definer set search_path to 'public' as $$ select cohort_id from public.cohort_modules where id = p_module $$;
create or replace function public.session_cohort(p_session uuid) returns uuid
language sql stable security definer set search_path to 'public' as $$ select cohort_id from public.cohort_sessions where id = p_session $$;
create or replace function public.is_my_application(p_app uuid) returns boolean
language sql stable security definer set search_path to 'public' as $$ select exists (select 1 from public.applications where id = p_app and user_id = auth.uid()) $$;
create or replace function public.app_in_cohort(p_app uuid, p_cohort uuid) returns boolean
language sql stable security definer set search_path to 'public' as $$ select exists (select 1 from public.applications where id = p_app and assigned_cohort_id = p_cohort) $$;
revoke all on function public.module_cohort(uuid), public.session_cohort(uuid), public.is_my_application(uuid), public.app_in_cohort(uuid, uuid) from public, anon;
grant execute on function public.module_cohort(uuid), public.session_cohort(uuid), public.is_my_application(uuid), public.app_in_cohort(uuid, uuid) to authenticated;

alter table public.cohort_manager_programs enable row level security;
create policy cmp_read on public.cohort_manager_programs for select to authenticated
  using (user_id = auth.uid() or public.can_read_applicants());
create policy cmp_write on public.cohort_manager_programs for all to authenticated
  using (public.has_role('it_admin') or public.is_program_admin()) with check (public.has_role('it_admin') or public.is_program_admin());

alter table public.cohort_modules enable row level security;
create policy cohort_modules_read on public.cohort_modules for select to authenticated
  using (public.manages_cohort(cohort_id) or public.can_read_applicants() or public.in_cohort(cohort_id, true));
create policy cohort_modules_write on public.cohort_modules for all to authenticated
  using (public.manages_cohort(cohort_id)) with check (public.manages_cohort(cohort_id));

alter table public.cohort_sessions enable row level security;
create policy cohort_sessions_read on public.cohort_sessions for select to authenticated
  using (public.manages_cohort(cohort_id) or public.can_read_applicants() or public.in_cohort(cohort_id, true));
create policy cohort_sessions_write on public.cohort_sessions for all to authenticated
  using (public.manages_cohort(cohort_id)) with check (public.manages_cohort(cohort_id));

alter table public.module_grades enable row level security;
create policy module_grades_read on public.module_grades for select to authenticated
  using (public.manages_cohort(public.module_cohort(module_id)) or public.can_read_applicants() or public.is_my_application(application_id));
create policy module_grades_write on public.module_grades for all to authenticated
  using (public.manages_cohort(public.module_cohort(module_id)))
  with check (public.manages_cohort(public.module_cohort(module_id)) and public.app_in_cohort(application_id, public.module_cohort(module_id)));

alter table public.session_attendance enable row level security;
create policy session_attendance_read on public.session_attendance for select to authenticated
  using (public.manages_cohort(public.session_cohort(session_id)) or public.can_read_applicants() or public.is_my_application(application_id));
create policy session_attendance_write on public.session_attendance for all to authenticated
  using (public.manages_cohort(public.session_cohort(session_id)))
  with check (public.manages_cohort(public.session_cohort(session_id)) and public.app_in_cohort(application_id, public.session_cohort(session_id)));

-- Cohort managers read the trainees of the cohorts they manage (including those who left), the cohorts themselves,
-- their programs, the instructors, and can send cohort announcements.
create policy applications_select_cohort_manager on public.applications for select to authenticated
  using (public.has_role('cohort_manager') and (public.manages_cohort(assigned_cohort_id) or public.manages_cohort(left_cohort_id)));
create policy cohorts_select_cohort_manager on public.cohorts for select to authenticated
  using (public.has_role('cohort_manager') and public.manages_program(program_id));
create policy programs_select_cohort_manager on public.programs for select to authenticated
  using (public.has_role('cohort_manager') and public.manages_program(id));

drop policy if exists cohort_instructors_read on public.cohort_instructors;
create policy cohort_instructors_read on public.cohort_instructors for select to authenticated
  using (public.can_read_applicants() or public.in_cohort(cohort_id, true) or public.manages_cohort(cohort_id));
drop policy if exists instructors_read on public.instructors;
create policy instructors_read on public.instructors for select to authenticated
  using (public.can_read_applicants() or exists (
    select 1 from public.cohort_instructors ci
    where ci.instructor_id = instructors.id and (public.in_cohort(ci.cohort_id, true) or public.manages_cohort(ci.cohort_id))));

drop policy if exists cohort_announcements_read on public.cohort_announcements;
create policy cohort_announcements_read on public.cohort_announcements for select to authenticated
  using (public.can_read_applicants() or public.manages_cohort(cohort_id) or public.in_cohort(cohort_id, audience = 'trainees'));
drop policy if exists cohort_announcements_write on public.cohort_announcements;
create policy cohort_announcements_write on public.cohort_announcements for all to authenticated
  using (public.manages_cohort(cohort_id)) with check (public.manages_cohort(cohort_id));

-- Partner employers: full performance detail (module scores + attendance) for consenting trainees of partnered programs.
create or replace function public.employer_trainee_performance(p_app uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public'
as $$
declare v_cohort uuid; v jsonb;
begin
  select a.assigned_cohort_id into v_cohort
  from public.applications a
  where a.id = p_app and a.share_with_employers and a.status <> 'withdrawn'
    and exists (select 1 from public.program_partners pp
                where pp.program_id = a.program_id and pp.employer_org_id in (select public.my_employer_orgs()));
  if v_cohort is null then return null; end if;
  select jsonb_build_object(
    'modules', coalesce((
      select jsonb_agg(jsonb_build_object('name', m.name, 'score', g.score) order by m.sort, m.created_at)
      from public.cohort_modules m left join public.module_grades g on g.module_id = m.id and g.application_id = p_app
      where m.cohort_id = v_cohort), '[]'::jsonb),
    'attendance', coalesce((
      select jsonb_agg(jsonb_build_object('date', s.session_date, 'status', sa.status) order by s.session_date)
      from public.cohort_sessions s join public.session_attendance sa on sa.session_id = s.id and sa.application_id = p_app
      where s.cohort_id = v_cohort and not s.canceled), '[]'::jsonb)
  ) into v;
  return v;
end;
$$;
revoke all on function public.employer_trainee_performance(uuid) from public, anon;
grant execute on function public.employer_trainee_performance(uuid) to authenticated;
