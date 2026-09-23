-- Enrollment = choosing cohorts + signing agreements, in one step.
-- Agreements can be signed as soon as cohorts are chosen (even while waitlisted), signatures are
-- program-wide so they carry over when someone changes cohort, and a registration whose agreements
-- are already signed goes straight to "awaiting final confirmation" for the program admin.

-- Move an application whose agreements are all signed from "agreements to sign" straight to
-- "awaiting final confirmation" (e.g. they signed while waitlisted, or before changing cohort).
create or replace function public._advance_if_signed(p_app uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app public.applications;
begin
  select * into v_app from public.applications where id = p_app;
  if v_app.status <> 'agreements_pending' then
    return false;
  end if;
  if not exists (select 1 from public.agreement_templates t where t.program_id = v_app.program_id and t.active and t.required) then
    return false;
  end if;
  if exists (
    select 1 from public.agreement_templates t
    where t.program_id = v_app.program_id and t.active and t.required
      and not exists (
        select 1 from public.agreement_signatures s
        where s.application_id = p_app and s.template_id = t.id and s.template_version = t.version
      )
  ) then
    return false;
  end if;
  perform public._transition(p_app, 'agreements_submitted', 'Agreements already signed — ready for final confirmation', null);
  return true;
end;
$$;
revoke execute on function public._advance_if_signed(uuid) from public, anon, authenticated;

create or replace function public.promote_waitlist(p_cohort uuid)
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_capacity integer;
  v_taken integer;
  v_next record;
  v_promoted uuid[] := '{}';
begin
  select capacity into v_capacity from public.cohorts where id = p_cohort and status = 'open' for update;
  if not found then
    return v_promoted;
  end if;

  loop
    select count(*) into v_taken from public.cohort_enrollments where cohort_id = p_cohort and status = 'registered';
    exit when v_taken >= v_capacity;

    select e.id, e.application_id into v_next
    from public.cohort_enrollments e
    join public.applications a on a.id = e.application_id
    where e.cohort_id = p_cohort and e.status = 'waitlisted' and a.status = 'waitlisted'
    order by e.waitlist_position, e.created_at
    limit 1
    for update of e;
    exit when not found;

    update public.cohort_enrollments set status = 'registered', waitlist_position = null where id = v_next.id;
    update public.cohort_enrollments set status = 'released'
      where application_id = v_next.application_id and id <> v_next.id and status = 'waitlisted';
    update public.applications set assigned_cohort_id = p_cohort where id = v_next.application_id;

    perform public._transition(v_next.application_id, 'cohort_registered', 'A seat opened up — promoted from the waitlist', null);
    perform public._transition(v_next.application_id, 'agreements_pending', 'Program agreements are ready to sign', null);
    perform public._advance_if_signed(v_next.application_id);
    v_promoted := v_promoted || v_next.application_id;
  end loop;

  return v_promoted;
end;
$$;

create or replace function public.applicant_submit_cohort_preferences(p_app uuid, p_cohorts uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
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
    where not exists (select 1 from public.cohorts c where c.id = x and c.program_id = v_app.program_id and c.status = 'open')
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

create or replace function public.admin_assign_cohort(p_app uuid, p_cohort uuid, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app public.applications;
  v_capacity integer;
  v_taken integer;
  v_old uuid;
begin
  if not public.is_program_admin() then
    raise exception 'Program admin role required' using errcode = '42501';
  end if;
  select * into v_app from public.applications where id = p_app for update;
  if not found or v_app.status not in ('cohort_selection', 'waitlisted', 'cohort_registered', 'agreements_pending') then
    raise exception 'Application is not at a cohort stage' using errcode = '22023';
  end if;
  select capacity into v_capacity from public.cohorts
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

  update public.cohort_enrollments set status = 'released'
    where application_id = p_app and cohort_id <> p_cohort and status in ('registered', 'waitlisted');
  insert into public.cohort_enrollments (application_id, cohort_id, status)
  values (p_app, p_cohort, 'registered')
  on conflict (application_id, cohort_id) do update set status = 'registered', waitlist_position = null;
  update public.applications set assigned_cohort_id = p_cohort where id = p_app;

  if v_app.status in ('cohort_selection', 'waitlisted') then
    perform public._transition(p_app, 'cohort_registered', coalesce(p_note, 'Registered by admissions'), auth.uid());
    perform public._transition(p_app, 'agreements_pending', 'Program agreements are ready to sign', auth.uid());
    perform public._advance_if_signed(p_app);
  end if;

  if v_old is not null and v_old <> p_cohort then
    return jsonb_build_object('promoted', public.promote_waitlist(v_old));
  end if;
  return jsonb_build_object('promoted', '{}'::uuid[]);
end;
$$;

create or replace function public.applicant_sign_agreement(
  p_app uuid,
  p_template uuid,
  p_typed_name text,
  p_signature_path text,
  p_pdf_path text,
  p_ip text,
  p_user_agent text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app public.applications;
  v_tpl public.agreement_templates;
  v_remaining integer;
begin
  select * into v_app from public.applications where id = p_app and user_id = auth.uid() for update;
  if not found then
    raise exception 'Not your application' using errcode = '42501';
  end if;
  -- Signing opens as soon as cohorts are chosen, including while waitlisted.
  if v_app.status not in ('agreements_pending', 'waitlisted') then
    raise exception 'Agreements are not open for signing' using errcode = '22023';
  end if;
  select * into v_tpl from public.agreement_templates where id = p_template and program_id = v_app.program_id and active;
  if not found then
    raise exception 'Agreement not found' using errcode = 'P0002';
  end if;
  if length(trim(coalesce(p_typed_name, ''))) < 2 then
    raise exception 'Type your full legal name to sign' using errcode = '22023';
  end if;
  if split_part(p_signature_path, '/', 1) <> auth.uid()::text
     or (p_pdf_path is not null and split_part(p_pdf_path, '/', 1) <> auth.uid()::text) then
    raise exception 'Invalid file path' using errcode = '42501';
  end if;

  insert into public.agreement_signatures (
    application_id, template_id, template_version, typed_name, signature_path, pdf_path, ip, user_agent
  ) values (
    p_app, p_template, v_tpl.version, trim(p_typed_name), p_signature_path, p_pdf_path, p_ip, left(p_user_agent, 400)
  )
  on conflict (application_id, template_id) do update
  set template_version = excluded.template_version,
      typed_name = excluded.typed_name,
      signature_path = excluded.signature_path,
      pdf_path = excluded.pdf_path,
      ip = excluded.ip,
      user_agent = excluded.user_agent,
      signed_at = now();

  select count(*) into v_remaining
  from public.agreement_templates t
  where t.program_id = v_app.program_id and t.active and t.required
    and not exists (
      select 1 from public.agreement_signatures s
      where s.application_id = p_app and s.template_id = t.id and s.template_version = t.version
    );

  if v_remaining = 0 and v_app.status = 'agreements_pending' then
    perform public._transition(p_app, 'agreements_submitted', 'All program agreements signed', auth.uid());
  end if;

  return jsonb_build_object('remaining', v_remaining);
end;
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

  perform public._transition(p_app, 'cohort_selection',
    'Left cohort to choose another (signed agreements carry over)' || coalesce(': ' || nullif(trim(p_reason), ''), ''), auth.uid());
  return v_promoted;
end;
$$;

create or replace function public.admin_delete_cohort(p_cohort uuid, p_note text default null)
returns uuid[] language plpgsql security definer set search_path = public as $$
declare
  v_name text;
  v_row record;
  v_affected uuid[] := '{}';
  v_actor uuid := auth.uid();
begin
  if not public.is_program_admin() then
    raise exception 'Program admin role required' using errcode = '42501';
  end if;
  select name into v_name from public.cohorts where id = p_cohort for update;
  if not found then
    raise exception 'Cohort not found' using errcode = 'P0002';
  end if;

  for v_row in
    select e.application_id, e.status as enr_status, a.status as app_status
    from public.cohort_enrollments e join public.applications a on a.id = e.application_id
    where e.cohort_id = p_cohort and e.status in ('registered', 'waitlisted')
    for update of a
  loop
    delete from public.cohort_enrollments where application_id = v_row.application_id and cohort_id = p_cohort;
    -- Still waitlisted somewhere else? Leave them there.
    continue when v_row.enr_status = 'waitlisted'
      and exists (select 1 from public.cohort_enrollments where application_id = v_row.application_id and status = 'waitlisted');

    update public.cohort_enrollments set status = 'released'
      where application_id = v_row.application_id and status in ('registered', 'waitlisted');
    update public.applications set assigned_cohort_id = null, confirmed_at = null where id = v_row.application_id;
    delete from public.cohort_preferences where application_id = v_row.application_id;
    if v_row.app_status <> 'cohort_selection' then
      perform public._transition(v_row.application_id, 'cohort_selection',
        'Cohort "' || v_name || '" was cancelled' || coalesce(': ' || nullif(trim(p_note), ''), '') || '. Please choose new cohorts.',
        v_actor);
    end if;
    v_affected := v_affected || v_row.application_id;
  end loop;

  update public.applications set assigned_cohort_id = null where assigned_cohort_id = p_cohort;
  delete from public.cohorts where id = p_cohort;

  insert into public.audit_log (actor_id, action, entity, entity_id, metadata)
  values (v_actor, 'cohort.delete', 'cohort', p_cohort::text,
    jsonb_build_object('name', v_name, 'applicants_moved', coalesce(array_length(v_affected, 1), 0)));
  return v_affected;
end;
$$;
