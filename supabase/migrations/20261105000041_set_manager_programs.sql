-- IT sets which programs a cohort manager covers: for an existing user, or on their pending invitation.
create or replace function public.it_set_manager_programs(p_email text, p_programs uuid[])
returns void language plpgsql security definer set search_path to 'public'
as $$
declare v_user uuid; v_email text := lower(trim(p_email));
begin
  if not public.has_role('it_admin') then
    raise exception 'IT admin role required' using errcode = '42501';
  end if;
  select id into v_user from public.profiles where lower(email) = v_email;
  if v_user is null then
    update public.pending_role_grants set program_ids = p_programs
     where lower(email) = v_email and role = 'cohort_manager';
  else
    delete from public.cohort_manager_programs where user_id = v_user and not (program_id = any (coalesce(p_programs, '{}')));
    insert into public.cohort_manager_programs (user_id, program_id)
    select v_user, p from unnest(coalesce(p_programs, '{}')) p where exists (select 1 from public.programs where id = p)
    on conflict do nothing;
  end if;
  insert into public.audit_log (actor_id, action, entity, entity_id, metadata)
  values (auth.uid(), 'role.manager_programs', 'user', v_user::text, jsonb_build_object('email', v_email, 'programs', p_programs));
end;
$$;
revoke all on function public.it_set_manager_programs(text, uuid[]) from public, anon;
grant execute on function public.it_set_manager_programs(text, uuid[]) to authenticated;
