-- PREPARED, NOT APPLIED. Additive only: what the person decides about an account beyond name, institution and opening balance.
-- Until this is applied everything below lives in localStorage (organizzou:financas-account-meta) behind AccountMetaRepo, and accounts
-- without a value behave as active banks in creation order. RLS already covers the table (user_id = auth.uid()): no policy changes.
alter table public.finance_accounts add column if not exists kind text check (kind in ('bank', 'wallet', 'card', 'savings'));
alter table public.finance_accounts add column if not exists icon text check (icon in ('landmark', 'wallet', 'card', 'piggy', 'banknote'));
alter table public.finance_accounts add column if not exists color text check (color in ('neutro', 'lima', 'lima-verso', 'tinta-verso', 'grafite', 'papel'));
alter table public.finance_accounts add column if not exists archived_at timestamptz;
alter table public.finance_accounts add column if not exists sort_order integer not null default 0;
