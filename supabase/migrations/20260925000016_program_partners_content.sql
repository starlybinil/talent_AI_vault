-- Multi-program support: each program names its own academic and employer partners
-- and carries its own landing-page copy, so nothing in the site is tied to one partnership.
alter table public.programs
  add column if not exists academic_partner text,
  add column if not exists employer_partner text,
  add column if not exists industry text,
  add column if not exists career_role text,
  add column if not exists hero_headline text,
  add column if not exists hero_highlight text,
  add column if not exists why_headline text,
  add column if not exists outcome_badge text,
  add column if not exists outcome_title text,
  add column if not exists outcome_detail text,
  add column if not exists audiences jsonb not null default '[]'::jsonb,
  add column if not exists keywords jsonb not null default '[]'::jsonb,
  add column if not exists featured boolean not null default false;

comment on column public.programs.academic_partner is 'Training provider, e.g. Arizona State University';
comment on column public.programs.employer_partner is 'Hiring partner, e.g. TSMC Arizona';
comment on column public.programs.outcome_badge is 'Short word for the hero stat, e.g. TSMC';
comment on column public.programs.featured is 'Shown as the featured program on the home page';

update public.programs set
  academic_partner = 'Arizona State University',
  employer_partner = 'TSMC Arizona',
  industry = 'Semiconductor',
  career_role = 'semiconductor equipment technician',
  hero_headline = 'Build the chips that',
  hero_highlight = 'build the future.',
  why_headline = 'Arizona is building the world''s most advanced chips. You can keep the fab running.',
  outcome_badge = 'TSMC',
  outcome_title = 'A guaranteed TSMC Arizona interview',
  outcome_detail = 'Upon successful completion of ASU & TSMC program milestones.',
  audiences = '["Recent high school graduates","Community college students","Career changers and working adults","Veterans and anyone curious about semiconductors"]'::jsonb,
  keywords = '["Electronics","Sensors","Pneumatics","Vacuum systems","Cleanroom safety","Multimeters","Oscilloscopes","Fab equipment"]'::jsonb,
  featured = true
where slug = 'asu-tsmc';

update public.programs set
  industry = 'Advanced manufacturing',
  career_role = 'advanced manufacturing technician',
  keywords = '["Automation","Robotics","Quality systems","PLCs","Metrology"]'::jsonb
where slug = 'advanced-manufacturing-foundations';
