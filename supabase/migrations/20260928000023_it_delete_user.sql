-- IT admins can permanently delete any user account (applicant, staff or employer).
-- Frees any cohort seat (waitlist promoted), removes their applications and email history, then the auth user
-- (profile, roles, practice attempts cascade). Actions they took as staff stay on record with the actor cleared.
create or replace function public.it_delete_user(p_user uuid, p_confirm_email text)
returns uuid[] language plpgsql security definer set search_path to 'public'
as $$
declare
  v_email text;
  v_roles text[];
  v_cohort uuid;
  v_promoted uuid[] := '{}';
  v_apps integer;
begin
  if not public.has_role('it_admin') then
    raise exception 'IT admin role required' using errcode = '42501';
  end if;
  if p_user = auth.uid() then
    raise exception 'You cannot delete your own account here' using errcode = '22023';
  end if;
  select coalesce(p.email, u.email) into v_email
  from auth.users u left join public.profiles p on p.id = u.id where u.id = p_user;
  if not found then
    raise exception 'User not found' using errcode = 'P0002';
  end if;
  if lower(trim(coalesce(p_confirm_email, ''))) <> lower(coalesce(v_email, '')) then
    raise exception 'Type the user''s email address exactly to confirm' using errcode = '22023';
  end if;
  select coalesce(array_agg(role::text order by role), '{}') into v_roles from public.user_roles where user_id = p_user;
  if 'it_admin' = any(v_roles) and (select count(distinct user_id) from public.user_roles where role = 'it_admin') <= 1 then
    raise exception 'This is the last IT admin; grant the role to someone else first' using errcode = '22023';
  end if;

  for v_cohort in
    update public.cohort_enrollments e set status = 'released'
    from public.applications a
    where e.application_id = a.id and a.user_id = p_user and e.status in ('registered', 'waitlisted')
    returning e.cohort_id
  loop
    v_promoted := v_promoted || public.promote_waitlist(v_cohort);
  end loop;

  select count(*) into v_apps from public.applications where user_id = p_user;
  delete from public.email_log
  where application_id in (select id from public.applications where user_id = p_user) or lower(to_email) = lower(v_email);
  delete from public.applications where user_id = p_user;
  delete from auth.users where id = p_user;

  -- Record who removed which kind of account, without keeping the person's full email address.
  insert into public.audit_log (actor_id, action, entity, entity_id, metadata)
  values (auth.uid(), 'user.delete', 'user', p_user::text, jsonb_build_object(
    'email', regexp_replace(v_email, '^(.).*(@.*)$', '\1***\2'),
    'roles', to_jsonb(v_roles), 'applications_removed', v_apps,
    'waitlist_promoted', coalesce(array_length(v_promoted, 1), 0)));
  return v_promoted;
end;
$$;
revoke all on function public.it_delete_user(uuid, text) from public, anon;
grant execute on function public.it_delete_user(uuid, text) to authenticated, service_role;
