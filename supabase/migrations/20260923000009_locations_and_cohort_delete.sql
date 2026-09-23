-- Training locations managed in one place; cohorts pick one from a dropdown.
-- Program admins can also delete a cohort outright.

create table public.training_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index training_locations_name on public.training_locations (lower(name));
create trigger training_locations_touch before update on public.training_locations
  for each row execute function public.touch_updated_at();

alter table public.training_locations enable row level security;
create policy training_locations_select on public.training_locations for select to anon, authenticated using (true);
create policy training_locations_write on public.training_locations for all to authenticated
  using (public.is_program_admin()) with check (public.is_program_admin());

alter table public.cohorts add column location_id uuid references public.training_locations (id) on delete restrict;
create index cohorts_location on public.cohorts (location_id);

-- Existing cohorts: one location per distinct name.
insert into public.training_locations (name, address)
select distinct on (lower(location)) location, coalesce(address, location)
from public.cohorts order by lower(location), created_at;
update public.cohorts c set location_id = l.id from public.training_locations l where lower(l.name) = lower(c.location);

-- cohorts.location / address stay as a copy of the chosen location, so the schedule, emails and
-- calendar invites keep working unchanged. These triggers keep that copy in sync.
create or replace function public.cohort_fill_location()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.location_id is not null then
    select name, address into new.location, new.address from public.training_locations where id = new.location_id;
  end if;
  return new;
end;
$$;
create trigger cohorts_fill_location before insert or update of location_id on public.cohorts
  for each row execute function public.cohort_fill_location();

create or replace function public.location_sync_cohorts()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.cohorts set location = new.name, address = new.address where location_id = new.id;
  return new;
end;
$$;
create trigger training_locations_sync after update of name, address on public.training_locations
  for each row execute function public.location_sync_cohorts();

revoke execute on function public.cohort_fill_location() from public, anon, authenticated;
revoke execute on function public.location_sync_cohorts() from public, anon, authenticated;

-- Delete a cohort. Anyone holding a seat in it goes back to choosing cohorts; anyone only
-- waitlisted there (and nowhere else) does too. Returns the affected application ids.
create or replace function public.admin_delete_cohort(p_cohort uuid, p_note text default null)
returns uuid[] language plpgsql security definer set search_path = public as $$
declare
  v_name text;
  v_row record;
  v_affected uuid[] := '{}';
  v_actor uuid := auth.uid();
begin
  if not public.is_program_admin() then
    raise exception 'Program admin role required' using errcode = '42501';
  end if;
  select name into v_name from public.cohorts where id = p_cohort for update;
  if not found then
    raise exception 'Cohort not found' using errcode = 'P0002';
  end if;

  for v_row in
    select e.application_id, e.status as enr_status, a.status as app_status
    from public.cohort_enrollments e join public.applications a on a.id = e.application_id
    where e.cohort_id = p_cohort and e.status in ('registered', 'waitlisted')
    for update of a
  loop
    delete from public.cohort_enrollments where application_id = v_row.application_id and cohort_id = p_cohort;
    -- Still waitlisted somewhere else? Leave them there.
    continue when v_row.enr_status = 'waitlisted'
      and exists (select 1 from public.cohort_enrollments where application_id = v_row.application_id and status = 'waitlisted');

    update public.cohort_enrollments set status = 'released'
      where application_id = v_row.application_id and status in ('registered', 'waitlisted');
    update public.applications set assigned_cohort_id = null, confirmed_at = null where id = v_row.application_id;
    delete from public.cohort_preferences where application_id = v_row.application_id;
    delete from public.agreement_signatures where application_id = v_row.application_id;
    if v_row.app_status <> 'cohort_selection' then
      perform public._transition(v_row.application_id, 'cohort_selection',
        'Cohort "' || v_name || '" was cancelled' || coalesce(': ' || nullif(trim(p_note), ''), '') || '. Please choose new cohorts.',
        v_actor);
    end if;
    v_affected := v_affected || v_row.application_id;
  end loop;

  update public.applications set assigned_cohort_id = null where assigned_cohort_id = p_cohort;
  delete from public.cohorts where id = p_cohort;

  insert into public.audit_log (actor_id, action, entity, entity_id, metadata)
  values (v_actor, 'cohort.delete', 'cohort', p_cohort::text,
    jsonb_build_object('name', v_name, 'applicants_moved', coalesce(array_length(v_affected, 1), 0)));
  return v_affected;
end;
$$;

revoke execute on function public.admin_delete_cohort(uuid, text) from public, anon;
grant execute on function public.admin_delete_cohort(uuid, text) to authenticated;
