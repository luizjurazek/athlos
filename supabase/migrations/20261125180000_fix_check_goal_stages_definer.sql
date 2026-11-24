-- Deleting an auth user cascades to goal_stages, and the deferred check then runs as
-- supabase_auth_admin, which cannot read public.goals. Running it as its owner fixes account
-- deletion; execute stays revoked from public, anon and authenticated (create_goals migration).
alter function public.check_goal_stages() security definer;
