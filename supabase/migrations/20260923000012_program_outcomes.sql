-- Program completion and hiring, recorded by program admins; visible to the applicant and partner employers.

alter table public.applications
  add column completed_on date,
  add column completion_note text,
  add column hired_employer_org_id uuid references public.employer_orgs (id) on delete set null,
  add column hired_employer_name text,
  add column hired_job_title text,
  add column hired_start_date date;

create or replace function public.transition_allowed(p_from public.application_status, p_to public.application_status)
returns boolean language sql immutable set search_path = public as $$
  select (p_from::text || '>' || p_to::text) = any (array[
      'submitted>screening','submitted>not_selected','screening>screening_passed','screening>not_selected',
      'not_selected>screening','screening_passed>exam_invited','exam_invited>exam_passed','exam_invited>exam_failed',
      'exam_failed>exam_invited','exam_passed>cohort_selection','cohort_selection>cohort_registered',
      'cohort_selection>waitlisted','waitlisted>cohort_registered','waitlisted>cohort_selection',
      'cohort_registered>agreements_pending','cohort_registered>cohort_selection','agreements_pending>cohort_selection',
      'agreements_pending>agreements_submitted','agreements_submitted>agreements_pending','agreements_submitted>confirmed',
      'agreements_submitted>cohort_selection','confirmed>cohort_selection',
      'confirmed>completed','completed>hired','completed>confirmed','hired>completed'
    ])
    -- Graduates and hires have finished the program, so there's nothing left to withdraw from.
    or (p_to = 'withdrawn' and p_from::text not in ('withdrawn', 'completed', 'hired'));
$$;

-- Completion and hiring carry details, so they go through their own actions.
create or replace function public.admin_transition(p_app uuid, p_to public.application_status, p_note text default null)
returns public.applications
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_program_admin() then
    raise exception 'Program admin role required' using errcode = '42501';
  end if;
  if p_to::text in ('exam_invited', 'exam_passed', 'exam_failed', 'cohort_registered', 'waitlisted', 'agreements_submitted', 'completed', 'hired') then
    raise exception 'Use the dedicated action for %', p_to using errcode = '22023';
  end if;
  return public._transition(p_app, p_to, p_note, auth.uid());
end;
$$;

-- Record (or correct) successful completion of the program.
create or replace function public.admin_record_completion(p_app uuid, p_completed_on date, p_note text default null)
returns public.applications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app public.applications;
begin
  if not public.is_program_admin() then
    raise exception 'Program admin role required' using errcode = '42501';
  end if;
  select * into v_app from public.applications where id = p_app for update;
  if not found then
    raise exception 'Application not found' using errcode = 'P0002';
  end if;
  if v_app.status::text not in ('confirmed', 'completed', 'hired') then
    raise exception 'Only confirmed trainees can complete the program' using errcode = '22023';
  end if;
  if p_completed_on is null then
    raise exception 'Completion date is required' using errcode = '22023';
  end if;

  update public.applications
  set completed_on = p_completed_on, completion_note = nullif(trim(p_note), '')
  where id = p_app;
  if v_app.status = 'confirmed' then
    v_app := public._transition(p_app, 'completed', 'Program completed successfully', auth.uid());
  else
    insert into public.application_events (application_id, from_status, to_status, actor_id, note)
    values (p_app, v_app.status, v_app.status, auth.uid(), 'Completion details updated');
    select * into v_app from public.applications where id = p_app;
  end if;
  return v_app;
end;
$$;

-- Record (or correct) the hire: an employer partner org and/or a free-text employer name.
create or replace function public.admin_record_hire(
  p_app uuid,
  p_org uuid,
  p_employer_name text,
  p_job_title text,
  p_start_date date,
  p_note text default null
)
returns public.applications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app public.applications;
  v_name text := nullif(trim(p_employer_name), '');
begin
  if not public.is_program_admin() then
    raise exception 'Program admin role required' using errcode = '42501';
  end if;
  select * into v_app from public.applications where id = p_app for update;
  if not found then
    raise exception 'Application not found' using errcode = 'P0002';
  end if;
  if v_app.status::text not in ('completed', 'hired') then
    raise exception 'Record program completion before recording a hire' using errcode = '22023';
  end if;
  if p_org is not null then
    select name into v_name from public.employer_orgs where id = p_org;
    if v_name is null then
      raise exception 'Employer not found' using errcode = 'P0002';
    end if;
  end if;
  if v_name is null then
    raise exception 'Choose or enter the hiring employer' using errcode = '22023';
  end if;

  update public.applications
  set hired_employer_org_id = p_org,
      hired_employer_name = v_name,
      hired_job_title = nullif(trim(p_job_title), ''),
      hired_start_date = p_start_date
  where id = p_app;
  if v_app.status = 'completed' then
    v_app := public._transition(p_app, 'hired',
      'Hired by ' || v_name || coalesce(' as ' || nullif(trim(p_job_title), ''), '') || coalesce(' · ' || nullif(trim(p_note), ''), ''),
      auth.uid());
  else
    insert into public.application_events (application_id, from_status, to_status, actor_id, note)
    values (p_app, v_app.status, v_app.status, auth.uid(), 'Hire details updated');
    select * into v_app from public.applications where id = p_app;
  end if;
  return v_app;
end;
$$;

