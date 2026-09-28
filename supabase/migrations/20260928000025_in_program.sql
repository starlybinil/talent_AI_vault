-- "In program" step: trainees see their cohort and program resources, and can leave with reasons.

-- Why a trainee left (structured, for admissions reporting).
alter table public.applications
  add column if not exists leave_reasons text[],
  add column if not exists leave_detail text,
  add column if not exists left_at timestamptz;

-- Program resources: links or files, for a whole program or one cohort. Only visible to trainees of that
-- program (confirmed, completed or hired) and staff.
create table if not exists public.program_resources (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  cohort_id uuid references public.cohorts(id) on delete cascade,
  title text not null check (length(trim(title)) between 2 and 160),
  description text,
  url text check (url is null or url ~ '^https://'),
  file_path text,
  file_name text,
  sort integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (url is not null or file_path is not null)
);
create index if not exists program_resources_program on public.program_resources (program_id, sort, created_at);
alter table public.program_resources enable row level security;

drop policy if exists program_resources_select on public.program_resources;
create policy program_resources_select on public.program_resources for select to authenticated using (
  public.can_read_applicants() or public.has_role('web_developer')
  or exists (
    select 1 from public.applications a
    where a.user_id = (select auth.uid()) and a.program_id = program_resources.program_id
      and a.status::text in ('confirmed', 'completed', 'hired')
      and (program_resources.cohort_id is null or program_resources.cohort_id = a.assigned_cohort_id)
  )
);
drop policy if exists program_resources_write on public.program_resources;
create policy program_resources_write on public.program_resources for all to authenticated
  using (public.is_program_admin()) with check (public.is_program_admin());

-- Private bucket for uploaded resource files; readable only when the matching resource row is visible.
insert into storage.buckets (id, name, public, file_size_limit)
values ('program-resources', 'program-resources', false, 26214400)
on conflict (id) do nothing;

drop policy if exists program_resources_files_read on storage.objects;
create policy program_resources_files_read on storage.objects for select to authenticated using (
  bucket_id = 'program-resources'
  and (public.is_program_admin() or exists (select 1 from public.program_resources r where r.file_path = storage.objects.name))
);
drop policy if exists program_resources_files_write on storage.objects;
create policy program_resources_files_write on storage.objects for insert to authenticated
  with check (bucket_id = 'program-resources' and public.is_program_admin());
drop policy if exists program_resources_files_delete on storage.objects;
create policy program_resources_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'program-resources' and public.is_program_admin());

-- A confirmed trainee leaves the program, telling admissions why. Seat released, waitlist promoted.
create or replace function public.applicant_leave_program(p_app uuid, p_reasons text[], p_detail text default null)
returns uuid[] language plpgsql security definer set search_path to 'public'
as $$
declare
  v_app public.applications;
  v_reasons text[];
  v_cohort uuid;
  v_promoted uuid[] := '{}';
begin
  select * into v_app from public.applications where id = p_app and user_id = auth.uid() for update;
  if not found then
    raise exception 'Not your application' using errcode = '42501';
  end if;
  if v_app.status <> 'confirmed' then
    raise exception 'Only trainees currently in the program can leave it here' using errcode = '22023';
  end if;
  select array_agg(left(trim(r), 200)) into v_reasons from unnest(p_reasons) r where length(trim(r)) > 0;
  if coalesce(array_length(v_reasons, 1), 0) = 0 then
    raise exception 'Tell us at least one reason you''re leaving' using errcode = '22023';
  end if;

  update public.applications
  set leave_reasons = v_reasons, leave_detail = nullif(left(trim(coalesce(p_detail, '')), 1000), ''), left_at = now()
  where id = p_app;
  perform public._transition(p_app, 'withdrawn',
    'Left the program: ' || array_to_string(v_reasons, '; ') || coalesce(' (' || nullif(left(trim(coalesce(p_detail, '')), 300), '') || ')', ''),
    auth.uid());
  for v_cohort in
    update public.cohort_enrollments set status = 'released'
    where application_id = p_app and status in ('registered', 'waitlisted') returning cohort_id
  loop
    v_promoted := v_promoted || public.promote_waitlist(v_cohort);
  end loop;
  -- Keep assigned_cohort_id so admissions can see which cohort they left.
  return v_promoted;
end;
$$;
revoke all on function public.applicant_leave_program(uuid, text[], text) from public, anon;
grant execute on function public.applicant_leave_program(uuid, text[], text) to authenticated;
