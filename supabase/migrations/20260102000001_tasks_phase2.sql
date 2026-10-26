-- Phase 2: tasks refinements, attachments storage, reorder RPCs, RLS assertion.

-- A due date can be date-only (all day) or carry a time.
alter table public.tasks add column due_has_time boolean not null default false;

-- Board-level helpers used by the UI -------------------------------------------------

-- Moves tasks into a list and sets their order in one round trip.
-- SECURITY INVOKER: RLS still applies, so only the caller's own rows are touched.
create function public.reorder_tasks(p_list_id uuid, p_task_ids uuid[])
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.tasks t
  set list_id = p_list_id,
      position = o.ord * 1000,
      completed_at = case
        when l.is_done_list then coalesce(t.completed_at, now())
        else null
      end
  from unnest(p_task_ids) with ordinality as o(id, ord),
       public.board_lists l
  where t.id = o.id
    and l.id = p_list_id
    and t.board_id = l.board_id;
$$;

create function public.reorder_lists(p_board_id uuid, p_list_ids uuid[])
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.board_lists l
  set position = o.ord * 1000
  from unnest(p_list_ids) with ordinality as o(id, ord)
  where l.id = o.id
    and l.board_id = p_board_id;
$$;

revoke execute on function public.reorder_tasks(uuid, uuid[]) from public, anon;
revoke execute on function public.reorder_lists(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_tasks(uuid, uuid[]) to authenticated;
grant execute on function public.reorder_lists(uuid, uuid[]) to authenticated;

-- Extra indexes for the board queries
create index if not exists tasks_board_archived_idx on public.tasks (board_id) where not archived;
create index if not exists attachments_user_entity_idx on public.attachments (user_id, entity_type, entity_id);

-- Storage: private bucket for task attachments, files live under "<user_id>/..." -----------

insert into storage.buckets (id, name, public, file_size_limit)
values ('task-attachments', 'task-attachments', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = 10485760;

create policy "task_attachments_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'task-attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "task_attachments_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'task-attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "task_attachments_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'task-attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "task_attachments_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'task-attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Demo data for accounts that already exist and have no tasks yet -----------------------------

do $$
declare
  u record;
  b1 uuid;
  b2 uuid;
  l_todo uuid;
  l_doing uuid;
  l_done uuid;
  h_todo uuid;
  h_doing uuid;
  h_done uuid;
  t_work uuid;
  t_personal uuid;
  t_urgent uuid;
  t_home uuid;
  t1 uuid;
  t2 uuid;
  t3 uuid;
begin
  for u in
    select p.id from public.profiles p
    where not exists (select 1 from public.tasks t where t.user_id = p.id)
  loop
    -- tags
    insert into public.tags (user_id, name, swatch) values (u.id, 'Trabalho', 'tinta-verso')
      on conflict do nothing;
    insert into public.tags (user_id, name, swatch) values (u.id, 'Pessoal', 'lima-verso')
      on conflict do nothing;
    insert into public.tags (user_id, name, swatch) values (u.id, 'Urgente', 'lima')
      on conflict do nothing;
    insert into public.tags (user_id, name, swatch) values (u.id, 'Casa', 'grafite')
      on conflict do nothing;
    select id into t_work from public.tags where user_id = u.id and lower(name) = 'trabalho';
    select id into t_personal from public.tags where user_id = u.id and lower(name) = 'pessoal';
    select id into t_urgent from public.tags where user_id = u.id and lower(name) = 'urgente';
    select id into t_home from public.tags where user_id = u.id and lower(name) = 'casa';

    -- board 1: reuse the starter board created on sign-up, or create one
    select id into b1 from public.boards where user_id = u.id and not archived order by created_at limit 1;
    if b1 is null then
      insert into public.boards (user_id, name, position) values (u.id, 'Meu quadro', 1000) returning id into b1;
    end if;
    select id into l_todo from public.board_lists where board_id = b1 and name = 'A fazer' limit 1;
    select id into l_doing from public.board_lists where board_id = b1 and name = 'Em andamento' limit 1;
    select id into l_done from public.board_lists where board_id = b1 and is_done_list limit 1;
    if l_todo is null then
      insert into public.board_lists (user_id, board_id, name, position) values (u.id, b1, 'A fazer', 1000) returning id into l_todo;
    end if;
    if l_doing is null then
      insert into public.board_lists (user_id, board_id, name, position) values (u.id, b1, 'Em andamento', 2000) returning id into l_doing;
    end if;
    if l_done is null then
      insert into public.board_lists (user_id, board_id, name, position, is_done_list) values (u.id, b1, 'Concluído', 3000, true) returning id into l_done;
    end if;

    insert into public.tasks (user_id, board_id, list_id, title, description, priority, due_at, due_has_time, category, swatch, position)
    values (u.id, b1, l_todo, 'Enviar relatório semanal', 'Resumir os resultados da semana e mandar para o time.', 'high',
            date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo' + interval '17 hours', true,
            'Trabalho', 'tinta-verso', 1000)
    returning id into t1;
    insert into public.task_tags (user_id, task_id, tag_id) values (u.id, t1, t_work), (u.id, t1, t_urgent);
    insert into public.task_checklist_items (user_id, task_id, text, done, position) values
      (u.id, t1, 'Reunir os números', true, 1000),
      (u.id, t1, 'Escrever o resumo', false, 2000),
      (u.id, t1, 'Revisar e enviar', false, 3000);
    insert into public.task_comments (user_id, task_id, body) values (u.id, t1, 'Lembrar de incluir o gráfico de gastos.');

    insert into public.tasks (user_id, board_id, list_id, title, priority, due_at, due_has_time, category, swatch, position)
    values (u.id, b1, l_todo, 'Marcar consulta de rotina', 'medium',
            date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo' + interval '2 days 12 hours', false,
            'Saúde', 'lima', 2000)
    returning id into t2;
    insert into public.task_tags (user_id, task_id, tag_id) values (u.id, t2, t_personal);

    insert into public.tasks (user_id, board_id, list_id, title, priority, due_at, due_has_time, swatch, position)
    values (u.id, b1, l_todo, 'Pagar a conta de luz', 'high',
            date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo' - interval '1 day' + interval '12 hours', false,
            'neutro', 3000);

    insert into public.tasks (user_id, board_id, list_id, title, description, priority, due_at, due_has_time, category, swatch, position)
    values (u.id, b1, l_doing, 'Planejar as férias', 'Pesquisar destinos e comparar preços.', 'low',
            date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo' + interval '9 days 12 hours', false,
            'Pessoal', 'papel', 1000)
    returning id into t3;
    insert into public.task_tags (user_id, task_id, tag_id) values (u.id, t3, t_personal);
    insert into public.task_checklist_items (user_id, task_id, text, done, position) values
      (u.id, t3, 'Escolher datas', true, 1000),
      (u.id, t3, 'Comparar passagens', false, 2000);

    insert into public.tasks (user_id, board_id, list_id, title, priority, due_at, due_has_time, swatch, position, completed_at)
    values (u.id, b1, l_done, 'Renovar documento', 'none',
            date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo' - interval '3 days' + interval '12 hours', false,
            'neutro', 1000, now() - interval '2 days');

    -- board 2
    insert into public.boards (user_id, name, position) values (u.id, 'Casa e vida', 2000) returning id into b2;
    insert into public.board_lists (user_id, board_id, name, position, is_done_list) values (u.id, b2, 'Ideias', 1000, false) returning id into h_todo;
    insert into public.board_lists (user_id, board_id, name, position, is_done_list) values (u.id, b2, 'Fazendo', 2000, false) returning id into h_doing;
    insert into public.board_lists (user_id, board_id, name, position, is_done_list) values (u.id, b2, 'Feito', 3000, true) returning id into h_done;

    insert into public.tasks (user_id, board_id, list_id, title, priority, due_at, due_has_time, category, swatch, position)
    values (u.id, b2, h_doing, 'Organizar o armário', 'medium',
            date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo' + interval '1 day 12 hours', false,
            'Casa', 'grafite', 1000)
    returning id into t1;
    insert into public.task_tags (user_id, task_id, tag_id) values (u.id, t1, t_home);

    insert into public.tasks (user_id, board_id, list_id, title, priority, swatch, position)
    values (u.id, b2, h_todo, 'Comprar planta para a sala', 'none', 'lima-verso', 1000);
    insert into public.tasks (user_id, board_id, list_id, title, priority, swatch, position)
    values (u.id, b2, h_todo, 'Pintar a parede do quarto', 'low', 'neutro', 2000);
    insert into public.tasks (user_id, board_id, list_id, title, priority, swatch, position, completed_at)
    values (u.id, b2, h_done, 'Trocar a lâmpada da cozinha', 'none', 'neutro', 1000, now() - interval '1 day');
  end loop;
end;
$$;

-- Safety net: fail the migration if any public table lacks row level security.
do $$
declare
  missing text;
begin
  select string_agg(c.relname, ', ') into missing
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;

  if missing is not null then
    raise exception 'RLS is not enabled on: %', missing;
  end if;
end;
$$;
