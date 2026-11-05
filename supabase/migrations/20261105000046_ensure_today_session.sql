-- Instructors can open today's session for a cohort they teach (if the cohort manager hasn't created sessions yet).
create or replace function public.ensure_today_session(p_cohort uuid)
returns uuid language plpgsql security definer set search_path to 'public'
as $$
declare v_id uuid; v_today date := public.arizona_today(); c public.cohorts;
begin
  if not (public.teaches_cohort(p_cohort) or public.manages_cohort(p_cohort)) then raise exception 'Not allowed' using errcode = '42501'; end if;
  select * into c from public.cohorts where id = p_cohort;
  if v_today < c.start_date or v_today > c.end_date then raise exception 'This cohort isn''t in session today' using errcode = '22023'; end if;
  insert into public.cohort_sessions (cohort_id, session_date) values (p_cohort, v_today)
  on conflict (cohort_id, session_date) do nothing;
  select id into v_id from public.cohort_sessions where cohort_id = p_cohort and session_date = v_today;
  return v_id;
end;
$$;
revoke all on function public.ensure_today_session(uuid) from public, anon;
grant execute on function public.ensure_today_session(uuid) to authenticated;
