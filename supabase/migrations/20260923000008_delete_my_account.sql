-- Applicants can permanently delete their Talent-Vault account and all personal data.

-- Let users remove files in their own storage folder (resume, signatures, signed PDFs).
drop policy if exists applicant_files_delete on storage.objects;
create policy applicant_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'applicant-files' and (storage.foldername(name))[1] = (select auth.uid())::text);

create or replace function public.delete_my_account(p_confirm_email text)
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_cohort uuid;
  v_promoted uuid[] := '{}';
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  select email into v_email from public.profiles where id = v_uid;
  if lower(trim(coalesce(p_confirm_email, ''))) <> lower(coalesce(v_email, '')) then
    raise exception 'The email you typed does not match your account' using errcode = '22023';
  end if;
  if exists (select 1 from public.user_roles where user_id = v_uid and role <> 'applicant') then
    raise exception 'Staff and employer accounts are managed by your IT administrator' using errcode = '42501';
  end if;

  -- Free any seats / waitlist spots so the next person moves up.
  for v_cohort in
    update public.cohort_enrollments e set status = 'released'
    from public.applications a
    where e.application_id = a.id and a.user_id = v_uid and e.status in ('registered', 'waitlisted')
    returning e.cohort_id
  loop
    v_promoted := v_promoted || public.promote_waitlist(v_cohort);
  end loop;

  -- Remove email history that holds their address, then the account itself
  -- (profiles, roles, applications, events, messages, signatures cascade).
  delete from public.email_log where application_id in (select id from public.applications where user_id = v_uid)
    or lower(to_email) = lower(v_email);
  delete from public.applications where user_id = v_uid;
  delete from public.audit_log where actor_id = v_uid;
  delete from auth.users where id = v_uid;

  -- Anonymous record that a deletion happened (no personal data).
  insert into public.audit_log (actor_id, action, entity, entity_id, metadata)
  values (null, 'account.self_delete', 'user', null, jsonb_build_object('released_seats_promoted', coalesce(array_length(v_promoted, 1), 0)));

  return v_promoted;
end;
$$;

revoke execute on function public.delete_my_account(text) from public, anon;
grant execute on function public.delete_my_account(text) to authenticated;
