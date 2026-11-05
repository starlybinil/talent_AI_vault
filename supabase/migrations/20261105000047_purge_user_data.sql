-- Deactivating or deleting a user (IT admins) removes everything tied to them.
-- Files in storage are removed by the app through the Storage API (direct SQL deletes on storage.objects are blocked),
-- so IT admins may now delete objects in the applicant-files bucket.

create policy applicant_files_it_delete on storage.objects for delete to authenticated
  using (bucket_id = 'applicant-files' and public.has_role('it_admin'));

-- Shared clean-up: frees cohort seats (promoting the waitlist), then removes the user's applications and everything
-- hanging off them (events, cohort choices, enrollments, signatures, messages, employer shortlist/notes, grades,
-- attendance), email history, audit entries about those applications, practice attempts, pending invitations,
-- cohort-manager programs and the instructor-directory link. Returns applications promoted off a waitlist.
create or replace function public.purge_user_data(p_user uuid)
returns uuid[] language plpgsql security definer set search_path to 'public'
as $$
declare
  v_email text; v_cohort uuid; v_promoted uuid[] := '{}'; v_apps uuid[];
  v_staff boolean := exists (select 1 from public.user_roles where user_id = p_user and role <> 'applicant');
begin
  select coalesce(p.email, u.email) into v_email from auth.users u left join public.profiles p on p.id = u.id where u.id = p_user;
  select coalesce(array_agg(id), '{}') into v_apps from public.applications where user_id = p_user;

  for v_cohort in
    update public.cohort_enrollments e set status = 'released'
    where e.application_id = any(v_apps) and e.status in ('registered', 'waitlisted')
    returning e.cohort_id
  loop
    v_promoted := v_promoted || public.promote_waitlist(v_cohort);
  end loop;

  delete from public.email_log where application_id = any(v_apps) or (v_email is not null and lower(to_email) = lower(v_email));
  delete from public.audit_log where entity_id = any(array(select unnest(v_apps)::text));
  delete from public.applications where id = any(v_apps);
  delete from public.practice_attempts where user_id = p_user;
  delete from public.pending_role_grants where v_email is not null and lower(email) = lower(v_email);
  delete from public.cohort_manager_programs where user_id = p_user;
  update public.instructors set user_id = null where user_id = p_user;
  -- An applicant's own activity (sign-ins, file views) is personal data. A staff member's actions on other
  -- records stay on the audit trail for accountability.
  if not v_staff then
    delete from public.audit_log where actor_id = p_user;
  end if;
  return v_promoted;
end;
$$;
revoke all on function public.purge_user_data(uuid) from public, anon, authenticated;

create or replace function public.it_check_user(p_user uuid, p_confirm_email text)
returns text language plpgsql security definer set search_path to 'public'
as $$
declare v_email text;
begin
  if not public.has_role('it_admin') then raise exception 'IT admin role required' using errcode = '42501'; end if;
  if p_user = auth.uid() then raise exception 'You cannot do this to your own account' using errcode = '22023'; end if;
  select coalesce(p.email, u.email) into v_email from auth.users u left join public.profiles p on p.id = u.id where u.id = p_user;
  if not found then raise exception 'User not found' using errcode = 'P0002'; end if;
  if lower(trim(coalesce(p_confirm_email, ''))) <> lower(coalesce(v_email, '')) then
    raise exception 'Type the user''s email address exactly to confirm' using errcode = '22023';
  end if;
  if exists (select 1 from public.user_roles where user_id = p_user and role = 'it_admin')
     and (select count(distinct user_id) from public.user_roles where role = 'it_admin') <= 1 then
    raise exception 'This is the last IT admin; grant the role to someone else first' using errcode = '22023';
  end if;
  return v_email;
end;
$$;
revoke all on function public.it_check_user(uuid, text) from public, anon;
grant execute on function public.it_check_user(uuid, text) to authenticated;

create or replace function public.it_delete_user(p_user uuid, p_confirm_email text)
returns uuid[] language plpgsql security definer set search_path to 'public'
as $$
declare v_email text := public.it_check_user(p_user, p_confirm_email); v_roles text[]; v_promoted uuid[]; v_apps integer;
begin
  select coalesce(array_agg(role::text order by role), '{}') into v_roles from public.user_roles where user_id = p_user;
  select count(*) into v_apps from public.applications where user_id = p_user;
  v_promoted := public.purge_user_data(p_user);
  delete from auth.users where id = p_user;  -- profile, roles and sessions cascade
  insert into public.audit_log (actor_id, action, entity, entity_id, metadata)
  values (auth.uid(), 'user.delete', 'user', p_user::text, jsonb_build_object(
    'email', regexp_replace(v_email, '^(.).*(@.*)$', '\1***\2'), 'roles', to_jsonb(v_roles),
    'applications_removed', v_apps, 'waitlist_promoted', coalesce(array_length(v_promoted, 1), 0)));
  return v_promoted;
