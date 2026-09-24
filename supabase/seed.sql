-- FoundryReady Training Programs: seed data
-- Cohort dates, locations, capacities and agreement text are PLACEHOLDERS — confirm with ASU / TSMC Arizona before launch.

insert into public.programs (
  slug, name, short_name, partner_name, tagline, summary, hours_label, cost_label, duration_label, eligibility,
  topics, formats, faqs, stats, hero_video, hero_poster, default_exam_url, employer_visible_fields, sort
) values (
  'asu-tsmc',
  'ASU-TSMC Foundations for Equipment Technician Program',
  'ASU-TSMC Equipment Technician',
  'Arizona State University × TSMC Arizona',
  'Become a semiconductor equipment technician in weeks, not years.',
  'A no-cost, hands-on accelerated training program that prepares you for semiconductor equipment technician roles. Train on industry-standard tools across the Phoenix metro and earn industry-recognized credentials plus a guaranteed TSMC Arizona interview upon successful completion of ASU & TSMC program milestones.',
  '192+ hours',
  '$0 to participants',
  '5, 16 or 18 weeks',
  'High school diploma or GED. Must be 18 or older by program completion.',
  '[
    {"title": "Fab Safety & Cleanroom Protocol", "desc": "Gowning, contamination control, chemical and electrical safety, lockout/tagout.", "icon": "shield"},
    {"title": "Electronics Fundamentals", "desc": "AC/DC circuits, components, schematics and power distribution.", "icon": "zap"},
    {"title": "Sensors & Instrumentation", "desc": "Temperature, pressure, flow and position sensors, and how tools use them.", "icon": "radar"},
    {"title": "Pneumatics & Fluid Systems", "desc": "Valves, actuators, regulators and gas delivery systems.", "icon": "wind"},
    {"title": "Vacuum Systems", "desc": "Pumps, gauges, leak detection and chamber fundamentals.", "icon": "gauge"},
    {"title": "Test & Measurement", "desc": "Hands-on with multimeters, oscilloscopes and diagnostic workflows.", "icon": "activity"},
    {"title": "Mechanical Systems & Maintenance", "desc": "Hand tools, torque, alignment and preventive maintenance.", "icon": "wrench"},
    {"title": "Semiconductor Equipment & Processes", "desc": "How wafers move through the fab and what technicians keep running.", "icon": "cpu"}
  ]'::jsonb,
  '[
    {"key": "accelerator", "name": "5-Week Accelerator", "cadence": "Monday – Friday", "weeks": 5, "best_for": "Ready to go full-time and fast-track into the fab."},
    {"key": "intensive", "name": "16-Week Intensive", "cadence": "Monday – Thursday", "weeks": 16, "best_for": "Balance training with other commitments."},
    {"key": "saturday", "name": "18-Week Saturday", "cadence": "Saturdays only", "weeks": 18, "best_for": "Working adults and career changers."}
  ]'::jsonb,
  '[
    {"q": "How much does the program cost?", "a": "Nothing. The program is offered at no cost to participants."},
    {"q": "Who can apply?", "a": "Anyone with a high school diploma or GED — recent graduates, community college students, career changers and working adults. You must be at least 18 by the time you complete the program."},
    {"q": "Do I need prior experience?", "a": "No. The program is designed for people who may not have previously considered a career in semiconductors."},
    {"q": "What happens after I apply?", "a": "Admissions reviews your application, then qualified applicants are invited to an online assessment (TestGorilla). After a successful result you choose your top 3 cohorts, sign your program agreements, and receive a final confirmation."},
    {"q": "Where is training held?", "a": "Training locations are spread across the Phoenix metro. Each cohort lists its location so you can pick what works for you."},
    {"q": "Is a job guaranteed?", "a": "Graduates earn industry-recognized credentials and a guaranteed TSMC Arizona interview upon successful completion of ASU & TSMC program milestones. Hiring decisions are made by the employer."},
    {"q": "Will I need visa sponsorship?", "a": "We ask whether you require visa sponsorship now or in the future for employment at TSMC Arizona. Answering honestly helps us guide you — it does not by itself disqualify you from training."}
  ]'::jsonb,
  '[
    {"value": "0", "prefix": "$", "label": "Cost to you"},
    {"value": "192", "suffix": "+", "label": "Hands-on hours"},
    {"value": "8", "label": "Technical topic areas"},
    {"value": "3", "label": "Flexible formats"}
  ]'::jsonb,
  '/media/hero.mp4',
  '/media/hero-poster.jpg',
  'https://app.testgorilla.com/',
  array['first_name', 'last_name', 'highest_education', 'major', 'status', 'exam_result', 'cohort', 'resume'],
  1
);

-- Placeholder for a future program to demonstrate the multi-program catalog (inactive).
insert into public.programs (slug, name, short_name, partner_name, tagline, summary, hours_label, cost_label, duration_label, eligibility, active, sort)
values (
  'advanced-manufacturing-foundations',
  'Advanced Manufacturing Foundations',
  'Advanced Manufacturing',
  'FoundryReady Partners',
  'Coming soon: core skills for modern advanced manufacturing.',
  'A future FoundryReady pathway covering automation, robotics and quality systems.',
  'TBA', 'TBA', 'TBA', 'High school diploma or GED.',
  false, 2
);

