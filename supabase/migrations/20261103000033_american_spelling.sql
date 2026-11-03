-- American spelling in applicant-facing text: the cohort-deletion timeline note says "canceled".
do $$
declare def text;
begin
  def := pg_get_functiondef('public.admin_delete_cohort'::regproc);
  if position('was cancelled' in def) > 0 then
    execute replace(def, 'was cancelled', 'was canceled');
  end if;
end $$;
