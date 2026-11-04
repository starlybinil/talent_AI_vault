-- Per-student totals for cohort tracking (grade average and attendance counts), computed in the database so a
-- 50-student cohort with ~90 sessions doesn't have to ship thousands of rows. Runs with the caller's RLS.
create or replace function public.tracking_student_stats(p_cohorts uuid[])
returns table (application_id uuid, cohort_id uuid, grade numeric, graded integer, present integer, late integer, absent integer, excused integer)
language sql stable security invoker set search_path to 'public'
as $$
  select a.id, a.assigned_cohort_id,
    (select round(avg(g.score), 1) from public.module_grades g join public.cohort_modules m on m.id = g.module_id
      where g.application_id = a.id and m.cohort_id = a.assigned_cohort_id),
    (select count(*)::int from public.module_grades g join public.cohort_modules m on m.id = g.module_id
      where g.application_id = a.id and m.cohort_id = a.assigned_cohort_id),
    coalesce(att.present, 0), coalesce(att.late, 0), coalesce(att.absent, 0), coalesce(att.excused, 0)
  from public.applications a
  left join lateral (
    select count(*) filter (where sa.status = 'present')::int as present,
           count(*) filter (where sa.status = 'late')::int as late,
           count(*) filter (where sa.status = 'absent')::int as absent,
           count(*) filter (where sa.status = 'excused')::int as excused
    from public.session_attendance sa join public.cohort_sessions s on s.id = sa.session_id
    where sa.application_id = a.id and s.cohort_id = a.assigned_cohort_id and not s.canceled
      and s.session_date <= (now() at time zone 'America/Phoenix')::date
  ) att on true
  where a.assigned_cohort_id = any (p_cohorts) and a.status in ('confirmed', 'completed', 'hired');
$$;
revoke all on function public.tracking_student_stats(uuid[]) from public, anon;
grant execute on function public.tracking_student_stats(uuid[]) to authenticated;
