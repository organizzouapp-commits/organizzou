-- PREPARED, NOT APPLIED (ask before running). Additive only: one settings table and two admin readers.
-- Admin > Assistente: usage and estimated cost per account, and an optional monthly budget.
--   admin.assistant_cost_by_user()  one row per account that used the assistant: name, e-mail, plan, last use, and messages / input tokens /
--                                   output tokens for today, the last 7 days, this month and in total. Counters only (assistant_usage): no
--                                   message text exists in this function. Test accounts are left out, like every other admin number.
--   admin.assistant_budget()        the monthly budget in US$ saved by the admin (null when none).
--   public.admin_settings           small key/value settings for the admin area. Row level security is on and there is NO policy: nobody
--                                   but the secret key (the admin server action, after its own admin check) can write it, and the browser
--                                   roles cannot read it. The budget lives under the key 'assistant_monthly_budget_usd'.
-- Until this is applied the page says so, and the budget can still be set with the environment variable ASSISTANT_MONTHLY_BUDGET_USD.

create table if not exists public.admin_settings (
  key text primary key check (char_length(key) between 1 and 80),
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
alter table public.admin_settings enable row level security;
revoke all on public.admin_settings from anon, authenticated;

create or replace function admin.assistant_cost_by_user()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  today date := (now() at time zone 'America/Sao_Paulo')::date;
  month_start date := date_trunc('month', today::timestamp)::date;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return coalesce((
    select jsonb_agg(r.item order by r.sort_key desc)
    from (
      select
        coalesce(sum(a.input_tokens + a.output_tokens), 0) as sort_key,
        jsonb_build_object(
          'user_id', u.id,
          'email', u.email::text,
          'name', p.display_name,
          'plan', case when p.plan = 'pro' and (p.plan_until is null or p.plan_until > now()) then 'pro' else 'free' end,
          'last_use', max(a.updated_at),
          'today', jsonb_build_object('messages', coalesce(sum(a.messages) filter (where a.day = today), 0), 'input', coalesce(sum(a.input_tokens) filter (where a.day = today), 0), 'output', coalesce(sum(a.output_tokens) filter (where a.day = today), 0)),
          'd7', jsonb_build_object('messages', coalesce(sum(a.messages) filter (where a.day >= today - 6), 0), 'input', coalesce(sum(a.input_tokens) filter (where a.day >= today - 6), 0), 'output', coalesce(sum(a.output_tokens) filter (where a.day >= today - 6), 0)),
          'month', jsonb_build_object('messages', coalesce(sum(a.messages) filter (where a.day >= month_start), 0), 'input', coalesce(sum(a.input_tokens) filter (where a.day >= month_start), 0), 'output', coalesce(sum(a.output_tokens) filter (where a.day >= month_start), 0)),
          'total', jsonb_build_object('messages', coalesce(sum(a.messages), 0), 'input', coalesce(sum(a.input_tokens), 0), 'output', coalesce(sum(a.output_tokens), 0))
        ) as item
      from public.assistant_usage a
      join auth.users u on u.id = a.user_id
      left join public.profiles p on p.id = a.user_id
      where public.admin_counts_user(a.user_id)
      group by u.id, u.email, p.display_name, p.plan, p.plan_until
    ) r
  ), '[]'::jsonb);
end;
$$;
revoke all on function admin.assistant_cost_by_user() from public, anon;
grant execute on function admin.assistant_cost_by_user() to authenticated;

create or replace function admin.assistant_budget()
returns numeric
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return (select (s.value #>> '{}')::numeric from public.admin_settings s where s.key = 'assistant_monthly_budget_usd');
end;
$$;
revoke all on function admin.assistant_budget() from public, anon;
grant execute on function admin.assistant_budget() to authenticated;
