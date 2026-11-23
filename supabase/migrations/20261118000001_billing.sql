-- Billing with Asaas. ADDITIVE ONLY: four new tables, nothing dropped or changed. NOT applied to the remote database yet.
-- profiles.plan and profiles.plan_until already exist (20260105000001, 20260201000001) and stay the source of "is this person Pro".
-- Every write below comes from the server with the secret key (service role). Users can only read their own rows, except
-- billing_customers (holds the CPF/CNPJ) and billing_events, which have no policy at all: nobody but the service role touches them.

create table if not exists public.billing_customers (
  user_id uuid primary key references auth.users (id) on delete cascade,
  asaas_customer_id text not null unique,
  cpf_cnpj text not null,
  created_at timestamptz not null default now()
);
alter table public.billing_customers enable row level security;
revoke all on public.billing_customers from anon, authenticated;

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  asaas_subscription_id text unique,
  plan_period text not null check (plan_period in ('monthly', 'annual')),
  method text not null check (method in ('card', 'pix', 'boleto')),
  status text not null default 'pending' check (status in ('pending', 'active', 'overdue', 'canceled', 'ended')),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  -- Set when a renewal fails: Pro keeps working until this moment (3 days of grace).
  grace_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists subscriptions_user_idx on public.subscriptions (user_id, created_at desc);
alter table public.subscriptions enable row level security;
revoke all on public.subscriptions from anon, authenticated;
grant select on public.subscriptions to authenticated;
drop policy if exists subscriptions_select_own on public.subscriptions;
create policy subscriptions_select_own on public.subscriptions for select to authenticated using (user_id = (select auth.uid()));

create table if not exists public.billing_invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  asaas_payment_id text not null unique,
  asaas_subscription_id text,
  amount_cents integer not null check (amount_cents >= 0),
  status text not null,
  method text,
  due_date date,
  paid_at timestamptz,
  invoice_url text,
  description text,
  created_at timestamptz not null default now()
);
create index if not exists billing_invoices_user_idx on public.billing_invoices (user_id, due_date desc);
alter table public.billing_invoices enable row level security;
revoke all on public.billing_invoices from anon, authenticated;
grant select on public.billing_invoices to authenticated;
drop policy if exists billing_invoices_select_own on public.billing_invoices;
create policy billing_invoices_select_own on public.billing_invoices for select to authenticated using (user_id = (select auth.uid()));

-- Webhook idempotency: one row per Asaas event id. The payload keeps only what the handler needs (no card or personal data).
create table if not exists public.billing_events (
  asaas_event_id text primary key,
  event text not null,
  asaas_payment_id text,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.billing_events enable row level security;
revoke all on public.billing_events from anon, authenticated;
