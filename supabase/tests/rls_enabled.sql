-- Run in Dashboard > SQL Editor. Every row must show rls_enabled = true and at least one policy.
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  count(p.polname) as policies
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policy p on p.polrelid = c.oid
where n.nspname = 'public' and c.relkind = 'r'
group by c.relname, c.relrowsecurity
order by c.relname;

-- Storage policies for the attachments bucket (4 expected: select, insert, update, delete)
select policyname, cmd
from pg_policies
where schemaname = 'storage' and tablename = 'objects' and policyname like 'task_attachments_%'
order by policyname;
