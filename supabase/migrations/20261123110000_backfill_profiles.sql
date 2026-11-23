-- Profiles for users created before the on_auth_user_created trigger existed.
insert into public.profiles (id, full_name)
select id, raw_user_meta_data ->> 'full_name'
from auth.users
on conflict (id) do nothing;
