-- STEM degree questions get an "Unsure" option: yes / no / unsure.
alter table public.applications
  alter column stem_degree_completed type text using case stem_degree_completed when true then 'yes' when false then 'no' end,
  alter column stem_degree_enrolled type text using case stem_degree_enrolled when true then 'yes' when false then 'no' end;
alter table public.applications
  add constraint stem_degree_completed_check check (stem_degree_completed in ('yes', 'no', 'unsure')),
  add constraint stem_degree_enrolled_check check (stem_degree_enrolled in ('yes', 'no', 'unsure'));

-- submit_application stores the answer text as-is.
do $$
declare def text;
begin
  def := pg_get_functiondef('public.submit_application(jsonb)'::regprocedure);
  def := replace(def, '(p ->> ''stem_degree_completed'')::boolean, (p ->> ''stem_degree_enrolled'')::boolean',
                      'nullif(p ->> ''stem_degree_completed'', ''''), nullif(p ->> ''stem_degree_enrolled'', '''')');
  execute def;
end $$;
