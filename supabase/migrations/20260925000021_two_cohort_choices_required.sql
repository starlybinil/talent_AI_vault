-- Applicants must rank at least 2 cohorts (3rd optional), unless fewer than 2 are open.
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
    raise exception 'Choose 2 or 3 cohorts' using errcode = '22023';
  end if;
  -- Two choices are required (the third is optional), unless the program has fewer open cohorts.
  if array_length(p_cohorts, 1) < 2 and (
    select count(*) from public.cohorts c
    where c.program_id = v_app.program_id and c.status = 'open' and c.visible_to_applicants
  ) >= 2 then
    raise exception 'Choose at least 2 cohorts' using errcode = '22023';
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
