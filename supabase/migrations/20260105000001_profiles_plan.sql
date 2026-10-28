-- Plan of each user ('free' or 'pro'). Additive and backward compatible: nullable, no default needed (the app treats NULL
-- as 'free'), and the app falls back to 'free' while this column does not exist yet.
-- There is no payment provider yet, so only the service role may change it.

alter table public.profiles
  add column if not exists plan text check (plan in ('free', 'pro'));

-- profiles_update_own lets users update their own row, so block changes to `plan` unless the caller is the service role.
create or replace function public.profiles_protect_plan()
returns trigger
language plpgsql
as $$
begin
  if new.plan is distinct from old.plan and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'plan can only be changed by the service role' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_plan on public.profiles;
create trigger profiles_protect_plan before update on public.profiles
  for each row execute function public.profiles_protect_plan();
