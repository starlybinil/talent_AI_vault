-- Roles granted by IT to an email that has no account yet are kept as pending grants and applied at signup,
-- replacing the default applicant role (unless applicant itself was granted).
create table if not exists public.pending_role_grants (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role public.app_role not null,
  employer_org_id uuid references public.employer_orgs(id) on delete cascade,
  granted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists pending_role_grants_email_role on public.pending_role_grants (lower(email), role);
alter table public.pending_role_grants enable row level security;
drop policy if exists pending_role_grants_select on public.pending_role_grants;
create policy pending_role_grants_select on public.pending_role_grants for select to authenticated using (public.has_role('it_admin'));

-- Grant: existing account -> role now; no account -> pending grant. Returns the user id, or null when pending.
create or replace function public.it_grant_role(p_email text, p_role public.app_role, p_org uuid default null)
returns uuid language plpgsql security definer set search_path to 'public'
as $$
declare
  v_user uuid;
  v_email text := lower(trim(p_email));
begin
  if not public.has_role('it_admin') then
    raise exception 'IT admin role required' using errcode = '42501';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Enter a valid email address' using errcode = '22023';
  end if;
  select id into v_user from public.profiles where lower(email) = v_email;
  if v_user is null then
    insert into public.pending_role_grants (email, role, employer_org_id, granted_by)
    values (v_email, p_role, case when p_role = 'employer' then p_org else null end, auth.uid())
    on conflict (lower(email), role) do update set employer_org_id = excluded.employer_org_id, granted_by = excluded.granted_by, created_at = now();
    insert into public.audit_log (actor_id, action, entity, entity_id, metadata)
    values (auth.uid(), 'role.grant_pending', 'user', null, jsonb_build_object('email', v_email, 'role', p_role, 'org', p_org));
    return null;
  end if;
  insert into public.user_roles (user_id, role, employer_org_id)
  values (v_user, p_role, case when p_role = 'employer' then p_org else null end)
  on conflict do nothing;
  insert into public.audit_log (actor_id, action, entity, entity_id, metadata)
  values (auth.uid(), 'role.grant', 'user', v_user::text, jsonb_build_object('role', p_role, 'org', p_org));
  return v_user;
end;
$$;

create or replace function public.it_cancel_pending_grant(p_id uuid)
returns void language plpgsql security definer set search_path to 'public'
as $$
declare
  v_row public.pending_role_grants;
begin
  if not public.has_role('it_admin') then
    raise exception 'IT admin role required' using errcode = '42501';
  end if;
  delete from public.pending_role_grants where id = p_id returning * into v_row;
  if found then
    insert into public.audit_log (actor_id, action, entity, entity_id, metadata)
    values (auth.uid(), 'role.grant_cancelled', 'user', null, jsonb_build_object('email', v_row.email, 'role', v_row.role));
  end if;
end;
$$;
revoke all on function public.it_cancel_pending_grant(uuid) from public, anon;
grant execute on function public.it_cancel_pending_grant(uuid) to authenticated, service_role;

-- Signup: apply pending grants for this email; otherwise the default applicant role.
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
    insert into public.audit_log (actor_id, action, entity, entity_id, metadata)
    select g.granted_by, 'role.grant_applied', 'user', new.id::text, jsonb_build_object('role', g.role, 'org', g.employer_org_id)
    from public.pending_role_grants g where lower(g.email) = lower(new.email);
    delete from public.pending_role_grants where lower(email) = lower(new.email);
  else
    insert into public.user_roles (user_id, role) values (new.id, 'applicant') on conflict do nothing;
  end if;
  return new;
end;
$$;
