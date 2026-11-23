-- PREPARED, NOT APPLIED. Additive only: one admin reader. Needs 20261118000001_billing.sql (the subscriptions and billing_invoices tables).
-- Admin > Assinaturas: for each account that has a subscription, its plan, period, payment method, status and the last invoice.
-- Counters and states only: no invoice text, no document number, no payment link. Test accounts are left out like every other admin number.
-- Granting or revoking Pro by hand keeps using the existing admin action (change plan), which is audit-logged.
-- Until this is applied the page says so.

create or replace function admin.billing_by_user()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return coalesce((
    select jsonb_agg(r.item order by r.sort_key desc)
    from (
      select
        s.created_at as sort_key,
        jsonb_build_object(
          'user_id', u.id,
          'email', u.email::text,
          'name', p.display_name,
          'plan', case when p.plan = 'pro' and (p.plan_until is null or p.plan_until > now()) then 'pro' else 'free' end,
          'plan_until', p.plan_until,
          'period', s.plan_period,
          'method', s.method,
          'status', s.status,
          'cancel_at_period_end', s.cancel_at_period_end,
          'since', s.created_at,
          'last_invoice', (
            select jsonb_build_object('status', i.status, 'amount_cents', i.amount_cents, 'due_date', i.due_date)
            from public.billing_invoices i
            where i.user_id = s.user_id
            order by i.due_date desc nulls last, i.created_at desc
            limit 1
          )
        ) as item
      from public.subscriptions s
      join auth.users u on u.id = s.user_id
      left join public.profiles p on p.id = s.user_id
      where public.admin_counts_user(s.user_id)
        and s.created_at = (select max(s2.created_at) from public.subscriptions s2 where s2.user_id = s.user_id)
    ) r
  ), '[]'::jsonb);
end;
$$;
revoke all on function admin.billing_by_user() from public, anon;
grant execute on function admin.billing_by_user() to authenticated;
