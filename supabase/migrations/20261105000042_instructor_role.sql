-- New user type: instructor (runs QR attendance check-in for the cohorts they teach).
alter type public.app_role add value if not exists 'instructor';
