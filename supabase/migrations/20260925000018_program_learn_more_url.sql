alter table public.programs add column if not exists learn_more_url text;
comment on column public.programs.learn_more_url is 'Optional external program page used by the home catalog "Learn more" button';
update public.programs set learn_more_url = 'https://asuengineeringonline.com/tsmc-foundations-equipment-technician-program' where slug = 'asu-tsmc';
