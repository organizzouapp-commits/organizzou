-- Phone number captured at sign-up (E.164, e.g. +5511912345678). Used later to link WhatsApp.
alter table public.profiles add column phone text
  check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$');

-- One account per number once it exists (null values are allowed many times).
create unique index profiles_phone_key on public.profiles (phone) where phone is not null;

-- Sign-up trigger now also stores the phone sent in the user metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_board_id uuid;
  new_phone text := nullif(new.raw_user_meta_data ->> 'phone', '');
begin
  insert into public.profiles (id, display_name, phone)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''), -- Google sign-in
      nullif(new.raw_user_meta_data ->> 'name', ''),
      split_part(new.email, '@', 1)
    ),
    case when new_phone ~ '^\+[1-9][0-9]{7,14}$' then new_phone else null end
  );

  insert into public.boards (user_id, name)
  values (new.id, 'Meu quadro')
  returning id into new_board_id;

  insert into public.board_lists (user_id, board_id, name, position, is_done_list)
  values
    (new.id, new_board_id, 'A fazer', 1000, false),
    (new.id, new_board_id, 'Em andamento', 2000, false),
    (new.id, new_board_id, 'Concluído', 3000, true);

  return new;
end;
$$;
