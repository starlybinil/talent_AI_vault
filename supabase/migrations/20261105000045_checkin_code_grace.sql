-- Accept the current code and the two before it (up to ~90 s), so a trainee who scans and then signs in isn't rejected.
do $$
declare def text;
begin
  def := pg_get_functiondef('public.trainee_check_in(uuid, text, double precision, double precision, double precision, text)'::regprocedure);
  def := replace(def, 'public.checkin_code(w.secret, v_step), public.checkin_code(w.secret, v_step - 1))',
                      'public.checkin_code(w.secret, v_step), public.checkin_code(w.secret, v_step - 1), public.checkin_code(w.secret, v_step - 2))');
  if position('v_step - 2' in def) = 0 then raise exception 'patch failed'; end if;
  execute def;
end $$;
