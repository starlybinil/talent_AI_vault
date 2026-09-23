-- Talent-Vault Training Programs: row level security
-- Principle: clients read through RLS; workflow writes go through SECURITY DEFINER RPCs that check roles.

alter table public.profiles enable row level security;
alter table public.employer_orgs enable row level security;
alter table public.user_roles enable row level security;
alter table public.programs enable row level security;
alter table public.program_partners enable row level security;
alter table public.cohorts enable row level security;
alter table public.applications enable row level security;
alter table public.application_events enable row level security;
alter table public.cohort_preferences enable row level security;
alter table public.cohort_enrollments enable row level security;
alter table public.agreement_templates enable row level security;
alter table public.agreement_signatures enable row level security;
alter table public.messages enable row level security;
alter table public.employer_shortlist enable row level security;
alter table public.employer_notes enable row level security;
alter table public.email_log enable row level security;
alter table public.audit_log enable row level security;
alter table public.site_content enable row level security;
alter table public.feature_flags enable row level security;
alter table public.system_settings enable row level security;
alter table public.cron_runs enable row level security;

-- profiles --------------------------------------------------------------------
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.can_read_applicants());
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()) and active);

-- user_roles -----------------------------------------------------------------
create policy user_roles_select on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()) or public.has_role('it_admin'));

-- employer_orgs --------------------------------------------------------------
create policy employer_orgs_select on public.employer_orgs for select to authenticated
  using (
    public.can_read_applicants()
    or public.has_role('web_developer')
    or id in (select public.my_employer_orgs())
  );
create policy employer_orgs_write on public.employer_orgs for all to authenticated
  using (public.has_role('it_admin') or public.is_program_admin())
  with check (public.has_role('it_admin') or public.is_program_admin());

-- programs (public catalog) --------------------------------------------------
create policy programs_select on public.programs for select to anon, authenticated
  using (active or public.is_program_admin() or public.has_role('web_developer') or public.has_role('it_admin'));
create policy programs_insert on public.programs for insert to authenticated
  with check (public.is_program_admin());
create policy programs_update on public.programs for update to authenticated
  using (public.is_program_admin() or public.has_role('web_developer'))
  with check (public.is_program_admin() or public.has_role('web_developer'));
create policy programs_delete on public.programs for delete to authenticated
  using (public.is_program_admin());

create policy program_partners_select on public.program_partners for select to authenticated
  using (public.can_read_applicants() or employer_org_id in (select public.my_employer_orgs()));
create policy program_partners_write on public.program_partners for all to authenticated
  using (public.is_program_admin()) with check (public.is_program_admin());

-- cohorts (public schedule) --------------------------------------------------
create policy cohorts_select on public.cohorts for select to anon, authenticated
  using (status <> 'archived' or public.is_program_admin());
create policy cohorts_write on public.cohorts for all to authenticated
  using (public.is_program_admin()) with check (public.is_program_admin());

-- applications ---------------------------------------------------------------
create policy applications_select on public.applications for select to authenticated
  using (user_id = (select auth.uid()) or public.can_read_applicants());

create policy application_events_select on public.application_events for select to authenticated
  using (
    public.can_read_applicants()
    or exists (select 1 from public.applications a where a.id = application_id and a.user_id = (select auth.uid()))
  );

create policy cohort_preferences_select on public.cohort_preferences for select to authenticated
  using (
    public.can_read_applicants()
    or exists (select 1 from public.applications a where a.id = application_id and a.user_id = (select auth.uid()))
  );

create policy cohort_enrollments_select on public.cohort_enrollments for select to authenticated
  using (
    public.can_read_applicants()
    or exists (select 1 from public.applications a where a.id = application_id and a.user_id = (select auth.uid()))
  );

-- agreements -----------------------------------------------------------------
create policy agreement_templates_select on public.agreement_templates for select to authenticated
  using (active or public.is_program_admin());
create policy agreement_templates_write on public.agreement_templates for all to authenticated
  using (public.is_program_admin()) with check (public.is_program_admin());

create policy agreement_signatures_select on public.agreement_signatures for select to authenticated
  using (
    public.can_read_applicants()
    or exists (select 1 from public.applications a where a.id = application_id and a.user_id = (select auth.uid()))
  );

-- messages -------------------------------------------------------------------
create policy messages_select on public.messages for select to authenticated
  using (
    public.can_read_applicants()
    or (
      not internal
      and exists (select 1 from public.applications a where a.id = application_id and a.user_id = (select auth.uid()))
    )
  );
create policy messages_insert on public.messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and (
      public.is_program_admin()
      or (
        not internal
        and exists (select 1 from public.applications a where a.id = application_id and a.user_id = (select auth.uid()))
      )
    )
  );
create policy messages_mark_read on public.messages for update to authenticated
  using (
    public.is_program_admin()
    or exists (select 1 from public.applications a where a.id = application_id and a.user_id = (select auth.uid()))
  )
  with check (true);

-- employer collaboration -----------------------------------------------------
create policy employer_shortlist_select on public.employer_shortlist for select to authenticated
  using (public.can_read_applicants() or employer_org_id in (select public.my_employer_orgs()));
create policy employer_notes_select on public.employer_notes for select to authenticated
  using (public.can_read_applicants() or employer_org_id in (select public.my_employer_orgs()));

-- operations -----------------------------------------------------------------
create policy email_log_select on public.email_log for select to authenticated
  using (public.can_read_applicants());

create policy audit_log_select on public.audit_log for select to authenticated
  using (public.has_role('it_admin'));

create policy site_content_select on public.site_content for select to anon, authenticated using (true);
create policy site_content_write on public.site_content for all to authenticated
  using (public.has_role('web_developer')) with check (public.has_role('web_developer'));

create policy feature_flags_select on public.feature_flags for select to anon, authenticated using (true);
create policy feature_flags_write on public.feature_flags for all to authenticated
  using (public.has_role('web_developer') or public.has_role('it_admin'))
  with check (public.has_role('web_developer') or public.has_role('it_admin'));

create policy system_settings_select on public.system_settings for select to authenticated
  using (public.has_role('it_admin') or public.is_program_admin());
create policy system_settings_write on public.system_settings for all to authenticated
  using (public.has_role('it_admin')) with check (public.has_role('it_admin'));

create policy cron_runs_select on public.cron_runs for select to authenticated
  using (public.has_role('it_admin') or public.has_role('web_developer'));

-- Column-level hardening: messages may only have read_at changed by clients.
revoke update on public.messages from authenticated;
grant update (read_at) on public.messages to authenticated;
-- Profiles: users may only change their own name/phone.
revoke update on public.profiles from authenticated;
grant update (full_name, phone) on public.profiles to authenticated;
-- Anonymous visitors never write.
revoke insert, update, delete on all tables in schema public from anon;

-- ---------------------------------------------------------------------------
-- Storage: one private bucket, per-user folders ({user_id}/...)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'applicant-files',
  'applicant-files',
  false,
  5242880,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png'
  ]
)
on conflict (id) do nothing;

create policy applicant_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'applicant-files' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy applicant_files_update on storage.objects for update to authenticated
  using (bucket_id = 'applicant-files' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy applicant_files_select on storage.objects for select to authenticated
  using (
    bucket_id = 'applicant-files'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.can_read_applicants()
      or exists (
        select 1
        from public.applications a
        join public.programs p on p.id = a.program_id
        where a.resume_path = storage.objects.name
          and 'resume' = any (p.employer_visible_fields)
          and public.employer_can_view_application(a.id)
      )
    )
  );
