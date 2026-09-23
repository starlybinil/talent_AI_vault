-- Employers can't read applications directly; this returns the resume path only when the
-- program's employer policy exposes resumes and the applicant consented.
create or replace function public.employer_resume_path(p_app uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select a.resume_path
  from public.applications a
  join public.programs p on p.id = a.program_id
  where a.id = p_app
    and 'resume' = any (p.employer_visible_fields)
    and public.employer_can_view_application(a.id);
$$;

revoke execute on function public.employer_resume_path(uuid) from public, anon;
grant execute on function public.employer_resume_path(uuid) to authenticated;
