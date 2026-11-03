-- Assistant engine (app chat and quick capture; WhatsApp later). Additive: new tables, one new RPC, one widened check, one admin reader.
-- Safe to run twice. Nothing here touches the vault (there is none) or any existing row.

-- Daily usage per person: what the per-plan message limit counts and what the admin page shows (messages and tokens, never text).
create table if not exists public.assistant_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  messages integer not null default 0,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);
alter table public.assistant_usage enable row level security;
drop policy if exists "assistant_usage_select_own" on public.assistant_usage;
create policy "assistant_usage_select_own" on public.assistant_usage for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "assistant_usage_insert_own" on public.assistant_usage;
create policy "assistant_usage_insert_own" on public.assistant_usage for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "assistant_usage_update_own" on public.assistant_usage;
create policy "assistant_usage_update_own" on public.assistant_usage for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.assistant_usage from anon;

-- Adds to today's counters in one statement (SECURITY INVOKER: RLS applies, a person only ever touches their own row).
create or replace function public.assistant_bump_usage(p_day date, p_messages integer, p_input bigint, p_output bigint)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.assistant_usage as u (user_id, day, messages, input_tokens, output_tokens)
  values ((select auth.uid()), p_day, greatest(p_messages, 0), greatest(p_input, 0), greatest(p_output, 0))
  on conflict (user_id, day) do update
    set messages = u.messages + greatest(p_messages, 0),
        input_tokens = u.input_tokens + greatest(p_input, 0),
        output_tokens = u.output_tokens + greatest(p_output, 0),
        updated_at = now();
$$;
revoke all on function public.assistant_bump_usage(date, integer, bigint, bigint) from public, anon;
grant execute on function public.assistant_bump_usage(date, integer, bigint, bigint) to authenticated;

-- The conversation history, one running conversation per person.
create table if not exists public.assistant_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  body jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists assistant_messages_user_created_idx on public.assistant_messages (user_id, created_at desc);
alter table public.assistant_messages enable row level security;
drop policy if exists "assistant_messages_select_own" on public.assistant_messages;
create policy "assistant_messages_select_own" on public.assistant_messages for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "assistant_messages_insert_own" on public.assistant_messages;
create policy "assistant_messages_insert_own" on public.assistant_messages for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "assistant_messages_delete_own" on public.assistant_messages;
create policy "assistant_messages_delete_own" on public.assistant_messages for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.assistant_messages from anon;

-- Quick capture writes its own actor in the audit log.
alter table public.audit_log drop constraint if exists audit_log_actor_check;
alter table public.audit_log add constraint audit_log_actor_check check (actor in ('app', 'assistant', 'whatsapp', 'app_quick_capture'));

-- Admin: assistant volume and token use, from the counters only (no text, no per-message rows).
create or replace function admin.assistant_tokens(range_days integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  n integer := greatest(least(coalesce(range_days, 30), 365), 1);
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'messages', coalesce((select sum(a.messages) from public.assistant_usage a where a.day >= (now() at time zone 'America/Sao_Paulo')::date - n and public.admin_counts_user(a.user_id)), 0),
    'input_tokens', coalesce((select sum(a.input_tokens) from public.assistant_usage a where a.day >= (now() at time zone 'America/Sao_Paulo')::date - n and public.admin_counts_user(a.user_id)), 0),
    'output_tokens', coalesce((select sum(a.output_tokens) from public.assistant_usage a where a.day >= (now() at time zone 'America/Sao_Paulo')::date - n and public.admin_counts_user(a.user_id)), 0),
    'users', (select count(distinct a.user_id) from public.assistant_usage a where a.day >= (now() at time zone 'America/Sao_Paulo')::date - n and a.messages > 0 and public.admin_counts_user(a.user_id)),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object('day', d.day, 'messages', d.messages, 'tokens', d.tokens) order by d.day)
      from (
        select a.day, sum(a.messages) as messages, sum(a.input_tokens + a.output_tokens) as tokens
        from public.assistant_usage a
        where a.day >= (now() at time zone 'America/Sao_Paulo')::date - n and public.admin_counts_user(a.user_id)
        group by a.day
      ) d
    ), '[]'::jsonb)
  );
end;
$$;
revoke all on function admin.assistant_tokens(integer) from public, anon;
grant execute on function admin.assistant_tokens(integer) to authenticated;
