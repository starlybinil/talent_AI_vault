-- "Reset to start of application process" now takes the applicant back to the very beginning: the application is
-- removed so they fill in the application form again. Seats/waitlist spots are released first (next person promoted),
-- and a full snapshot (application, timeline, choices, signatures, messages) is kept in the audit log.
create or replace function public.admin_reset_application(p_app uuid, p_note text default null)
returns uuid[] language plpgsql security definer set search_path to 'public'
as $$
declare
  v_app public.applications;
  v_cohort uuid;
  v_promoted uuid[] := '{}';
  v_snapshot jsonb;
begin
  if not public.is_program_admin() then
    raise exception 'Program admin role required' using errcode = '42501';
  end if;
  select * into v_app from public.applications where id = p_app for update;
  if not found then
    raise exception 'Application not found' using errcode = 'P0002';
  end if;
  if v_app.status::text in ('completed', 'hired') then
    raise exception 'Completed trainees can''t be reset; undo the outcome first' using errcode = '22023';
  end if;

  v_snapshot := jsonb_build_object(
    'application', to_jsonb(v_app),
    'note', nullif(trim(p_note), ''),
    'events', coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at) from public.application_events e where e.application_id = p_app), '[]'),
    'cohort_choices', coalesce((select jsonb_agg(jsonb_build_object('cohort_id', p.cohort_id, 'rank', p.rank) order by p.rank) from public.cohort_preferences p where p.application_id = p_app), '[]'),
    'enrollments', coalesce((select jsonb_agg(jsonb_build_object('cohort_id', x.cohort_id, 'status', x.status)) from public.cohort_enrollments x where x.application_id = p_app), '[]'),
    'signatures', coalesce((select jsonb_agg(jsonb_build_object('template_id', s.template_id, 'version', s.template_version, 'typed_name', s.typed_name,
        'signed_at', s.signed_at, 'ip', s.ip, 'pdf_path', s.pdf_path, 'signature_path', s.signature_path)) from public.agreement_signatures s where s.application_id = p_app), '[]'),
    'messages', coalesce((select jsonb_agg(jsonb_build_object('sender_id', m.sender_id, 'internal', m.internal, 'body', m.body, 'created_at', m.created_at) order by m.created_at)
        from public.messages m where m.application_id = p_app), '[]')
  );

  -- Free any seat or waitlist spot and move the next person up.
  for v_cohort in
    update public.cohort_enrollments set status = 'released'
    where application_id = p_app and status in ('registered', 'waitlisted') returning cohort_id
  loop
    v_promoted := v_promoted || public.promote_waitlist(v_cohort);
  end loop;

  insert into public.audit_log (actor_id, action, entity, entity_id, metadata)
  values (auth.uid(), 'application.reset', 'application', p_app::text, v_snapshot);

  delete from public.applications where id = p_app;
  return v_promoted;
end;
$$;
revoke all on function public.admin_reset_application(uuid, text) from public, anon;
grant execute on function public.admin_reset_application(uuid, text) to authenticated, service_role;
