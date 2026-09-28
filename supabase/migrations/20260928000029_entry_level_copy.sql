-- Tone down marketing copy: graduates start in entry-level technician roles and keep learning on the job.
update public.programs set
  tagline = 'Build the foundational skills for an entry-level semiconductor equipment technician role.',
  summary = 'A no-cost, hands-on foundations program that prepares you for entry-level semiconductor equipment technician roles. Build core skills on industry-standard tools across the Phoenix metro and earn industry-recognized credentials plus a guaranteed TSMC Arizona interview upon successful completion of ASU & TSMC program milestones. Graduates keep learning on the job as they grow in the role.',
  why_headline = 'Arizona is building the world''s most advanced chips. Start your path in the fab.',
  formats = (
    select jsonb_agg(
      case when f->>'key' = 'accelerator' then jsonb_set(f, '{best_for}', '"Ready to commit full-time and finish sooner."') else f end
      order by ord)
    from jsonb_array_elements(formats) with ordinality as t(f, ord)
  )
where slug = 'asu-tsmc';

update public.site_content
set value = value
  || jsonb_build_object('title', 'Trained today. Ready to start.')
  || jsonb_build_object('subtitle', 'No-cost, hands-on training that prepares you for entry-level semiconductor and advanced manufacturing careers, funded by government and industry and built with the employers who are hiring.')
where key = 'home_hero';
