-- Admissions flow refinements:
--  1. New applications go straight into screening (the applicant still gets "application received").
--  2. Recording a passed assessment stops at exam_passed; admissions then accepts the applicant into the
--     program, which opens enrollment (exam_passed -> cohort_selection via admin_transition).
--  3. Admissions places an applicant in any cohort from their own choice list (also after they've signed).
--  4. Admissions can reset an application to the start (screening).

-- 1 ---------------------------------------------------------------------------------------------------
create or replace function public.submit_application(p jsonb)
returns uuid language plpgsql security definer set search_path to 'public'
as $$
declare
  v_id uuid;
  v_program uuid;
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  select id into v_program from public.programs where slug = p ->> 'program_slug' and active;
  if v_program is null then
    raise exception 'Program not found or closed' using errcode = 'P0002';
  end if;
  select email into v_email from public.profiles where id = auth.uid();
  insert into public.applications (
    program_id, user_id, first_name, last_name, email, phone, highest_education, major, resume_path, visa_sponsorship,
    will_be_18_by_completion, share_with_employers, utm_source, utm_medium, utm_campaign, status
  ) values (
    v_program, auth.uid(), trim(p ->> 'first_name'), trim(p ->> 'last_name'),
    coalesce(nullif(trim(p ->> 'email'), ''), v_email), trim(p ->> 'phone'),
    (p ->> 'highest_education')::public.education_level, nullif(trim(p ->> 'major'), ''), nullif(p ->> 'resume_path', ''),
    (p ->> 'visa_sponsorship')::public.visa_need, (p ->> 'will_be_18_by_completion')::boolean,
    coalesce((p ->> 'share_with_employers')::boolean, false),
    nullif(p ->> 'utm_source', ''), nullif(p ->> 'utm_medium', ''), nullif(p ->> 'utm_campaign', ''),
    'screening'
  ) returning id into v_id;
  if (p ->> 'resume_path') is not null and split_part(p ->> 'resume_path', '/', 1) <> auth.uid()::text then
    raise exception 'Invalid resume path' using errcode = '42501';
  end if;
  update public.profiles
  set full_name = coalesce(full_name, trim(p ->> 'first_name') || ' ' || trim(p ->> 'last_name')),
      phone = coalesce(phone, trim(p ->> 'phone'))
  where id = auth.uid();
  insert into public.application_events (application_id, from_status, to_status, actor_id, note)
  values (v_id, null, 'submitted', auth.uid(), 'Application submitted'),
         (v_id, 'submitted', 'screening', null, 'Admissions is reviewing your application');
  return v_id;
end;
$$;

-- 2 ---------------------------------------------------------------------------------------------------
create or replace function public.admin_record_exam_result(p_app uuid, p_passed boolean, p_note text default null)
returns public.applications language plpgsql security definer set search_path to 'public'
as $$
declare
  v_app public.applications;
begin
  if not public.is_program_admin() then
    raise exception 'Program admin role required' using errcode = '42501';
  end if;
  update public.applications
  set exam_result = case when p_passed then 'passed' else 'failed' end, exam_result_at = now()
  where id = p_app;
  if p_passed then
    v_app := public._transition(p_app, 'exam_passed', coalesce(p_note, 'Assessment passed'), auth.uid());
  else
    v_app := public._transition(p_app, 'exam_failed', p_note, auth.uid());
  end if;
  return v_app;
end;
$$;

-- 3 ---------------------------------------------------------------------------------------------------
create or replace function public.admin_assign_cohort(p_app uuid, p_cohort uuid, p_note text default null)
returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare
  v_app public.applications;
  v_capacity integer;
  v_taken integer;
  v_old uuid;
  v_name text;
  v_rank integer;
begin
  if not public.is_program_admin() then
    raise exception 'Program admin role required' using errcode = '42501';
  end if;
  select * into v_app from public.applications where id = p_app for update;
  if not found or v_app.status not in ('cohort_selection', 'waitlisted', 'cohort_registered', 'agreements_pending', 'agreements_submitted') then
    raise exception 'Application is not at a cohort stage' using errcode = '22023';
  end if;
  -- Once the applicant has ranked cohorts, admissions places them within that list.
  select rank into v_rank from public.cohort_preferences where application_id = p_app and cohort_id = p_cohort;
  if v_rank is null and exists (select 1 from public.cohort_preferences where application_id = p_app) then
    raise exception 'Choose one of the applicant''s cohort choices' using errcode = '22023';
  end if;
  select capacity, name into v_capacity, v_name from public.cohorts
    where id = p_cohort and program_id = v_app.program_id and status = 'open' for update;
  if not found then
    raise exception 'Cohort not available' using errcode = '22023';
  end if;
  select count(*) into v_taken from public.cohort_enrollments
    where cohort_id = p_cohort and status = 'registered' and application_id <> p_app;
  if v_taken >= v_capacity then
    raise exception 'Cohort is full' using errcode = '22023';
  end if;

  v_old := v_app.assigned_cohort_id;
  if v_old = p_cohort and v_app.status not in ('cohort_selection', 'waitlisted') then
    return jsonb_build_object('promoted', '{}'::uuid[]);
  end if;

  update public.cohort_enrollments set status = 'released'
    where application_id = p_app and cohort_id <> p_cohort and status in ('registered', 'waitlisted');
  insert into public.cohort_enrollments (application_id, cohort_id, status)
  values (p_app, p_cohort, 'registered')
  on conflict (application_id, cohort_id) do update set status = 'registered', waitlist_position = null;
  update public.applications set assigned_cohort_id = p_cohort where id = p_app;

  if v_app.status in ('cohort_selection', 'waitlisted') then
    perform public._transition(p_app, 'cohort_registered',
      coalesce(p_note, 'Placed in ' || v_name || coalesce(' (choice #' || v_rank || ')', '') || ' by admissions'), auth.uid());
    perform public._transition(p_app, 'agreements_pending', 'Program agreements are ready to sign', auth.uid());
    perform public._advance_if_signed(p_app);
  else
    -- Same stage, different cohort: record it on the timeline.
    insert into public.application_events (application_id, from_status, to_status, actor_id, note)
    values (p_app, v_app.status, v_app.status, auth.uid(),
      coalesce(p_note, 'Moved to ' || v_name || coalesce(' (choice #' || v_rank || ')', '') || ' by admissions'));
  end if;

  if v_old is not null and v_old <> p_cohort then
    return jsonb_build_object('promoted', public.promote_waitlist(v_old));
  end if;
  return jsonb_build_object('promoted', '{}'::uuid[]);
end;
$$;

-- 4 ---------------------------------------------------------------------------------------------------
create or replace function public.admin_reset_application(p_app uuid, p_note text default null)
returns uuid[] language plpgsql security definer set search_path to 'public'
as $$
declare
  v_app public.applications;
  v_cohort uuid;
  v_promoted uuid[] := '{}';
begin
  if not public.is_program_admin() then
    raise exception 'Program admin role required' using errcode = '42501';
  end if;
  select * into v_app from public.applications where id = p_app for update;
  if not found then
    raise exception 'Application not found' using errcode = 'P0002';
  end if;
  if v_app.status::text in ('submitted', 'screening') then
    raise exception 'This application is already at the start' using errcode = '22023';
  end if;
  if v_app.status::text in ('completed', 'hired') then
    raise exception 'Completed trainees can''t be reset; undo the outcome first' using errcode = '22023';
  end if;

  update public.applications
  set status = 'screening',
      exam_url = null, exam_invited_at = null, exam_self_reported_at = null,
      exam_reminders_sent = 0, exam_last_reminded_at = null, exam_result = null, exam_result_at = null,
      assigned_cohort_id = null, confirmed_at = null
  where id = p_app;
  delete from public.cohort_preferences where application_id = p_app;
  insert into public.application_events (application_id, from_status, to_status, actor_id, note)
  values (p_app, v_app.status, 'screening', auth.uid(),
    coalesce(nullif(trim(p_note), ''), 'Reset to the start of admissions'));

  -- Free any seat or waitlist spot, and move the next person up.
  for v_cohort in
    update public.cohort_enrollments set status = 'released'
    where application_id = p_app and status in ('registered', 'waitlisted') returning cohort_id
  loop
    v_promoted := v_promoted || public.promote_waitlist(v_cohort);
  end loop;
  return v_promoted;
end;
$$;
revoke all on function public.admin_reset_application(uuid, text) from public, anon;
grant execute on function public.admin_reset_application(uuid, text) to authenticated, service_role;
