-- Cohort calendar data for staff (program + IT admins) and partner employers.
-- Staff see every cohort with waitlist and seat numbers; employers see only cohorts in the
-- programs their organization partners on, without waitlist details.

create or replace function public.cohort_schedule()
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
    coalesce(conf.n, 0)::int,
    case when v_staff then coalesce(e.waitlisted, 0)::int end,
    case when v_staff then greatest(c.capacity - coalesce(e.registered, 0), 0)::int end
  from public.cohorts c
  join public.programs p on p.id = c.program_id
  left join lateral (
    select sum((x.status = 'registered')::int) as registered, sum((x.status = 'waitlisted')::int) as waitlisted
    from public.cohort_enrollments x where x.cohort_id = c.id
  ) e on true
  left join lateral (
    select count(*) as n from public.applications a where a.assigned_cohort_id = c.id and a.status = 'confirmed'
  ) conf on true
  where v_staff
     or (c.status <> 'archived' and exists (
          select 1 from public.program_partners pp
          where pp.program_id = c.program_id and pp.employer_org_id in (select public.my_employer_orgs())))
  order by c.start_date, c.name;
end;
$$;

revoke execute on function public.cohort_schedule() from public, anon;
grant execute on function public.cohort_schedule() to authenticated;
