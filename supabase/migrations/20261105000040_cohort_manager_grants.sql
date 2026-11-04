-- Cohort manager invitations carry their programs, applied when the person registers.
alter table public.pending_role_grants add column if not exists program_ids uuid[];

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
    -- Cohort managers: the programs chosen when they were invited.
    insert into public.cohort_manager_programs (user_id, program_id)
    select new.id, p from public.pending_role_grants g, unnest(coalesce(g.program_ids, '{}')) p
    where lower(g.email) = lower(new.email) and g.role = 'cohort_manager'
      and exists (select 1 from public.programs where id = p)
    on conflict do nothing;
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
