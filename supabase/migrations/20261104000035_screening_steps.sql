-- Screening has three steps in order:
--   1. Invite to a video call to verify information (email with a scheduling link)
--   2. Verified: send the employer (TSMC) application link
--   3. Pass screening & send assessment (existing)
alter table public.programs
  add column if not exists verification_scheduling_url text,
  add column if not exists employer_application_url text;

alter table public.applications
  add column if not exists verification_invited_at timestamptz,
  add column if not exists verification_url text,
  add column if not exists verified_at timestamptz,
  add column if not exists employer_application_sent_at timestamptz,
  add column if not exists employer_application_url text;

create or replace function public.admin_screening_step(p_app uuid, p_step text, p_url text)
returns void language plpgsql security definer set search_path to 'public'
as $$
declare
  v_status public.application_status;
  v_note text;
begin
  if not public.is_program_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if coalesce(p_url, '') !~ '^https://' then
    raise exception 'Enter a link that starts with https://' using errcode = '22023';
  end if;
  select status into v_status from public.applications where id = p_app for update;
  if v_status is null then
    raise exception 'Application not found' using errcode = 'P0002';
  end if;
  if v_status not in ('submitted', 'screening') then
    raise exception 'Screening steps apply only while the application is in screening' using errcode = '22023';
  end if;

  if p_step = 'verification_invite' then
    update public.applications
       set verification_invited_at = now(), verification_url = p_url, status = 'screening', updated_at = now()
     where id = p_app;
    v_note := 'Invited to a video call to verify your information';
  elsif p_step = 'verified' then
    update public.applications
       set verified_at = now(), employer_application_sent_at = now(), employer_application_url = p_url, status = 'screening', updated_at = now()
     where id = p_app;
    v_note := 'Information verified. Employer application link sent';
  else
    raise exception 'Unknown screening step' using errcode = '22023';
  end if;

  insert into public.application_events (application_id, from_status, to_status, actor_id, note)
  values (p_app, v_status, 'screening', auth.uid(), v_note);
end;
$$;
revoke all on function public.admin_screening_step(uuid, text, text) from public, anon;
grant execute on function public.admin_screening_step(uuid, text, text) to authenticated;