-- Undo the latest outcome if it was recorded by mistake (hired -> completed -> confirmed).
create or replace function public.admin_undo_outcome(p_app uuid, p_note text default null)
returns public.applications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app public.applications;
begin
  if not public.is_program_admin() then
    raise exception 'Program admin role required' using errcode = '42501';
  end if;
  select * into v_app from public.applications where id = p_app for update;
  if not found then
    raise exception 'Application not found' using errcode = 'P0002';
  end if;
  if v_app.status = 'hired' then
    update public.applications
    set hired_employer_org_id = null, hired_employer_name = null, hired_job_title = null, hired_start_date = null
    where id = p_app;
    return public._transition(p_app, 'completed', coalesce(nullif(trim(p_note), ''), 'Hire record removed'), auth.uid());
  elsif v_app.status = 'completed' then
    update public.applications set completed_on = null, completion_note = null where id = p_app;
    return public._transition(p_app, 'confirmed', coalesce(nullif(trim(p_note), ''), 'Completion record removed'), auth.uid());
  end if;
  raise exception 'There is no completion or hire to undo' using errcode = '22023';
end;
$$;

revoke execute on function public.admin_record_completion(uuid, date, text) from public, anon;
revoke execute on function public.admin_record_hire(uuid, uuid, text, text, date, text) from public, anon;
revoke execute on function public.admin_undo_outcome(uuid, text) from public, anon;
grant execute on function public.admin_record_completion(uuid, date, text) to authenticated;
grant execute on function public.admin_record_hire(uuid, uuid, text, text, date, text) to authenticated;
grant execute on function public.admin_undo_outcome(uuid, text) to authenticated;

-- Partner employers always see a consenting candidate's program outcome, whatever the field policy.
create or replace function public.employer_list_candidates(p_program uuid default null)
returns table (
  application_id uuid,
  program_id uuid,
  program_name text,
  fields jsonb,
  shortlisted boolean,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    a.id,
    a.program_id,
    p.short_name,
    (
      select coalesce(jsonb_object_agg(k.key, k.value), '{}'::jsonb)
      from jsonb_each(jsonb_build_object(
        'first_name', a.first_name,
        'last_name', a.last_name,
        'email', a.email,
        'phone', a.phone,
        'highest_education', a.highest_education,
        'major', a.major,
        'visa_sponsorship', a.visa_sponsorship,
        'will_be_18_by_completion', a.will_be_18_by_completion,
        'status', a.status,
        'exam_result', a.exam_result,
        'cohort', (select c.name || ' · ' || to_char(c.start_date, 'Mon DD, YYYY') from public.cohorts c where c.id = a.assigned_cohort_id),
        'resume', (a.resume_path is not null),
        'submitted_at', a.submitted_at
      )) k
      where k.key = any (p.employer_visible_fields)
    ) || jsonb_strip_nulls(jsonb_build_object(
      'completed_on', a.completed_on,
      'completion_note', a.completion_note,
      'hired_employer', a.hired_employer_name,
      'hired_job_title', a.hired_job_title,
      'hired_start_date', a.hired_start_date,
      'hired_by_you', case when a.hired_employer_org_id is not null
                           then a.hired_employer_org_id in (select public.my_employer_orgs()) end
    )),
    exists (
      select 1 from public.employer_shortlist s
      where s.application_id = a.id and s.employer_org_id in (select public.my_employer_orgs())
    ),
    a.updated_at
  from public.applications a
  join public.programs p on p.id = a.program_id
  where (p_program is null or a.program_id = p_program)
    and a.share_with_employers
    and a.status <> 'withdrawn'
    and exists (
      select 1 from public.program_partners pp
      where pp.program_id = a.program_id and pp.employer_org_id in (select public.my_employer_orgs())
    )
  order by a.updated_at desc;
$$;

-- Cohort calendar: count graduates and hires, and treat them as confirmed trainees.
drop function if exists public.cohort_schedule();
create function public.cohort_schedule()
returns table (
  cohort_id uuid,
  program_id uuid,
  program_name text,
  name text,
  format text,
  start_date date,
  end_date date,
  schedule text,
  location_id uuid,
  location text,
  address text,
  capacity integer,
  status text,
  registered integer,
  confirmed integer,
  completed integer,
  hired integer,
  waitlisted integer,
  seats_left integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_staff boolean := public.can_read_applicants();
begin
  if not v_staff and not exists (select public.my_employer_orgs()) then
    raise exception 'Not permitted' using errcode = '42501';
  end if;

  return query
  select
    c.id, c.program_id, p.short_name, c.name, c.format, c.start_date, c.end_date, c.schedule,
    c.location_id, c.location, c.address, c.capacity, c.status,
    coalesce(e.registered, 0)::int,
    coalesce(o.confirmed, 0)::int,
    coalesce(o.completed, 0)::int,
    coalesce(o.hired, 0)::int,
    case when v_staff then coalesce(e.waitlisted, 0)::int end,
    case when v_staff then greatest(c.capacity - coalesce(e.registered, 0), 0)::int end
  from public.cohorts c
  join public.programs p on p.id = c.program_id
  left join lateral (
    select sum((x.status = 'registered')::int) as registered, sum((x.status = 'waitlisted')::int) as waitlisted
    from public.cohort_enrollments x where x.cohort_id = c.id
  ) e on true
  left join lateral (
    select
      count(*) filter (where a.status::text in ('confirmed', 'completed', 'hired')) as confirmed,
      count(*) filter (where a.status::text in ('completed', 'hired')) as completed,
      count(*) filter (where a.status::text = 'hired') as hired
    from public.applications a where a.assigned_cohort_id = c.id
  ) o on true
  where v_staff
     or (c.status <> 'archived' and exists (
          select 1 from public.program_partners pp
          where pp.program_id = c.program_id and pp.employer_org_id in (select public.my_employer_orgs())))
  order by c.start_date, c.name;
end;
$$;

revoke execute on function public.cohort_schedule() from public, anon;
grant execute on function public.cohort_schedule() to authenticated;
