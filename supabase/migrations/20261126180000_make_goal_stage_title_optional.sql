-- A stage name is optional: without one the app names it by its target ("12 livros") or position.
-- The length check already lets null through.
alter table public.goal_stages alter column title drop not null;
