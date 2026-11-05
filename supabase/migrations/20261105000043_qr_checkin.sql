-- QR attendance check-in run by instructors.
--   * Instructors (directory entries) get sign-in accounts; they see the cohorts they're assigned to.
--   * An instructor (or cohort manager) opens a check-in window on a session; trainees scan a QR whose code rotates
--     every 30 seconds and are marked Present, or Late after the cutoff. Optional location check per program.
--   * Flagged check-ins (outside the area, no location, same phone twice) count as Present/Late until reviewed.

-- Settings ------------------------------------------------------------------------------------------------------
alter table public.programs
  add column if not exists checkin_location boolean not null default false,
  add column if not exists checkin_window_minutes integer not null default 15 check (checkin_window_minutes between 1 and 240),
  add column if not exists checkin_late_minutes integer not null default 10 check (checkin_late_minutes between 0 and 240),
  add column if not exists missed_session_email boolean not null default true;

alter table public.training_locations
  add column if not exists latitude double precision check (latitude between -90 and 90),
  add column if not exists longitude double precision check (longitude between -180 and 180),
  add column if not exists radius_m integer not null default 100 check (radius_m between 10 and 5000);

-- Instructor accounts -------------------------------------------------------------------------------------------
alter table public.instructors add column if not exists user_id uuid unique references public.profiles(id) on delete set null;

create or replace function public.arizona_today() returns date
language sql stable as $$ select (now() at time zone 'America/Phoenix')::date $$;

create or replace function public.teaches_cohort(p_cohort uuid)
returns boolean language sql stable security definer set search_path to 'public'
as $$
  select p_cohort is not null and public.has_role('instructor') and exists (
    select 1 from public.cohort_instructors ci join public.instructors i on i.id = ci.instructor_id
    where ci.cohort_id = p_cohort and i.user_id = auth.uid() and i.active);
$$;
revoke all on function public.teaches_cohort(uuid) from public, anon;
grant execute on function public.teaches_cohort(uuid) to authenticated;

-- Program admins give (or remove) an instructor's sign-in access. Existing account: role now; otherwise an invitation
-- that applies when they register with the instructor's email.
create or replace function public.admin_instructor_access(p_instructor uuid, p_grant boolean)
returns text language plpgsql security definer set search_path to 'public'
as $$
declare v_email text; v_user uuid;
begin
  if not public.is_program_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  select lower(trim(email)) into v_email from public.instructors where id = p_instructor;
  if v_email is null or v_email = '' then raise exception 'Add an email address for this instructor first' using errcode = '22023'; end if;
  select id into v_user from public.profiles where lower(email) = v_email;
  if not p_grant then
    update public.instructors set user_id = null where id = p_instructor;
    delete from public.pending_role_grants where lower(email) = v_email and role = 'instructor';
    if v_user is not null and not exists (select 1 from public.instructors where user_id = v_user) then
      delete from public.user_roles where user_id = v_user and role = 'instructor';
    end if;
    insert into public.audit_log (actor_id, action, entity, entity_id, metadata)
    values (auth.uid(), 'instructor.access_removed', 'instructor', p_instructor::text, jsonb_build_object('email', v_email));
    return 'removed';
  end if;
  if v_user is null then
    insert into public.pending_role_grants (email, role, granted_by) values (v_email, 'instructor', auth.uid())
    on conflict (lower(email), role) do update set granted_by = excluded.granted_by, created_at = now();
    insert into public.audit_log (actor_id, action, entity, entity_id, metadata)
    values (auth.uid(), 'instructor.access_invited', 'instructor', p_instructor::text, jsonb_build_object('email', v_email));
    return 'invited';
  end if;
  insert into public.user_roles (user_id, role) values (v_user, 'instructor') on conflict do nothing;
  update public.instructors set user_id = v_user where id = p_instructor;
  insert into public.audit_log (actor_id, action, entity, entity_id, metadata)
  values (auth.uid(), 'instructor.access_granted', 'instructor', p_instructor::text, jsonb_build_object('email', v_email));
  return 'granted';
