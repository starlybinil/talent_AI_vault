-- Site media library: photos shown across the public site (featured program, program pages, catalog).
-- IT admins and web developers upload real program photos; generated images can be listed by URL.
create table if not exists public.site_media (
  id uuid primary key default gen_random_uuid(),
  path text,                -- object in the public site-media bucket (uploads)
  url text,                 -- external image URL (e.g. generated imagery)
  alt text not null default '',
  caption text,
  source text not null default 'upload' check (source in ('upload', 'generated')),
  active boolean not null default true,
  sort integer not null default 0,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (path is not null or url is not null)
);
create index if not exists site_media_active on public.site_media (active, sort, created_at desc);
alter table public.site_media enable row level security;

drop policy if exists site_media_public_read on public.site_media;
create policy site_media_public_read on public.site_media for select to anon using (active);
drop policy if exists site_media_staff_read on public.site_media;
create policy site_media_staff_read on public.site_media for select to authenticated
  using (active or public.has_role('it_admin') or public.has_role('web_developer') or public.is_program_admin());
drop policy if exists site_media_write on public.site_media;
create policy site_media_write on public.site_media for all to authenticated
  using (public.has_role('it_admin') or public.has_role('web_developer'))
  with check (public.has_role('it_admin') or public.has_role('web_developer'));

-- Public bucket (the site shows these images to everyone); only IT / web developers can write.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-media', 'site-media', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists site_media_files_write on storage.objects;
create policy site_media_files_write on storage.objects for insert to authenticated
  with check (bucket_id = 'site-media' and (public.has_role('it_admin') or public.has_role('web_developer')));
drop policy if exists site_media_files_delete on storage.objects;
create policy site_media_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'site-media' and (public.has_role('it_admin') or public.has_role('web_developer')));
