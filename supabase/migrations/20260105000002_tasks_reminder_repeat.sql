-- Task reminder and repeat (UI shows them as "Em breve"; nothing reads or writes these yet).
-- Additive and backward compatible: nullable columns only. Not applied to the remote project.

alter table public.tasks
  add column if not exists remind_at timestamptz,
  add column if not exists repeat_rule text check (repeat_rule in ('daily', 'weekly', 'monthly', 'yearly'));
