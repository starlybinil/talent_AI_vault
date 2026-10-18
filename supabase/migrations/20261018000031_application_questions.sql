-- Align the application with the ET Program Admissions Process deck:
-- eligibility (age, work authorization, future sponsorship, experience), education + STEM degree,
-- role & pay fit (informational, not used to filter) and a required applicant acknowledgement.

alter type public.education_level add value if not exists 'no_hs' before 'hs_ged';

alter table public.applications
  add column if not exists work_authorized boolean,
  add column if not exists work_experience text check (work_experience in ('0_5', '6_10', '10_plus')),
  add column if not exists stem_degree_completed boolean,
  add column if not exists stem_degree_enrolled boolean,
  add column if not exists role_interest boolean,
  add column if not exists cleanroom_willing text check (cleanroom_willing in ('yes', 'no', 'unsure')),
  add column if not exists shift_willing boolean,
  add column if not exists pay_range_accepted boolean,
  add column if not exists acknowledged_at timestamptz;

comment on column public.applications.role_interest is 'Role & pay answers are informational; they are not used to filter for qualification.';

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
  if coalesce((p ->> 'acknowledged')::boolean, false) is not true then
    raise exception 'Please certify and acknowledge the application statements' using errcode = '22023';
  end if;
  if (p ->> 'resume_path') is not null and split_part(p ->> 'resume_path', '/', 1) <> auth.uid()::text then
    raise exception 'Invalid resume path' using errcode = '42501';
  end if;
  select email into v_email from public.profiles where id = auth.uid();
  insert into public.applications (
    program_id, user_id, first_name, last_name, email, phone, highest_education, major, resume_path, visa_sponsorship,
    will_be_18_by_completion, share_with_employers, utm_source, utm_medium, utm_campaign, status,
    work_authorized, work_experience, stem_degree_completed, stem_degree_enrolled,
    role_interest, cleanroom_willing, shift_willing, pay_range_accepted, acknowledged_at
  ) values (
    v_program, auth.uid(), trim(p ->> 'first_name'), trim(p ->> 'last_name'),
    coalesce(nullif(trim(p ->> 'email'), ''), v_email), trim(p ->> 'phone'),
    (p ->> 'highest_education')::public.education_level, nullif(trim(p ->> 'major'), ''), nullif(p ->> 'resume_path', ''),
    (p ->> 'visa_sponsorship')::public.visa_need, (p ->> 'will_be_18_by_completion')::boolean,
    coalesce((p ->> 'share_with_employers')::boolean, false),
    nullif(p ->> 'utm_source', ''), nullif(p ->> 'utm_medium', ''), nullif(p ->> 'utm_campaign', ''),
    'screening',
    (p ->> 'work_authorized')::boolean, nullif(p ->> 'work_experience', ''),
    (p ->> 'stem_degree_completed')::boolean, (p ->> 'stem_degree_enrolled')::boolean,
    (p ->> 'role_interest')::boolean, nullif(p ->> 'cleanroom_willing', ''),
    (p ->> 'shift_willing')::boolean, (p ->> 'pay_range_accepted')::boolean, now()
  ) returning id into v_id;
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

-- The deck replaces "major" with the STEM degree questions, so a degree no longer requires a major.
alter table public.applications drop constraint if exists degree_needs_major;