end;
$$;

-- Deactivate: sign the user out, block sign-in, and remove all their data and roles. The (now empty) login is kept so
-- it can be reactivated later. Reactivate: unblock sign-in as a plain applicant account.
drop function if exists public.it_set_user_active(uuid, boolean);
create or replace function public.it_set_user_active(p_user uuid, p_active boolean, p_confirm_email text default null)
returns uuid[] language plpgsql security definer set search_path to 'public'
as $$
declare v_email text; v_roles text[]; v_promoted uuid[] := '{}'; v_apps integer;
begin
  if p_active then
    if not public.has_role('it_admin') then raise exception 'IT admin role required' using errcode = '42501'; end if;
    update public.profiles set active = true where id = p_user;
    update auth.users set banned_until = null where id = p_user;
    insert into public.user_roles (user_id, role)
      select p_user, 'applicant' where not exists (select 1 from public.user_roles where user_id = p_user);
    insert into public.audit_log (actor_id, action, entity, entity_id, metadata) values (auth.uid(), 'user.activate', 'user', p_user::text, '{}'::jsonb);
    return v_promoted;
  end if;

  v_email := public.it_check_user(p_user, p_confirm_email);
  select coalesce(array_agg(role::text order by role), '{}') into v_roles from public.user_roles where user_id = p_user;
  select count(*) into v_apps from public.applications where user_id = p_user;
  v_promoted := public.purge_user_data(p_user);
  delete from public.user_roles where user_id = p_user;
  update public.profiles set active = false, full_name = null, phone = null where id = p_user;
  update auth.users set banned_until = 'infinity', raw_user_meta_data = '{}'::jsonb where id = p_user;
  delete from auth.sessions where user_id = p_user;
  delete from auth.refresh_tokens where user_id = p_user::text;
  insert into public.audit_log (actor_id, action, entity, entity_id, metadata)
  values (auth.uid(), 'user.deactivate', 'user', p_user::text, jsonb_build_object(
    'roles', to_jsonb(v_roles), 'applications_removed', v_apps, 'waitlist_promoted', coalesce(array_length(v_promoted, 1), 0)));
  return v_promoted;
end;
$$;
revoke all on function public.it_set_user_active(uuid, boolean, text) from public, anon;
grant execute on function public.it_set_user_active(uuid, boolean, text) to authenticated;

-- Self-service deletion uses the same clean-up.
create or replace function public.delete_my_account(p_confirm_email text)
returns uuid[] language plpgsql security definer set search_path to 'public'
as $$
declare v_uid uuid := auth.uid(); v_email text; v_promoted uuid[];
begin
  if v_uid is null then raise exception 'Not signed in' using errcode = '28000'; end if;
  select email into v_email from public.profiles where id = v_uid;
  if lower(trim(coalesce(p_confirm_email, ''))) <> lower(coalesce(v_email, '')) then
    raise exception 'The email you typed does not match your account' using errcode = '22023';
  end if;
  if exists (select 1 from public.user_roles where user_id = v_uid and role <> 'applicant') then
    raise exception 'Staff and employer accounts are managed by your IT administrator' using errcode = '42501';
  end if;
  v_promoted := public.purge_user_data(v_uid);
  delete from public.audit_log where actor_id = v_uid;
  delete from auth.users where id = v_uid;
  insert into public.audit_log (actor_id, action, entity, entity_id, metadata)
  values (null, 'account.self_delete', 'user', null, jsonb_build_object('released_seats_promoted', coalesce(array_length(v_promoted, 1), 0)));
  return v_promoted;
end;
$$;

-- Files left in storage by accounts that no longer exist (IT admins), for the one-click clean-up.
create or replace function public.it_orphan_files()
returns setof text language plpgsql stable security definer set search_path to 'public'
as $$
begin
  if not public.has_role('it_admin') then raise exception 'IT admin role required' using errcode = '42501'; end if;
  return query
    select o.name from storage.objects o
    where o.bucket_id = 'applicant-files'
      and not exists (select 1 from auth.users u where u.id::text = split_part(o.name, '/', 1))
    order by o.name;
end;
$$;
revoke all on function public.it_orphan_files() from public, anon;
grant execute on function public.it_orphan_files() to authenticated;
