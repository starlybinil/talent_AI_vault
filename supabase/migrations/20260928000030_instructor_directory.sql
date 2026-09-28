-- Instructors are people, not cohort rows: one directory entry, assigned to any number of cohorts (and so programs).

create table if not exists public.instructors (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 120),
  title text not null default 'Instructor' check (length(title) <= 80),
  email text check (email is null or length(email) <= 200),
  phone text check (phone is null or length(phone) <= 40),
  bio text check (bio is null or length(bio) <= 1000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists instructors_email_key on public.instructors (lower(email)) where email is not null;

-- Move existing per-cohort rows into the directory, then turn cohort_instructors into assignments.
alter table public.cohort_instructors add column if not exists instructor_id uuid references public.instructors(id) on delete cascade;
insert into public.instructors (name, title, email, phone)
select distinct on (coalesce(lower(email), lower(name))) name, role, email, phone
from public.cohort_instructors
order by coalesce(lower(email), lower(name)), created_at;
update public.cohort_instructors ci set instructor_id = i.id
from public.instructors i
where coalesce(lower(i.email), lower(i.name)) = coalesce(lower(ci.email), lower(ci.name));
delete from public.cohort_instructors a using public.cohort_instructors b
where a.cohort_id = b.cohort_id and a.instructor_id = b.instructor_id and a.created_at > b.created_at;

alter table public.cohort_instructors alter column instructor_id set not null;
alter table public.cohort_instructors drop column if exists name, drop column if exists email, drop column if exists phone;
comment on column public.cohort_instructors.role is 'Role in this cohort, e.g. Lead instructor or Lab TA.';
create unique index if not exists cohort_instructors_unique on public.cohort_instructors (cohort_id, instructor_id);
create index if not exists cohort_instructors_instructor on public.cohort_instructors (instructor_id);

alter table public.instructors enable row level security;
drop policy if exists instructors_read on public.instructors;
create policy instructors_read on public.instructors for select to authenticated
  using (
    public.can_read_applicants()
    or exists (select 1 from public.cohort_instructors ci where ci.instructor_id = instructors.id and public.in_cohort(ci.cohort_id, true))
  );
drop policy if exists instructors_write on public.instructors;
create policy instructors_write on public.instructors for all to authenticated
  using (public.is_program_admin()) with check (public.is_program_admin());
