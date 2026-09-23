-- Talent-Vault Training Programs: role helpers, workflow RPCs, cohort registration

-- ---------------------------------------------------------------------------
-- Role helpers (used by RLS and RPCs)
-- ---------------------------------------------------------------------------
create or replace function public.has_role(p_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.profiles p on p.id = ur.user_id
    where ur.user_id = auth.uid() and ur.role = p_role and p.active
  );
$$;

create or replace function public.is_program_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select public.has_role('program_admin'); $$;

-- Staff who may read applicant data (program admins act; IT admins read-only).
create or replace function public.can_read_applicants()
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select public.has_role('program_admin') or public.has_role('it_admin'); $$;

create or replace function public.my_employer_orgs()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select ur.employer_org_id
  from public.user_roles ur
  join public.profiles p on p.id = ur.user_id
  where ur.user_id = auth.uid() and ur.role = 'employer' and p.active and ur.employer_org_id is not null;
$$;

create or replace function public.my_roles()
returns table (role public.app_role, employer_org_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select ur.role, ur.employer_org_id
  from public.user_roles ur
  join public.profiles p on p.id = ur.user_id
  where ur.user_id = auth.uid() and p.active;
$$;

-- Employers may view an application only if it's consented, in a program their org partners on.
create or replace function public.employer_can_view_application(p_app uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.applications a
    join public.program_partners pp on pp.program_id = a.program_id
    where a.id = p_app
      and a.share_with_employers
      and a.status <> 'withdrawn'
      and pp.employer_org_id in (select public.my_employer_orgs())
  );
$$;

-- ---------------------------------------------------------------------------
-- New-user bootstrap: profile + applicant role
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'applicant')
  on conflict do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Workflow: allowed transitions (mirrors src/lib/workflow.ts)
-- ---------------------------------------------------------------------------
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
    or (p_to = 'withdrawn' and p_from not in ('confirmed', 'withdrawn'));
$$;

-- Internal: validate + apply + log a transition. Not callable by clients.
create or replace function public._transition(
  p_app uuid,
  p_to public.application_status,
  p_note text,
  p_actor uuid
)
returns public.applications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app public.applications;
  v_from public.application_status;
begin
  select * into v_app from public.applications where id = p_app for update;
  if not found then
    raise exception 'Application not found' using errcode = 'P0002';
  end if;
  v_from := v_app.status;

  if not public.transition_allowed(v_from, p_to) then
    raise exception 'Transition % -> % is not allowed', v_from, p_to using errcode = '22023';
  end if;

  update public.applications
  set status = p_to,
      confirmed_at = case when p_to = 'confirmed' then now() else confirmed_at end
  where id = p_app
  returning * into v_app;

  insert into public.application_events (application_id, from_status, to_status, actor_id, note)
  values (p_app, v_from, p_to, p_actor, nullif(trim(p_note), ''));

  return v_app;
end;
$$;

-- ---------------------------------------------------------------------------
-- Applicant RPCs
-- ---------------------------------------------------------------------------
create or replace function public.submit_application(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
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
    program_id, user_id, first_name, last_name, email, phone,
    highest_education, major, resume_path, visa_sponsorship,
    will_be_18_by_completion, share_with_employers, utm_source, utm_medium, utm_campaign
  ) values (
    v_program,
    auth.uid(),
    trim(p ->> 'first_name'),
    trim(p ->> 'last_name'),
    coalesce(nullif(trim(p ->> 'email'), ''), v_email),
    trim(p ->> 'phone'),
    (p ->> 'highest_education')::public.education_level,
    nullif(trim(p ->> 'major'), ''),
    nullif(p ->> 'resume_path', ''),
    (p ->> 'visa_sponsorship')::public.visa_need,
    (p ->> 'will_be_18_by_completion')::boolean,
    coalesce((p ->> 'share_with_employers')::boolean, false),
    nullif(p ->> 'utm_source', ''),
    nullif(p ->> 'utm_medium', ''),
    nullif(p ->> 'utm_campaign', '')
  )
  returning id into v_id;

  -- Resume must live in the applicant's own storage folder.
  if (p ->> 'resume_path') is not null and split_part(p ->> 'resume_path', '/', 1) <> auth.uid()::text then
    raise exception 'Invalid resume path' using errcode = '42501';
  end if;

  update public.profiles
  set full_name = coalesce(full_name, trim(p ->> 'first_name') || ' ' || trim(p ->> 'last_name')),
      phone = coalesce(phone, trim(p ->> 'phone'))
  where id = auth.uid();

  insert into public.application_events (application_id, from_status, to_status, actor_id, note)
  values (v_id, null, 'submitted', auth.uid(), 'Application submitted');

  return v_id;