end;
$$;
revoke all on function public.admin_instructor_access(uuid, boolean) from public, anon;
grant execute on function public.admin_instructor_access(uuid, boolean) to authenticated;

-- New sign-ups with a pending instructor invitation are linked to their directory entry.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path to 'public'
as $$
declare
  v_granted integer;
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'))
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role, employer_org_id)
  select new.id, g.role, g.employer_org_id from public.pending_role_grants g where lower(g.email) = lower(new.email)
  on conflict do nothing;
  get diagnostics v_granted = row_count;

  if v_granted > 0 then
    insert into public.cohort_manager_programs (user_id, program_id)
    select new.id, p from public.pending_role_grants g, unnest(coalesce(g.program_ids, '{}')) p
    where lower(g.email) = lower(new.email) and g.role = 'cohort_manager'
      and exists (select 1 from public.programs where id = p)
    on conflict do nothing;
    update public.instructors set user_id = new.id
     where lower(email) = lower(new.email) and user_id is null
       and exists (select 1 from public.pending_role_grants g where lower(g.email) = lower(new.email) and g.role = 'instructor');
    insert into public.audit_log (actor_id, action, entity, entity_id, metadata)
    select g.granted_by, 'role.grant_applied', 'user', new.id::text, jsonb_build_object('role', g.role, 'org', g.employer_org_id, 'programs', g.program_ids)
    from public.pending_role_grants g where lower(g.email) = lower(new.email);
    delete from public.pending_role_grants where lower(email) = lower(new.email);
  else
    insert into public.user_roles (user_id, role) values (new.id, 'applicant') on conflict do nothing;
  end if;
  return new;
end;
$$;

-- Check-in windows ----------------------------------------------------------------------------------------------
create table if not exists public.session_checkins (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.cohort_sessions(id) on delete cascade,
  opened_by uuid references public.profiles(id) on delete set null,
  opened_at timestamptz not null default now(),
  late_after timestamptz not null,
  closes_at timestamptz not null,
  closed_at timestamptz,
  require_location boolean not null default false,
  latitude double precision,
  longitude double precision,
  radius_m integer,
  secret text not null default encode(extensions.gen_random_bytes(16), 'hex')
);
create index if not exists session_checkins_session on public.session_checkins (session_id, opened_at desc);

alter table public.session_attendance
  add column if not exists source text not null default 'manual' check (source in ('manual', 'qr')),
  add column if not exists checked_in_at timestamptz,
  add column if not exists minutes_after_open integer,
  add column if not exists distance_m integer,
  add column if not exists accuracy_m integer,
  add column if not exists flag text check (flag in ('outside_area', 'no_location', 'shared_device')),
  add column if not exists flag_reviewed_at timestamptz,
  add column if not exists flag_reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists device_hash text;

create or replace function public.session_is_today(p_session uuid) returns boolean
language sql stable security definer set search_path to 'public'
as $$ select exists (select 1 from public.cohort_sessions where id = p_session and session_date = public.arizona_today()) $$;
revoke all on function public.session_is_today(uuid) from public, anon;
grant execute on function public.session_is_today(uuid) to authenticated;

-- The 6-character code shown on screen; it changes every 30 seconds.
create or replace function public.checkin_code(p_secret text, p_step bigint) returns text
language sql immutable as $$
  select upper(substr(encode(extensions.hmac(p_step::text, p_secret, 'sha256'), 'hex'), 1, 6))
$$;
revoke all on function public.checkin_code(text, bigint) from public, anon, authenticated;

create or replace function public.checkin_step() returns bigint
language sql stable as $$ select floor(extract(epoch from clock_timestamp()) / 30)::bigint $$;

-- Who may run check-in for a session: cohort managers/program admins any day; instructors on the day itself.
create or replace function public.can_run_checkin(p_session uuid) returns boolean
language sql stable security definer set search_path to 'public'
as $$
  select public.manages_cohort(public.session_cohort(p_session))
      or (public.teaches_cohort(public.session_cohort(p_session)) and public.session_is_today(p_session));
