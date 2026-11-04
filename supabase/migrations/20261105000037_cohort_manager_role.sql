-- New user type: cohort manager (monitors grades and attendance for every cohort in their assigned programs).
alter type public.app_role add value if not exists 'cohort_manager';