end;
$$;

create or replace function public.applicant_mark_exam_completed(p_app uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.applications
  set exam_self_reported_at = coalesce(exam_self_reported_at, now())
  where id = p_app and user_id = auth.uid() and status = 'exam_invited';
  if not found then
    raise exception 'Exam is not open for this application' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.applicant_withdraw(p_app uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cohort uuid;
begin
  if not exists (select 1 from public.applications where id = p_app and user_id = auth.uid()) then
    raise exception 'Not your application' using errcode = '42501';
  end if;
  perform public._transition(p_app, 'withdrawn', coalesce(p_reason, 'Withdrawn by applicant'), auth.uid());

  -- Free any seat and let the waitlist move.
  for v_cohort in
    update public.cohort_enrollments set status = 'released'
    where application_id = p_app and status in ('registered', 'waitlisted')
    returning cohort_id
  loop
    perform public.promote_waitlist(v_cohort);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Cohorts: availability, registration, waitlist
-- ---------------------------------------------------------------------------
create or replace function public.cohort_availability(p_program uuid default null)
returns table (
  cohort_id uuid,
  program_id uuid,
  name text,
  format text,
  start_date date,
  end_date date,
  schedule text,
  location text,
  address text,
  capacity integer,
  status text,
  registered integer,
  waitlisted integer,
  seats_left integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id, c.program_id, c.name, c.format, c.start_date, c.end_date, c.schedule, c.location, c.address,
    c.capacity, c.status,
    coalesce(sum((e.status = 'registered')::int), 0)::int as registered,
    coalesce(sum((e.status = 'waitlisted')::int), 0)::int as waitlisted,
    greatest(c.capacity - coalesce(sum((e.status = 'registered')::int), 0), 0)::int as seats_left
  from public.cohorts c
  left join public.cohort_enrollments e on e.cohort_id = c.id
  where (p_program is null or c.program_id = p_program)
    and c.status <> 'archived'
  group by c.id
  order by c.start_date, c.name;
$$;

-- Internal: place an application into its highest-ranked cohort with a free seat, else waitlist on all choices.
create or replace function public.register_for_cohort(p_app uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_taken integer;
  v_pos integer;
begin
  -- Lock all candidate cohorts in a stable order to avoid deadlocks and overbooking.
  perform 1 from public.cohorts
  where id in (select cohort_id from public.cohort_preferences where application_id = p_app)
  order by id
  for update;

  for r in
    select cp.cohort_id, cp.rank, c.capacity
    from public.cohort_preferences cp
    join public.cohorts c on c.id = cp.cohort_id
    where cp.application_id = p_app and c.status = 'open'
    order by cp.rank
  loop
    select count(*) into v_taken
    from public.cohort_enrollments
    where cohort_id = r.cohort_id and status = 'registered';

    if v_taken < r.capacity then
      insert into public.cohort_enrollments (application_id, cohort_id, status, waitlist_position)
      values (p_app, r.cohort_id, 'registered', null)
      on conflict (application_id, cohort_id)
      do update set status = 'registered', waitlist_position = null;

      update public.cohort_enrollments
      set status = 'released'
      where application_id = p_app and cohort_id <> r.cohort_id and status in ('waitlisted', 'registered');

      update public.applications set assigned_cohort_id = r.cohort_id where id = p_app;

      return jsonb_build_object('result', 'registered', 'cohort_id', r.cohort_id, 'rank', r.rank);
    end if;
  end loop;

  for r in
    select cp.cohort_id
    from public.cohort_preferences cp
    join public.cohorts c on c.id = cp.cohort_id
    where cp.application_id = p_app and c.status = 'open'
    order by cp.rank
  loop
    select coalesce(max(waitlist_position), 0) + 1 into v_pos
    from public.cohort_enrollments
    where cohort_id = r.cohort_id and status = 'waitlisted';

    insert into public.cohort_enrollments (application_id, cohort_id, status, waitlist_position)
    values (p_app, r.cohort_id, 'waitlisted', v_pos)
    on conflict (application_id, cohort_id)
    do update set status = 'waitlisted', waitlist_position = excluded.waitlist_position;
  end loop;

  return jsonb_build_object('result', 'waitlisted');
end;
$$;

-- Internal: fill free seats in a cohort from its waitlist, in order. Returns promoted application ids.
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
  else
    perform public._transition(p_app, 'waitlisted', 'All selected cohorts are full — you are on the waitlist', auth.uid());
  end if;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Agreements
-- ---------------------------------------------------------------------------
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
  if v_app.status <> 'agreements_pending' then
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

  if v_remaining = 0 then
    perform public._transition(p_app, 'agreements_submitted', 'All program agreements signed', auth.uid());
  end if;

  return jsonb_build_object('remaining', v_remaining);
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin RPCs (program_admin only)
-- ---------------------------------------------------------------------------
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
  if p_to in ('exam_invited', 'exam_passed', 'exam_failed', 'cohort_registered', 'waitlisted', 'agreements_submitted') then
    raise exception 'Use the dedicated action for %', p_to using errcode = '22023';
  end if;
  return public._transition(p_app, p_to, p_note, auth.uid());
end;
$$;

create or replace function public.admin_send_exam_invite(p_app uuid, p_url text, p_note text default null)
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
  if coalesce(p_url, '') !~* '^https://' then
    raise exception 'Exam link must be an https:// URL' using errcode = '22023';
  end if;
  update public.applications
  set exam_url = p_url, exam_invited_at = now(), exam_self_reported_at = null,
      exam_reminders_sent = 0, exam_last_reminded_at = null, exam_result = null, exam_result_at = null
  where id = p_app;
  v_app := public._transition(p_app, 'exam_invited', coalesce(p_note, 'Assessment invitation sent'), auth.uid());
  return v_app;
end;
$$;

create or replace function public.admin_record_exam_result(p_app uuid, p_passed boolean, p_note text default null)
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
  update public.applications
  set exam_result = case when p_passed then 'passed' else 'failed' end, exam_result_at = now()
  where id = p_app;
  if p_passed then
    perform public._transition(p_app, 'exam_passed', coalesce(p_note, 'Assessment passed (verified by TSMC Arizona)'), auth.uid());
    v_app := public._transition(p_app, 'cohort_selection', 'Choose your top 3 cohorts', auth.uid());
  else
    v_app := public._transition(p_app, 'exam_failed', p_note, auth.uid());
  end if;
  return v_app;
end;
$$;

create or replace function public.admin_record_exam_reminder(p_app uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.is_program_admin() or auth.role() = 'service_role') then
    raise exception 'Program admin role required' using errcode = '42501';
  end if;
  update public.applications
  set exam_reminders_sent = exam_reminders_sent + 1, exam_last_reminded_at = now()
  where id = p_app and status = 'exam_invited';
end;
$$;

-- Assign (or move) an applicant into a specific cohort, overriding preferences. Capacity is still enforced.
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
  end if;

  if v_old is not null and v_old <> p_cohort then
    return jsonb_build_object('promoted', public.promote_waitlist(v_old));
  end if;
  return jsonb_build_object('promoted', '{}'::uuid[]);
end;
$$;

-- Release an applicant's seat and reopen cohort selection for them; promotes the waitlist.
create or replace function public.admin_release_seat(p_app uuid, p_note text default null)
returns uuid[]
language plpgsql
security definer
set search_path = public
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
  if not found or v_app.status not in ('cohort_registered', 'waitlisted', 'agreements_pending') then
    raise exception 'Application has no seat to release' using errcode = '22023';
  end if;

  for v_cohort in
    update public.cohort_enrollments set status = 'released'
    where application_id = p_app and status in ('registered', 'waitlisted')
    returning cohort_id
  loop
    v_promoted := v_promoted || public.promote_waitlist(v_cohort);
  end loop;

  update public.applications set assigned_cohort_id = null where id = p_app;
  delete from public.cohort_preferences where application_id = p_app;
  perform public._transition(p_app, 'cohort_selection', coalesce(p_note, 'Seat released — please choose cohorts again'), auth.uid());
  return v_promoted;
end;
$$;

create or replace function public.admin_analytics(p_program uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  if not public.can_read_applicants() then
    raise exception 'Staff role required' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'by_status', coalesce((
      select jsonb_object_agg(status, n) from (
        select status::text, count(*) n from public.applications
        where p_program is null or program_id = p_program group by status
      ) s), '{}'::jsonb),
    'reached', coalesce((
      select jsonb_object_agg(to_status, n) from (
        select e.to_status::text, count(distinct e.application_id) n
        from public.application_events e join public.applications a on a.id = e.application_id
        where p_program is null or a.program_id = p_program group by e.to_status
      ) r), '{}'::jsonb),
    'by_source', coalesce((
      select jsonb_object_agg(src, n) from (
        select coalesce(utm_source, 'direct') src, count(*) n from public.applications
        where p_program is null or program_id = p_program group by 1
      ) u), '{}'::jsonb),
    'by_education', coalesce((
      select jsonb_object_agg(highest_education, n) from (
        select highest_education::text, count(*) n from public.applications
        where p_program is null or program_id = p_program group by 1
      ) ed), '{}'::jsonb),
    'visa', coalesce((
      select jsonb_object_agg(visa_sponsorship, n) from (
        select visa_sponsorship::text, count(*) n from public.applications
        where p_program is null or program_id = p_program group by 1
      ) vi), '{}'::jsonb),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object('day', d, 'n', n) order by d) from (
        select date_trunc('day', submitted_at)::date d, count(*) n from public.applications
        where (p_program is null or program_id = p_program) and submitted_at > now() - interval '60 days'
        group by 1
      ) dd), '[]'::jsonb),
    'total', (select count(*) from public.applications where p_program is null or program_id = p_program)
  ) into v;
  return v;
end;
$$;

-- ---------------------------------------------------------------------------
-- Employer RPCs
-- ---------------------------------------------------------------------------
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
    ),
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

