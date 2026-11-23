-- New Supabase projects no longer auto-grant table privileges to the API roles, so every table
-- needs explicit grants; RLS policies only filter rows the role is already allowed to touch.
grant select, update on table public.profiles to authenticated;
grant select, insert, update, delete on table public.objectives to authenticated;
grant select, insert, update, delete on table public.objective_checks to authenticated;
