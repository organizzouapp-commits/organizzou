-- On sign-up: create the profile and a starter board with three lists.

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_board_id uuid;
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1))
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

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
