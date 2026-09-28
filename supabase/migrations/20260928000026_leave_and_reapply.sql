-- After leaving the program: no current cohort (the cohort they left is kept separately), and applicants
-- who withdrew can apply again (one active application per program; withdrawn ones stay as history).
alter table public.applications add column if not exists left_cohort_id uuid references public.cohorts(id) on delete set null;

update public.applications
set left_cohort_id = assigned_cohort_id, assigned_cohort_id = null
where status = 'withdrawn' and assigned_cohort_id is not null;

alter table public.applications drop constraint if exists applications_program_id_user_id_key;
create unique index if not exists applications_one_active_per_program
  on public.applications (program_id, user_id) where status <> 'withdrawn';

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
  set leave_reasons = v_reasons, leave_detail = nullif(left(trim(coalesce(p_detail, '')), 1000), ''), left_at = now(),
      left_cohort_id = assigned_cohort_id, assigned_cohort_id = null, confirmed_at = null
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
  return v_promoted;
end;
$$;