insert into public.employer_orgs (name, domain) values ('TSMC Arizona', 'tsmc.com');

insert into public.program_partners (program_id, employer_org_id)
select p.id, o.id from public.programs p, public.employer_orgs o
where p.slug = 'asu-tsmc' and o.name = 'TSMC Arizona';

insert into public.training_locations (name, address) values
  ('Tempe', 'ASU Tempe campus, Tempe, AZ'),
  ('Mesa', 'ASU Polytechnic campus, Mesa, AZ'),
  ('Glendale', 'ASU West Valley campus, Glendale, AZ'),
  ('North Phoenix', 'North Phoenix training site, Phoenix, AZ');

-- location / address are filled from training_locations by the cohorts_fill_location trigger.
insert into public.cohorts (program_id, name, format, start_date, end_date, schedule, location_id, location, capacity)
select p.id, c.name, c.format, c.start_date::date, c.end_date::date, c.schedule, l.id, l.name, c.capacity
from public.programs p, public.training_locations l,
(values
  ('Accelerator · Oct 2026', '5-Week Accelerator', '2026-10-19', '2026-11-20', 'Mon–Fri · 8:00 AM – 4:30 PM', 'Tempe', 'ASU Tempe campus, Tempe, AZ', 24),
  ('Intensive · Nov 2026', '16-Week Intensive', '2026-11-02', '2027-02-25', 'Mon–Thu · 5:30 PM – 8:30 PM', 'Mesa', 'ASU Polytechnic campus, Mesa, AZ', 24),
  ('Saturday · Nov 2026', '18-Week Saturday', '2026-11-07', '2027-03-20', 'Saturdays · 8:00 AM – 5:00 PM', 'Glendale', 'ASU West Valley campus, Glendale, AZ', 20),
  ('Accelerator · Jan 2027', '5-Week Accelerator', '2027-01-11', '2027-02-12', 'Mon–Fri · 8:00 AM – 4:30 PM', 'North Phoenix', 'North Phoenix training site, Phoenix, AZ', 24),
  ('Intensive · Feb 2027', '16-Week Intensive', '2027-02-01', '2027-05-27', 'Mon–Thu · 5:30 PM – 8:30 PM', 'Tempe', 'ASU Tempe campus, Tempe, AZ', 24),
  ('Saturday · Mar 2027', '18-Week Saturday', '2027-03-06', '2027-07-10', 'Saturdays · 8:00 AM – 5:00 PM', 'North Phoenix', 'North Phoenix training site, Phoenix, AZ', 20)
) as c(name, format, start_date, end_date, schedule, location, address, capacity)
where p.slug = 'asu-tsmc' and l.name = c.location;

insert into public.agreement_templates (program_id, title, body, version, required, sort)
select p.id, t.title, t.body, 1, true, t.sort
from public.programs p,
(values
  ('Participant Agreement', E'PLACEHOLDER — replace with the official agreement text.\n\nBy signing, I agree to attend all scheduled sessions of my registered cohort, complete required coursework and assessments, and follow the instructions of program staff.\n\nI understand the program is offered at no cost to me and that my seat may be released to another applicant if I do not meet attendance requirements.\n\nI understand that completing the program provides a guaranteed TSMC Arizona interview upon successful completion of ASU & TSMC program milestones, and that hiring decisions are made solely by the employer.', 1),
  ('Safety & Cleanroom Conduct Acknowledgement', E'PLACEHOLDER — replace with the official safety acknowledgement.\n\nI will follow all safety, gowning and cleanroom protocols, wear required personal protective equipment, and immediately report unsafe conditions.\n\nI understand that failure to follow safety rules may result in removal from lab activities or the program.', 2),
  ('Information Release & Media Consent', E'PLACEHOLDER — replace with the official release.\n\nI authorize FoundryReady and its program partners (Arizona State University and TSMC Arizona) to share my program status, attendance, assessment results and credentials with each other for the purposes of program administration and employment consideration.\n\nI understand I may revoke this consent in writing at any time.', 3)
) as t(title, body, sort)
where p.slug = 'asu-tsmc';

insert into public.feature_flags (key, enabled, description) values
  ('applications_open', true, 'Allow new applications to be submitted'),
  ('show_seat_counts', true, 'Show seats-left bars on public cohort cards'),
  ('employer_portal', true, 'Enable the partner employer portal'),
  ('announcement_banner', false, 'Show the site-wide announcement banner');

insert into public.site_content (key, value) values
  ('announcement', '{"text": "Now accepting applications for Fall 2026 cohorts.", "href": "/programs/asu-tsmc"}'::jsonb),
  ('home_hero', '{"eyebrow": "FoundryReady · Advanced manufacturing careers", "title": "Trained today. Ready on day one.", "subtitle": "No-cost, hands-on training for semiconductor and advanced manufacturing careers, funded by government and industry and built with the employers who are hiring."}'::jsonb);

insert into public.system_settings (key, value) values
  ('email_from', '"FoundryReady Admissions <admissions@foundryready.org>"'::jsonb),
  ('support_email', '"support@foundryready.org"'::jsonb),
  ('exam_reminder_days', '[3, 7]'::jsonb);
