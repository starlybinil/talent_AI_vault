-- Practice Lab: applicants can practise typing speed and attention to detail as often as they like.
-- Results are private to the applicant (not shared with admissions, employers or TSMC).

create table public.practice_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  activity text not null check (activity in ('typing', 'attention')),
  -- typing: net words per minute; attention: % correct
  score numeric(6, 2) not null check (score >= 0 and score <= 300),
  accuracy numeric(5, 2) not null check (accuracy >= 0 and accuracy <= 100),
  duration_seconds integer not null check (duration_seconds > 0 and duration_seconds <= 3600),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index practice_attempts_user on public.practice_attempts (user_id, activity, created_at desc);

alter table public.practice_attempts enable row level security;
create policy practice_attempts_select on public.practice_attempts for select to authenticated
  using (user_id = (select auth.uid()));
create policy practice_attempts_insert on public.practice_attempts for insert to authenticated
  with check (user_id = (select auth.uid()));
