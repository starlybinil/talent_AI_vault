-- Degree name (stored in "major") for associate's or higher, and the name of the program an applicant is enrolled in.
alter table public.applications add column if not exists current_program text check (current_program is null or length(current_program) <= 160);

do $$
declare def text;
begin
  def := pg_get_functiondef('public.submit_application(jsonb)'::regprocedure);
  def := replace(def, 'role_interest, cleanroom_willing, shift_willing, pay_range_accepted, acknowledged_at
  ) values (',
                      'role_interest, cleanroom_willing, shift_willing, pay_range_accepted, acknowledged_at, current_program
  ) values (');
  def := replace(def, '(p ->> ''shift_willing'')::boolean, (p ->> ''pay_range_accepted'')::boolean, now()
  ) returning id',
                      '(p ->> ''shift_willing'')::boolean, (p ->> ''pay_range_accepted'')::boolean, now(), nullif(trim(p ->> ''current_program''), '''')
  ) returning id');
  if position('nullif(trim(p ->> ''current_program'')' in def) = 0 then raise exception 'submit_application patch failed'; end if;
  execute def;
end $$;
