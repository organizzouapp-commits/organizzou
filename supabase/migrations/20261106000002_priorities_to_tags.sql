-- PREPARED, NOT APPLIED (do not db push without approval).
-- Priorities became tags. Additive and non-destructive: `tasks.priority` (and `priority_id`, `task_priorities` if they exist) are left untouched
-- and simply stop being read by the UI. Idempotent: running it twice adds nothing.
--  * every task with priority low / medium / high gets a tag named Baixa / Média / Alta (created per person when missing, matched
--    case-insensitively on the name);
--  * when 20261105000001_task_priorities.sql was applied, the person's own priority names are used too (and carry their color if
--    20261105000002_label_colors.sql was applied).
-- The localStorage adapter does the same on this device (src/features/tasks/priority-to-tags.ts).

-- 1. Enum priorities -> tags by name.
with wanted as (
  select distinct t.user_id,
         case t.priority when 'low' then 'Baixa' when 'medium' then 'Média' when 'high' then 'Alta' end as name
  from public.tasks t
  where t.priority in ('low', 'medium', 'high')
)
insert into public.tags (user_id, name, swatch)
select w.user_id, w.name, 'neutro'
from wanted w
where not exists (select 1 from public.tags g where g.user_id = w.user_id and lower(g.name) = lower(w.name));

insert into public.task_tags (user_id, task_id, tag_id)
select t.user_id, t.id, g.id
from public.tasks t
join public.tags g
  on g.user_id = t.user_id
 and lower(g.name) = lower(case t.priority when 'low' then 'Baixa' when 'medium' then 'Média' when 'high' then 'Alta' end)
where t.priority in ('low', 'medium', 'high')
on conflict (task_id, tag_id) do nothing;

-- 2. The person's own priorities (only when that migration exists).
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'tasks' and column_name = 'priority_id') then
    execute $q$
      insert into public.tags (user_id, name, swatch)
      select distinct p.user_id, p.name, 'neutro'
      from public.task_priorities p
      join public.tasks t on t.priority_id = p.id and t.user_id = p.user_id
      where not exists (select 1 from public.tags g where g.user_id = p.user_id and lower(g.name) = lower(p.name))
    $q$;
    execute $q$
      insert into public.task_tags (user_id, task_id, tag_id)
      select t.user_id, t.id, g.id
      from public.tasks t
      join public.task_priorities p on p.id = t.priority_id and p.user_id = t.user_id
      join public.tags g on g.user_id = t.user_id and lower(g.name) = lower(p.name)
      on conflict (task_id, tag_id) do nothing
    $q$;
  end if;
end $$;