$$;
revoke all on function public.can_run_checkin(uuid) from public, anon;
grant execute on function public.can_run_checkin(uuid) to authenticated;

create or replace function public.checkin_open(p_session uuid, p_lat double precision default null, p_lng double precision default null)
returns uuid language plpgsql security definer set search_path to 'public'
as $$
declare
  v_cohort uuid; v_canceled boolean; p public.programs; loc public.training_locations; v_id uuid;
  v_lat double precision; v_lng double precision; v_radius integer;
begin
  if not public.can_run_checkin(p_session) then
    raise exception 'You can only start check-in for your own cohorts, on the day of the session' using errcode = '42501';
  end if;
  select s.cohort_id, s.canceled into v_cohort, v_canceled from public.cohort_sessions s where s.id = p_session;
  if v_canceled then raise exception 'This session is canceled' using errcode = '22023'; end if;
  select pr.* into p from public.cohorts c join public.programs pr on pr.id = c.program_id where c.id = v_cohort;
  select l.* into loc from public.cohorts c join public.training_locations l on l.id = c.location_id where c.id = v_cohort;
  v_lat := coalesce(p_lat, loc.latitude);
  v_lng := coalesce(p_lng, loc.longitude);
  v_radius := coalesce(loc.radius_m, 100);
  if p.checkin_location and (v_lat is null or v_lng is null) then
    raise exception 'This program checks location: save the training location''s position, or use your current location' using errcode = '22023';
  end if;
  update public.session_checkins set closed_at = now() where session_id = p_session and closed_at is null;
  insert into public.session_checkins (session_id, opened_by, late_after, closes_at, require_location, latitude, longitude, radius_m)
  values (p_session, auth.uid(), now() + make_interval(mins => p.checkin_late_minutes), now() + make_interval(mins => p.checkin_window_minutes),
          p.checkin_location, case when p.checkin_location then v_lat end, case when p.checkin_location then v_lng end,
          case when p.checkin_location then v_radius end)
  returning id into v_id;
  insert into public.audit_log (actor_id, action, entity, entity_id, metadata)
  values (auth.uid(), 'checkin.open', 'cohort', v_cohort::text, jsonb_build_object('session', p_session, 'window', v_id));
  return v_id;
end;
$$;

create or replace function public.checkin_adjust(p_window uuid, p_action text)
returns void language plpgsql security definer set search_path to 'public'
as $$
declare v_session uuid;
begin
  select session_id into v_session from public.session_checkins where id = p_window;
  if v_session is null or not public.can_run_checkin(v_session) then raise exception 'Not allowed' using errcode = '42501'; end if;
  if p_action = 'extend' then
    update public.session_checkins set closes_at = greatest(closes_at, now()) + interval '5 minutes', closed_at = null where id = p_window;
  elsif p_action = 'close' then
    update public.session_checkins set closed_at = now() where id = p_window and closed_at is null;
  else
    raise exception 'Unknown action' using errcode = '22023';
  end if;
end;
$$;

