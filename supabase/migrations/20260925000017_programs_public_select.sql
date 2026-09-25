-- Visitors (anon) may not execute the role-check helpers, so a single SELECT policy that calls them
-- fails with "permission denied" as soon as any inactive program exists, and the public catalog goes blank.
-- Split it: anon sees active programs; signed-in staff additionally see drafts.
drop policy if exists programs_select on public.programs;

create policy programs_select_public on public.programs
  for select to anon
  using (active);

create policy programs_select on public.programs
  for select to authenticated
  using (active or public.is_program_admin() or public.has_role('web_developer') or public.has_role('it_admin'));

-- Same problem on cohorts: an archived cohort would break the public cohort list.
drop policy if exists cohorts_select on public.cohorts;

create policy cohorts_select_public on public.cohorts
  for select to anon
  using (status <> 'archived');

create policy cohorts_select on public.cohorts
  for select to authenticated
  using (status <> 'archived' or public.is_program_admin());
