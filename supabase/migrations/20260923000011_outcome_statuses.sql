-- Two outcome stages after "confirmed": the trainee completes the program, then gets hired.
-- (Enum values are added in their own migration so they're committed before any function uses them.)
alter type public.application_status add value if not exists 'completed' after 'confirmed';
alter type public.application_status add value if not exists 'hired' after 'completed';
