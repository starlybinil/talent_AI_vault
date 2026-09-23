-- Applicants (and admissions) may withdraw at any stage, including after final confirmation.
-- Withdrawing releases any registered or waitlisted seat and promotes the next person on the waitlist.

create or replace function public.transition_allowed(p_from public.application_status, p_to public.application_status)
returns boolean
language sql
immutable
set search_path = public
as $$
  select (p_from::text || '>' || p_to::text) = any (array[
      'submitted>screening',
      'submitted>not_selected',
      'screening>screening_passed',
      'screening>not_selected',
      'not_selected>screening',
      'screening_passed>exam_invited',
      'exam_invited>exam_passed',
      'exam_invited>exam_failed',
      'exam_failed>exam_invited',
      'exam_passed>cohort_selection',
      'cohort_selection>cohort_registered',
      'cohort_selection>waitlisted',
      'waitlisted>cohort_registered',
      'waitlisted>cohort_selection',
      'cohort_registered>agreements_pending',
      'cohort_registered>cohort_selection',
      'agreements_pending>cohort_selection',
      'agreements_pending>agreements_submitted',
      'agreements_submitted>agreements_pending',
      'agreements_submitted>confirmed'
    ])
    or (p_to = 'withdrawn' and p_from <> 'withdrawn');
$$;

create or replace function public.applicant_withdraw(p_app uuid, p_reason text default null)
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cohort uuid;
  v_promoted uuid[] := '{}';
begin
  if not exists (select 1 from public.applications where id = p_app and user_id = auth.uid()) then
    raise exception 'Not your application' using errcode = '42501';
  end if;
  perform public._transition(
    p_app, 'withdrawn',
    'Withdrawn by applicant' || coalesce(': ' || nullif(trim(p_reason), ''), ''),
    auth.uid()
  );
  for v_cohort in
    update public.cohort_enrollments set status = 'released'
    where application_id = p_app and status in ('registered', 'waitlisted')
    returning cohort_id
  loop
    v_promoted := v_promoted || public.promote_waitlist(v_cohort);
  end loop;
  update public.applications set assigned_cohort_id = null where id = p_app;
  return v_promoted;
end;
$$;

create or replace function public.admin_withdraw(p_app uuid, p_note text default null)
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cohort uuid;
  v_promoted uuid[] := '{}';
begin
  if not public.is_program_admin() then
    raise exception 'Program admin role required' using errcode = '42501';
  end if;
  perform public._transition(p_app, 'withdrawn', coalesce(p_note, 'Withdrawn by admissions'), auth.uid());
  for v_cohort in
    update public.cohort_enrollments set status = 'released'
    where application_id = p_app and status in ('registered', 'waitlisted')
    returning cohort_id
  loop
    v_promoted := v_promoted || public.promote_waitlist(v_cohort);
  end loop;
  update public.applications set assigned_cohort_id = null where id = p_app;
  return v_promoted;
end;
$$;

revoke execute on function public.applicant_withdraw(uuid, text) from public, anon;
revoke execute on function public.admin_withdraw(uuid, text) from public, anon;
grant execute on function public.applicant_withdraw(uuid, text) to authenticated;
grant execute on function public.admin_withdraw(uuid, text) to authenticated;
