-- Program admins see pending instructor invitations (to show "Invited" on the Instructors page).
create policy pending_role_grants_select_instructors on public.pending_role_grants for select to authenticated
  using (role = 'instructor' and public.is_program_admin());