create or replace function public.employer_pipeline()
returns table (program_id uuid, program_name text, status public.application_status, n bigint)
language sql
stable
security definer
set search_path = public
as $$
  select a.program_id, p.short_name, a.status, count(*)
  from public.applications a
  join public.programs p on p.id = a.program_id
  where exists (
    select 1 from public.program_partners pp
    where pp.program_id = a.program_id and pp.employer_org_id in (select public.my_employer_orgs())
  )
  group by 1, 2, 3;
$$;

create or replace function public.employer_toggle_shortlist(p_app uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  if not public.employer_can_view_application(p_app) then
    raise exception 'Not permitted' using errcode = '42501';
  end if;
  select pp.employer_org_id into v_org
  from public.applications a join public.program_partners pp on pp.program_id = a.program_id
  where a.id = p_app and pp.employer_org_id in (select public.my_employer_orgs())
  limit 1;

  if exists (select 1 from public.employer_shortlist where application_id = p_app and employer_org_id = v_org) then
    delete from public.employer_shortlist where application_id = p_app and employer_org_id = v_org;
    return false;
  end if;
  insert into public.employer_shortlist (application_id, employer_org_id, created_by) values (p_app, v_org, auth.uid());
  return true;
end;
$$;

create or replace function public.employer_add_note(p_app uuid, p_kind text, p_body text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_id uuid;
begin
  if not public.employer_can_view_application(p_app) then
    raise exception 'Not permitted' using errcode = '42501';
  end if;
  select pp.employer_org_id into v_org
  from public.applications a join public.program_partners pp on pp.program_id = a.program_id
  where a.id = p_app and pp.employer_org_id in (select public.my_employer_orgs())
  limit 1;
  insert into public.employer_notes (application_id, employer_org_id, author_id, kind, body)
  values (p_app, v_org, auth.uid(), p_kind, p_body)
  returning id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- IT admin RPCs
-- ---------------------------------------------------------------------------
create or replace function public.it_grant_role(p_email text, p_role public.app_role, p_org uuid default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
begin
  if not public.has_role('it_admin') then
    raise exception 'IT admin role required' using errcode = '42501';
  end if;
  select id into v_user from public.profiles where lower(email) = lower(trim(p_email));
  if v_user is null then
    raise exception 'No account with that email. Ask them to register first.' using errcode = 'P0002';
  end if;
  insert into public.user_roles (user_id, role, employer_org_id)
  values (v_user, p_role, case when p_role = 'employer' then p_org else null end)
  on conflict do nothing;
  insert into public.audit_log (actor_id, action, entity, entity_id, metadata)
  values (auth.uid(), 'role.grant', 'user', v_user::text, jsonb_build_object('role', p_role, 'org', p_org));
  return v_user;
end;
$$;

create or replace function public.it_revoke_role(p_role_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.user_roles;
begin
  if not public.has_role('it_admin') then
    raise exception 'IT admin role required' using errcode = '42501';
  end if;
  delete from public.user_roles where id = p_role_id returning * into v_row;
  if v_row.user_id = auth.uid() and v_row.role = 'it_admin' then
    raise exception 'You cannot revoke your own IT admin role' using errcode = '22023';
  end if;
  insert into public.audit_log (actor_id, action, entity, entity_id, metadata)
  values (auth.uid(), 'role.revoke', 'user', v_row.user_id::text, jsonb_build_object('role', v_row.role));
end;
$$;

create or replace function public.it_set_user_active(p_user uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_role('it_admin') then
    raise exception 'IT admin role required' using errcode = '42501';
  end if;
  if p_user = auth.uid() and not p_active then
    raise exception 'You cannot deactivate yourself' using errcode = '22023';
  end if;
  update public.profiles set active = p_active where id = p_user;
  insert into public.audit_log (actor_id, action, entity, entity_id, metadata)
  values (auth.uid(), case when p_active then 'user.activate' else 'user.deactivate' end, 'user', p_user::text, '{}'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------
-- Logging helpers (any signed-in user; actor is always the caller)
-- ---------------------------------------------------------------------------
create or replace function public.log_audit(p_action text, p_entity text, p_entity_id text, p_metadata jsonb default '{}'::jsonb, p_ip text default null)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.audit_log (actor_id, action, entity, entity_id, metadata, ip)
  select auth.uid(), left(p_action, 80), left(p_entity, 80), left(p_entity_id, 120), coalesce(p_metadata, '{}'::jsonb), left(p_ip, 80)
  where auth.uid() is not null or auth.role() = 'service_role';
$$;

create or replace function public.log_email(
  p_application uuid,
  p_to text,
  p_template text,
  p_subject text,
  p_status text,
  p_provider_id text,
  p_error text
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.email_log (application_id, to_email, template, subject, status, provider_id, error)
  select p_application, p_to, left(p_template, 80), left(p_subject, 300), p_status, p_provider_id, left(p_error, 1000)
  where auth.uid() is not null or auth.role() = 'service_role';
$$;

-- Cron helper: exam invites needing a reminder (day 3 and day 7 after invite, max 2).
create or replace function public.due_exam_reminders()
returns table (application_id uuid, email text, first_name text, exam_url text, program_name text, reminders_sent integer)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, a.email, a.first_name, a.exam_url, p.short_name, a.exam_reminders_sent
  from public.applications a
  join public.programs p on p.id = a.program_id
  where a.status = 'exam_invited'
    and a.exam_self_reported_at is null
    and a.exam_invited_at is not null
    and (
      (a.exam_reminders_sent = 0 and a.exam_invited_at < now() - interval '3 days')
      or (a.exam_reminders_sent = 1 and a.exam_invited_at < now() - interval '7 days')
    );
$$;

-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon;

-- Internal-only helpers
revoke execute on function public._transition(uuid, public.application_status, text, uuid) from authenticated;
revoke execute on function public.register_for_cohort(uuid) from authenticated;
revoke execute on function public.promote_waitlist(uuid) from authenticated;
revoke execute on function public.due_exam_reminders() from authenticated;
revoke execute on function public.handle_new_user() from authenticated;
revoke execute on function public.touch_updated_at() from authenticated;

-- Public read of cohort seat availability (landing page)
grant execute on function public.cohort_availability(uuid) to anon, authenticated;
grant execute on function public.transition_allowed(public.application_status, public.application_status) to anon, authenticated;

-- Everything else is callable by signed-in users; each function checks the caller's role itself.
grant execute on function public.has_role(public.app_role) to authenticated;
grant execute on function public.is_program_admin() to authenticated;
grant execute on function public.can_read_applicants() to authenticated;
grant execute on function public.my_employer_orgs() to authenticated;
grant execute on function public.my_roles() to authenticated;
grant execute on function public.employer_can_view_application(uuid) to authenticated;
grant execute on function public.submit_application(jsonb) to authenticated;
grant execute on function public.applicant_mark_exam_completed(uuid) to authenticated;
grant execute on function public.applicant_withdraw(uuid, text) to authenticated;
grant execute on function public.applicant_submit_cohort_preferences(uuid, uuid[]) to authenticated;
grant execute on function public.applicant_sign_agreement(uuid, uuid, text, text, text, text, text) to authenticated;
grant execute on function public.admin_transition(uuid, public.application_status, text) to authenticated;
grant execute on function public.admin_send_exam_invite(uuid, text, text) to authenticated;
grant execute on function public.admin_record_exam_result(uuid, boolean, text) to authenticated;
grant execute on function public.admin_record_exam_reminder(uuid) to authenticated;
grant execute on function public.admin_assign_cohort(uuid, uuid, text) to authenticated;
grant execute on function public.admin_release_seat(uuid, text) to authenticated;
grant execute on function public.admin_analytics(uuid) to authenticated;
grant execute on function public.employer_list_candidates(uuid) to authenticated;
grant execute on function public.employer_pipeline() to authenticated;
grant execute on function public.employer_toggle_shortlist(uuid) to authenticated;
grant execute on function public.employer_add_note(uuid, text, text) to authenticated;
grant execute on function public.it_grant_role(text, public.app_role, uuid) to authenticated;
grant execute on function public.it_revoke_role(uuid) to authenticated;
grant execute on function public.it_set_user_active(uuid, boolean) to authenticated;
grant execute on function public.log_audit(text, text, text, jsonb, text) to authenticated;
grant execute on function public.log_email(uuid, text, text, text, text, text, text) to authenticated;