-- What the projector screen shows: the current code, timing and live counts.
create or replace function public.checkin_status(p_window uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public'
as $$
declare w public.session_checkins; v_cohort uuid; v_step bigint := public.checkin_step(); v_open boolean;
begin
  select * into w from public.session_checkins where id = p_window;
  if w.id is null then return null; end if;
  if not (public.manages_cohort(public.session_cohort(w.session_id)) or public.teaches_cohort(public.session_cohort(w.session_id))) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  v_cohort := public.session_cohort(w.session_id);
  v_open := w.closed_at is null and now() < w.closes_at;
  return jsonb_build_object(
    'open', v_open,
    'code', case when v_open then public.checkin_code(w.secret, v_step) end,
    'seconds_left_in_code', 30 - (floor(extract(epoch from clock_timestamp()))::bigint % 30),
    'opened_at', w.opened_at, 'late_after', w.late_after, 'closes_at', w.closes_at, 'closed_at', w.closed_at,
    'require_location', w.require_location,
    'roster', (select count(*) from public.applications a where a.assigned_cohort_id = v_cohort and a.status in ('confirmed', 'completed', 'hired')),
    'checked_in', (select count(*) from public.session_attendance sa where sa.session_id = w.session_id and sa.source = 'qr'),
    'late', (select count(*) from public.session_attendance sa where sa.session_id = w.session_id and sa.source = 'qr' and sa.status = 'late'),
    'flagged', (select count(*) from public.session_attendance sa where sa.session_id = w.session_id and sa.flag is not null and sa.flag_reviewed_at is null)
  );
end;
$$;

-- Trainee check-in. p_window may be null (code typed in the portal): the open window for the trainee's cohort is used.
create or replace function public.trainee_check_in(
  p_window uuid, p_code text, p_lat double precision default null, p_lng double precision default null,
  p_accuracy double precision default null, p_device text default null)
returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare
  w public.session_checkins; v_app uuid; v_cohort uuid; v_step bigint := public.checkin_step();
  v_status text; v_flag text; v_dist integer; v_existing public.session_attendance; v_minutes integer;
  v_device text := nullif(left(coalesce(p_device, ''), 64), '');
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  if auth.uid() is null then raise exception 'Please sign in to check in' using errcode = '28000'; end if;
  if p_window is null then
    select sc.* into w from public.session_checkins sc
      join public.cohort_sessions s on s.id = sc.session_id
      join public.applications a on a.assigned_cohort_id = s.cohort_id
     where a.user_id = auth.uid() and a.status = 'confirmed' and sc.closed_at is null and now() < sc.closes_at
     order by sc.opened_at desc limit 1;
  else
    select * into w from public.session_checkins where id = p_window;
  end if;
  if w.id is null then raise exception 'There''s no check-in open for your cohort right now' using errcode = 'P0002'; end if;
  if w.closed_at is not null or now() >= w.closes_at then raise exception 'Check-in for this session has closed. Please see your instructor.' using errcode = '22023'; end if;
  if v_code not in (public.checkin_code(w.secret, v_step), public.checkin_code(w.secret, v_step - 1)) then
    raise exception 'That code has expired. Scan the QR code on screen again (it changes every 30 seconds).' using errcode = '22023';
  end if;
  v_cohort := public.session_cohort(w.session_id);
  select id into v_app from public.applications
   where user_id = auth.uid() and assigned_cohort_id = v_cohort and status = 'confirmed' limit 1;
  if v_app is null then raise exception 'You''re not enrolled in this cohort' using errcode = '42501'; end if;

  select * into v_existing from public.session_attendance where session_id = w.session_id and application_id = v_app;
  if v_existing.session_id is not null then
    return jsonb_build_object('status', v_existing.status, 'already', true, 'checked_in_at', coalesce(v_existing.checked_in_at, v_existing.updated_at), 'flag', v_existing.flag);
  end if;

  v_status := case when now() > w.late_after then 'late' else 'present' end;
  v_minutes := greatest(0, floor(extract(epoch from (now() - w.opened_at)) / 60))::int;
  if w.require_location then
    if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
      v_flag := 'no_location';
    else
      -- Haversine distance in meters.
      v_dist := round(2 * 6371000 * asin(sqrt(
        power(sin(radians(p_lat - w.latitude) / 2), 2) +
        cos(radians(w.latitude)) * cos(radians(p_lat)) * power(sin(radians(p_lng - w.longitude) / 2), 2))))::int;
      if v_dist > w.radius_m + least(coalesce(p_accuracy, 0), 100) then v_flag := 'outside_area'; end if;
    end if;
  end if;
  if v_flag is null and v_device is not null and exists (
    select 1 from public.session_attendance where session_id = w.session_id and device_hash = v_device and application_id <> v_app) then
    v_flag := 'shared_device';
  end if;

  insert into public.session_attendance (session_id, application_id, status, source, checked_in_at, minutes_after_open, distance_m, accuracy_m, flag, device_hash, updated_at, updated_by)
  values (w.session_id, v_app, v_status, 'qr', now(), v_minutes, v_dist, case when p_accuracy is null then null else round(p_accuracy)::int end, v_flag, v_device, now(), auth.uid());
  return jsonb_build_object('status', v_status, 'already', false, 'checked_in_at', now(), 'flag', v_flag);
end;
$$;

-- The open check-in for the signed-in trainee's cohort (for the portal's "Check in" card).
create or replace function public.trainee_open_checkin()
returns jsonb language sql stable security definer set search_path to 'public'
as $$
  select jsonb_build_object('window', sc.id, 'session_id', sc.session_id, 'closes_at', sc.closes_at, 'require_location', sc.require_location,
           'checked_in', exists (select 1 from public.session_attendance sa where sa.session_id = sc.session_id and sa.application_id = a.id))
  from public.session_checkins sc
  join public.cohort_sessions s on s.id = sc.session_id
  join public.applications a on a.assigned_cohort_id = s.cohort_id
  where a.user_id = auth.uid() and a.status = 'confirmed' and sc.closed_at is null and now() < sc.closes_at
  order by sc.opened_at desc limit 1;
