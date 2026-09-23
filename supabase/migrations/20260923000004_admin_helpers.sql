-- Admin wrappers: withdraw with seat release, manual waitlist promotion.

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
  return v_promoted;
end;
$$;

create or replace function public.admin_promote_waitlist(p_cohort uuid)
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_program_admin() then
    raise exception 'Program admin role required' using errcode = '42501';
  end if;
  return public.promote_waitlist(p_cohort);
end;
$$;

-- Applicant withdrawal returns who got promoted so the app can email them.
drop function if exists public.applicant_withdraw(uuid, text);
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
  perform public._transition(p_app, 'withdrawn', coalesce(p_reason, 'Withdrawn by applicant'), auth.uid());
  for v_cohort in
    update public.cohort_enrollments set status = 'released'
    where application_id = p_app and status in ('registered', 'waitlisted')
    returning cohort_id
  loop
    v_promoted := v_promoted || public.promote_waitlist(v_cohort);
  end loop;
  return v_promoted;
end;
$$;

revoke execute on function public.admin_withdraw(uuid, text) from public, anon;
revoke execute on function public.admin_promote_waitlist(uuid) from public, anon;
revoke execute on function public.applicant_withdraw(uuid, text) from public, anon;
grant execute on function public.admin_withdraw(uuid, text) to authenticated;
grant execute on function public.admin_promote_waitlist(uuid) to authenticated;
grant execute on function public.applicant_withdraw(uuid, text) to authenticated;

-- Generated media is served from the Higgsfield CDN (see src/lib/media.ts), not these local paths.
update public.programs set hero_video = null, hero_poster = null where slug = 'asu-tsmc';
