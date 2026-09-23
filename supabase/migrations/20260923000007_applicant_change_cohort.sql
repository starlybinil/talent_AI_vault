-- Applicants may leave their current cohort (or waitlists) without withdrawing their application,
-- and pick new cohorts. Their seat goes to the next person on the waitlist.

create or replace function public.transition_allowed(p_from public.application_status, p_to public.application_status)
returns boolean language sql immutable set search_path = public as $$
  select (p_from::text || '>' || p_to::text) = any (array[
      'submitted>screening','submitted>not_selected','screening>screening_passed','screening>not_selected',
      'not_selected>screening','screening_passed>exam_invited','exam_invited>exam_passed','exam_invited>exam_failed',
      'exam_failed>exam_invited','exam_passed>cohort_selection','cohort_selection>cohort_registered',
      'cohort_selection>waitlisted','waitlisted>cohort_registered','waitlisted>cohort_selection',
      'cohort_registered>agreements_pending','cohort_registered>cohort_selection','agreements_pending>cohort_selection',
      'agreements_pending>agreements_submitted','agreements_submitted>agreements_pending','agreements_submitted>confirmed',
      'agreements_submitted>cohort_selection','confirmed>cohort_selection'
    ])
    or (p_to = 'withdrawn' and p_from <> 'withdrawn');
$$;

create or replace function public.applicant_change_cohort(p_app uuid, p_reason text default null)
returns uuid[] language plpgsql security definer set search_path = public as $$
declare
  v_app public.applications;
  v_cohort uuid;
  v_promoted uuid[] := '{}';
begin
  select * into v_app from public.applications where id = p_app and user_id = auth.uid() for update;
  if not found then
    raise exception 'Not your application' using errcode = '42501';
  end if;
  if v_app.status not in ('cohort_registered', 'waitlisted', 'agreements_pending', 'agreements_submitted', 'confirmed') then
    raise exception 'You are not registered or waitlisted in a cohort' using errcode = '22023';
  end if;

  for v_cohort in
    update public.cohort_enrollments set status = 'released'
    where application_id = p_app and status in ('registered', 'waitlisted') returning cohort_id
  loop
    v_promoted := v_promoted || public.promote_waitlist(v_cohort);
  end loop;

  update public.applications set assigned_cohort_id = null, confirmed_at = null where id = p_app;
  delete from public.cohort_preferences where application_id = p_app;
  -- Agreements are re-signed for the new cohort.
  delete from public.agreement_signatures where application_id = p_app;

  perform public._transition(p_app, 'cohort_selection',
    'Left cohort to choose another' || coalesce(': ' || nullif(trim(p_reason), ''), ''), auth.uid());
  return v_promoted;
end;
$$;

revoke execute on function public.applicant_change_cohort(uuid, text) from public, anon;
grant execute on function public.applicant_change_cohort(uuid, text) to authenticated;
