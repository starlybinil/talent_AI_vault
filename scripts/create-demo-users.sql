-- Creates one demo login per role. Run in the Supabase SQL editor after replacing __DEMO_PASSWORD__.
-- NEVER commit a real password. Delete these accounts (or rotate the password) before going live.
do $$
declare
  v_pw text := '__DEMO_PASSWORD__';
  v_org uuid := (select id from public.employer_orgs where name = 'TSMC Arizona');
  r record;
  v_id uuid;
begin
  for r in
    select * from (values
      ('applicant.demo@talent-vault.org',  'Alex Rivera',      null::public.app_role),
      ('admissions.demo@talent-vault.org', 'Jordan Admissions','program_admin'::public.app_role),
      ('it.demo@talent-vault.org',         'Casey IT',         'it_admin'::public.app_role),
      ('webdev.demo@talent-vault.org',     'Morgan Web',       'web_developer'::public.app_role),
      ('employer.demo@talent-vault.org',   'Taylor TSMC',      'employer'::public.app_role)
    ) as t(email, full_name, extra_role)
  loop
    select id into v_id from auth.users where email = r.email;
    if v_id is null then
      v_id := gen_random_uuid();
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, email_change, email_change_token_new, recovery_token
      ) values (
        '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', r.email,
        extensions.crypt(v_pw, extensions.gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', r.full_name), now(), now(), '', '', '', ''
      );
      insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      values (gen_random_uuid(), v_id, v_id::text,
        jsonb_build_object('sub', v_id::text, 'email', r.email, 'email_verified', true),
        'email', now(), now(), now());
    end if;

    if r.extra_role is not null then
      insert into public.user_roles (user_id, role, employer_org_id)
      values (v_id, r.extra_role, case when r.extra_role = 'employer' then v_org end)
      on conflict do nothing;
      -- Staff accounts are not applicants.
      delete from public.user_roles where user_id = v_id and role = 'applicant';
    end if;
  end loop;
end $$;
