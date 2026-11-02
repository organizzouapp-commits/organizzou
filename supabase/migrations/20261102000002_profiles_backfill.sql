-- Every auth user gets a profiles row. Additive and idempotent: it only INSERTS rows that are missing (on conflict do nothing),
-- never updates or deletes anything, and changes no policy, column or trigger.
--
-- Why: handle_new_user() creates the profile at sign-up, but an account created before that trigger existed (or by hand in the
-- Auth dashboard) had none. For such an account every UPDATE of "its profile" silently matches zero rows: the admin's
-- "alterar plano" looked successful while profiles.plan never changed, and the person's own theme / Hoje layout never saved.
-- Same name rule as the sign-up trigger. No starter board is created here: that stays a sign-up step.

insert into public.profiles (id, display_name)
select
  u.id,
  coalesce(
    nullif(u.raw_user_meta_data ->> 'display_name', ''),
    nullif(u.raw_user_meta_data ->> 'full_name', ''),
    nullif(u.raw_user_meta_data ->> 'name', ''),
    split_part(u.email, '@', 1)
  )
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;