$$;

-- After check-in: everyone without a record becomes Absent. Returns the trainees marked (for "we missed you" emails).
create or replace function public.session_mark_rest_absent(p_session uuid)
returns uuid[] language plpgsql security definer set search_path to 'public'
as $$
declare v_cohort uuid := public.session_cohort(p_session); v_ids uuid[];
begin
  if not public.can_run_checkin(p_session) then raise exception 'Not allowed' using errcode = '42501'; end if;
  update public.session_checkins set closed_at = now() where session_id = p_session and closed_at is null;
  with ins as (
    insert into public.session_attendance (session_id, application_id, status, source, updated_at, updated_by)
    select p_session, a.id, 'absent', 'manual', now(), auth.uid()
    from public.applications a
    where a.assigned_cohort_id = v_cohort and a.status = 'confirmed'
      and not exists (select 1 from public.session_attendance sa where sa.session_id = p_session and sa.application_id = a.id)
    returning application_id)
  select coalesce(array_agg(application_id), '{}') into v_ids from ins;
  insert into public.audit_log (actor_id, action, entity, entity_id, metadata)
  values (auth.uid(), 'checkin.mark_rest_absent', 'cohort', v_cohort::text, jsonb_build_object('session', p_session, 'count', coalesce(array_length(v_ids, 1), 0)));
  return v_ids;
end;
$$;

revoke all on function public.checkin_open(uuid, double precision, double precision), public.checkin_adjust(uuid, text), public.checkin_status(uuid),
  public.trainee_check_in(uuid, text, double precision, double precision, double precision, text), public.trainee_open_checkin(), public.session_mark_rest_absent(uuid)
  from public, anon;
grant execute on function public.checkin_open(uuid, double precision, double precision), public.checkin_adjust(uuid, text), public.checkin_status(uuid),
  public.trainee_check_in(uuid, text, double precision, double precision, double precision, text), public.trainee_open_checkin(), public.session_mark_rest_absent(uuid)
  to authenticated;

-- Weekly attendance (for lateness trends), with the caller's RLS.
create or replace function public.cohort_weekly_attendance(p_cohort uuid)
returns table (week_start date, sessions integer, present integer, late integer, absent integer, excused integer)
language sql stable security invoker set search_path to 'public'
as $$
  select date_trunc('week', s.session_date)::date,
         count(distinct s.id)::int,
         count(*) filter (where sa.status = 'present')::int, count(*) filter (where sa.status = 'late')::int,
         count(*) filter (where sa.status = 'absent')::int, count(*) filter (where sa.status = 'excused')::int
  from public.cohort_sessions s left join public.session_attendance sa on sa.session_id = s.id
  where s.cohort_id = p_cohort and not s.canceled and s.session_date <= public.arizona_today()
  group by 1 order by 1;
$$;
revoke all on function public.cohort_weekly_attendance(uuid) from public, anon;
grant execute on function public.cohort_weekly_attendance(uuid) to authenticated;

