-- Program admins can customize the wording of every applicant email. A row overrides the built-in default for that
-- template; deleting the row restores the default. Bodies use the light formatting from src/lib/richtext.ts plus
-- {{placeholders}} such as {{first_name}} and {{assessment_link}}.
create table if not exists public.email_templates (
  key text primary key check (key ~ '^[a-z_]+$'),
  subject text not null check (length(trim(subject)) between 3 and 200),
  heading text not null check (length(trim(heading)) between 2 and 200),
  body text not null check (length(trim(body)) between 3 and 10000),
  cta_label text check (cta_label is null or length(cta_label) <= 80),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

alter table public.email_templates enable row level security;
-- Emails are sent from both staff and applicant sessions, so any signed-in user may read the wording.
drop policy if exists email_templates_read on public.email_templates;
create policy email_templates_read on public.email_templates for select to authenticated using (true);
drop policy if exists email_templates_write on public.email_templates;
create policy email_templates_write on public.email_templates for all to authenticated
  using (public.is_program_admin()) with check (public.is_program_admin());
