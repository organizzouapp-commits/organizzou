-- PREPARED, NOT APPLIED (ask before running `db push`). Additive only: new nullable columns on public.finance_bills.
-- Installment bills ("Parcelada" in Contas fixas): a fixed bill that repeats monthly for exactly N months and then ends by itself.
--   installment_total      how many installments the series has (null = a normal monthly bill)
--   installment_first_month "yyyy-MM" of the first installment
--   installment_first_day  the day the person chose (1-31); shorter months clamp to their last day
--   installment_paid       the months ("yyyy-MM") already paid: paying one never marks another
--   installment_skipped    installments removed from the series on their own
--   installment_amounts    per-month amount when it differs from amount_cents ({"2027-05": 9000})
--   series_id              groups the rows if a series is ever split ("esta e as próximas")
-- Until this is applied the app keeps this meta in localStorage (src/features/finance/installments.ts, BillMetaRepo).
-- RLS is unchanged: the existing policies on finance_bills cover the new columns.

alter table public.finance_bills add column if not exists installment_total integer
  check (installment_total is null or installment_total between 2 and 60);
alter table public.finance_bills add column if not exists installment_first_month text
  check (installment_first_month is null or installment_first_month ~ '^\d{4}-\d{2}$');
alter table public.finance_bills add column if not exists installment_first_day integer
  check (installment_first_day is null or installment_first_day between 1 and 31);
alter table public.finance_bills add column if not exists installment_paid text[] not null default '{}';
alter table public.finance_bills add column if not exists installment_skipped text[] not null default '{}';
alter table public.finance_bills add column if not exists installment_amounts jsonb not null default '{}'::jsonb;
alter table public.finance_bills add column if not exists series_id uuid;