-- Access rules for instructors ----------------------------------------------------------------------------------
alter table public.session_checkins enable row level security;
create policy session_checkins_read on public.session_checkins for select to authenticated
  using (public.manages_cohort(public.session_cohort(session_id)) or public.teaches_cohort(public.session_cohort(session_id)));
-- (no direct writes: windows are opened/closed through the functions above)

create policy applications_select_instructor on public.applications for select to authenticated
  using (public.has_role('instructor') and public.teaches_cohort(assigned_cohort_id));
create policy programs_select_instructor on public.programs for select to authenticated
  using (public.has_role('instructor') and exists (select 1 from public.cohorts c where c.program_id = programs.id and public.teaches_cohort(c.id)));

drop policy if exists cohort_sessions_read on public.cohort_sessions;
create policy cohort_sessions_read on public.cohort_sessions for select to authenticated
  using (public.manages_cohort(cohort_id) or public.teaches_cohort(cohort_id) or public.can_read_applicants() or public.in_cohort(cohort_id, true));

drop policy if exists session_attendance_read on public.session_attendance;
create policy session_attendance_read on public.session_attendance for select to authenticated
  using (public.manages_cohort(public.session_cohort(session_id)) or public.teaches_cohort(public.session_cohort(session_id))
         or public.can_read_applicants() or public.is_my_application(application_id));
-- Instructors may record or fix attendance for their cohorts' sessions on the day itself.
create policy session_attendance_instructor_insert on public.session_attendance for insert to authenticated
  with check (public.teaches_cohort(public.session_cohort(session_id)) and public.session_is_today(session_id)
              and public.app_in_cohort(application_id, public.session_cohort(session_id)));
create policy session_attendance_instructor_update on public.session_attendance for update to authenticated
  using (public.teaches_cohort(public.session_cohort(session_id)) and public.session_is_today(session_id))
  with check (public.teaches_cohort(public.session_cohort(session_id)) and public.session_is_today(session_id)
              and public.app_in_cohort(application_id, public.session_cohort(session_id)));

drop policy if exists cohort_instructors_read on public.cohort_instructors;
create policy cohort_instructors_read on public.cohort_instructors for select to authenticated
  using (public.can_read_applicants() or public.in_cohort(cohort_id, true) or public.manages_cohort(cohort_id) or public.teaches_cohort(cohort_id));
drop policy if exists instructors_read on public.instructors;
create policy instructors_read on public.instructors for select to authenticated
  using (public.can_read_applicants() or user_id = auth.uid() or exists (
    select 1 from public.cohort_instructors ci
    where ci.instructor_id = instructors.id and (public.in_cohort(ci.cohort_id, true) or public.manages_cohort(ci.cohort_id) or public.teaches_cohort(ci.cohort_id))));

-- Employers also see check-in timing (for lateness trends).
create or replace function public.employer_trainee_performance(p_app uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public'
as $$
declare v_cohort uuid; v jsonb;
begin
  select a.assigned_cohort_id into v_cohort
  from public.applications a
  where a.id = p_app and a.share_with_employers and a.status <> 'withdrawn'
    and exists (select 1 from public.program_partners pp
                where pp.program_id = a.program_id and pp.employer_org_id in (select public.my_employer_orgs()));
  if v_cohort is null then return null; end if;
  select jsonb_build_object(
    'modules', coalesce((
      select jsonb_agg(jsonb_build_object('name', m.name, 'score', g.score) order by m.sort, m.created_at)
      from public.cohort_modules m left join public.module_grades g on g.module_id = m.id and g.application_id = p_app
      where m.cohort_id = v_cohort), '[]'::jsonb),
    'attendance', coalesce((
      select jsonb_agg(jsonb_build_object('date', s.session_date, 'status', sa.status, 'minutes_after_open', sa.minutes_after_open) order by s.session_date)
      from public.cohort_sessions s join public.session_attendance sa on sa.session_id = s.id and sa.application_id = p_app
      where s.cohort_id = v_cohort and not s.canceled), '[]'::jsonb)
  ) into v;
  return v;
end;
$$;
