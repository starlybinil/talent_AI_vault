-- Per-cohort switch: show this cohort to applicants (public program page + enrollment choices) or not.
-- Staff and partner employers always see every cohort in the schedule.
alter table public.cohorts add column if not exists visible_to_applicants boolean not null default true;
comment on column public.cohorts.visible_to_applicants is 'When false, applicants and visitors cannot see or choose this cohort';

-- Visitors only read visible cohorts directly.
drop policy if exists cohorts_select_public on public.cohorts;
create policy cohorts_select_public on public.cohorts
  for select to anon
  using (status <> 'archived' and visible_to_applicants);

-- Availability (public page, applicant enrollment, admin pages): hidden cohorts are left out unless the caller is
-- staff, or the applicant is already registered/waitlisted/assigned there (so their own cohort never disappears).
create or replace function public.cohort_availability(p_program uuid default null)
returns table(cohort_id uuid, program_id uuid, name text, format text, start_date date, end_date date, schedule text,
  location text, address text, capacity integer, status text, registered integer, waitlisted integer, seats_left integer)
language sql stable security definer set search_path to 'public'
as $$
  select c.id, c.program_id, c.name, c.format, c.start_date, c.end_date, c.schedule, c.location, c.address,
    c.capacity, c.status,
    coalesce(sum((e.status = 'registered')::int), 0)::int as registered,
    coalesce(sum((e.status = 'waitlisted')::int), 0)::int as waitlisted,
    greatest(c.capacity - coalesce(sum((e.status = 'registered')::int), 0), 0)::int as seats_left
  from public.cohorts c
  left join public.cohort_enrollments e on e.cohort_id = c.id
  where (p_program is null or c.program_id = p_program) and c.status <> 'archived'
    and (
      c.visible_to_applicants
      or public.can_read_applicants()
      or exists (select 1 from public.applications a where a.user_id = auth.uid() and a.assigned_cohort_id = c.id)
      or exists (
        select 1 from public.cohort_enrollments me join public.applications a on a.id = me.application_id
        where a.user_id = auth.uid() and me.cohort_id = c.id and me.status in ('registered', 'waitlisted'))
    )
  group by c.id
  order by c.start_date, c.name;
$$;

-- Applicants can't pick a hidden cohort even by crafting a request.
create or replace function public.applicant_submit_cohort_preferences(p_app uuid, p_cohorts uuid[])
returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare
  v_app public.applications;
  v_result jsonb;
  i integer;
begin
  select * into v_app from public.applications where id = p_app and user_id = auth.uid() for update;
  if not found then
    raise exception 'Not your application' using errcode = '42501';
  end if;
  if v_app.status <> 'cohort_selection' then
    raise exception 'Cohort selection is not open for this application' using errcode = '22023';
  end if;
  if array_length(p_cohorts, 1) is null or array_length(p_cohorts, 1) > 3 then
    raise exception 'Choose between 1 and 3 cohorts' using errcode = '22023';
  end if;
  if (select count(distinct x) from unnest(p_cohorts) x) <> array_length(p_cohorts, 1) then
    raise exception 'Each choice must be a different cohort' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(p_cohorts) x
    where not exists (
      select 1 from public.cohorts c
      where c.id = x and c.program_id = v_app.program_id and c.status = 'open' and c.visible_to_applicants)
  ) then
    raise exception 'One or more cohorts are not available' using errcode = '22023';
  end if;

  delete from public.cohort_preferences where application_id = p_app;
  for i in 1 .. array_length(p_cohorts, 1) loop
    insert into public.cohort_preferences (application_id, cohort_id, rank) values (p_app, p_cohorts[i], i);
  end loop;

  v_result := public.register_for_cohort(p_app);

  if v_result ->> 'result' = 'registered' then
    perform public._transition(p_app, 'cohort_registered',
      'Registered in your choice #' || (v_result ->> 'rank'), auth.uid());
    perform public._transition(p_app, 'agreements_pending', 'Program agreements are ready to sign', null);
    perform public._advance_if_signed(p_app);
  else
    perform public._transition(p_app, 'waitlisted', 'All selected cohorts are full — you are on the waitlist. You can sign your agreements now.', auth.uid());
  end if;

  return v_result;
end;
$$;

-- Schedule (admin / IT / employer calendar) also reports visibility so staff can see what applicants can't.
drop function if exists public.cohort_schedule();
create function public.cohort_schedule()
returns table(cohort_id uuid, program_id uuid, program_name text, name text, format text, start_date date, end_date date,
  schedule text, location_id uuid, location text, address text, capacity integer, status text, registered integer,
  confirmed integer, completed integer, hired integer, waitlisted integer, seats_left integer, visible_to_applicants boolean)
language plpgsql stable security definer set search_path to 'public'
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
    case when v_staff then greatest(c.capacity - coalesce(e.registered, 0), 0)::int end,
    c.visible_to_applicants
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
revoke all on function public.cohort_schedule() from public, anon;
grant execute on function public.cohort_schedule() to authenticated, service_role;
