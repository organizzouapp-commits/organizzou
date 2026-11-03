-- Admin > Usuários always lists the test accounts (the demo account and every profile marked `is_test`), each flagged "Teste" in the app.
-- They stay OUT of the aggregate numbers (overview, activity, usage, retention): those functions keep filtering with admin_counts_user().
-- Only the user list stops filtering. Same signature and columns as before (create or replace), additive, safe to run twice.

create or replace function admin.test_account_ids()
returns setof uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query select p.id from public.profiles p where p.is_test;
end;
$$;
revoke all on function admin.test_account_ids() from public, anon;
grant execute on function admin.test_account_ids() to authenticated;

create or replace function admin.list_users(
  p_search text,
  p_plan text,
  p_status text,
  p_activity text,
  p_from date,
  p_to date,
  p_sort text,
  p_dir text,
  p_page integer,
  p_size integer
)
returns table (
  id uuid,
  name text,
  email text,
  plan text,
  plan_until timestamptz,
  created_at timestamptz,
  last_seen timestamptz,
  provider text,
  whatsapp_linked boolean,
  status text,
  total bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  size integer := greatest(least(coalesce(p_size, 20), 200), 1);
  skip integer := (greatest(coalesce(p_page, 1), 1) - 1) * greatest(least(coalesce(p_size, 20), 200), 1);
  needle text := nullif(btrim(coalesce(p_search, '')), '');
  descending boolean := lower(coalesce(p_dir, 'desc')) <> 'asc';
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if needle is not null then
    needle := '%' || replace(replace(replace(needle, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  return query
    with base as (
      select
        u.id,
        p.display_name::text as name,
        u.email::text as email,
        case when p.plan = 'pro' and (p.plan_until is null or p.plan_until > now()) then 'pro' else 'free' end as plan,
        p.plan_until,
        u.created_at,
        coalesce(p.last_seen_at, u.last_sign_in_at) as last_seen,
        coalesce((select string_agg(distinct i.provider, ', ' order by i.provider) from auth.identities i where i.user_id = u.id), 'email') as provider,
        -- WhatsApp linking is not built yet (docs/INTEGRATIONS-STATUS.md): there is nothing to link. Wire this to the link table when it exists.
        false as whatsapp_linked,
        case
          when u.banned_until is not null and u.banned_until > now() then 'suspended'
          when u.email_confirmed_at is null then 'pending'
          else 'active'
        end as status
      from auth.users u
      left join public.profiles p on p.id = u.id
    ),
    filtered as (
      select b.* from base b
      where (needle is null or b.email ilike needle or coalesce(b.name, '') ilike needle)
        and (p_plan is null or b.plan = p_plan)
        and (p_status is null or b.status = p_status)
        and (p_activity is null
             or (p_activity = 'active' and b.last_seen >= now() - interval '7 days')
             or (p_activity = 'inactive' and (b.last_seen is null or b.last_seen < now() - interval '7 days')))
        and (p_from is null or (b.created_at at time zone 'America/Sao_Paulo')::date >= p_from)
        and (p_to is null or (b.created_at at time zone 'America/Sao_Paulo')::date <= p_to)
    )
    select f.id, f.name, f.email, f.plan, f.plan_until, f.created_at, f.last_seen, f.provider, f.whatsapp_linked, f.status,
           count(*) over () as total
    from filtered f
    order by
      case when p_sort = 'name' and not descending then lower(coalesce(f.name, f.email)) end asc,
      case when p_sort = 'name' and descending then lower(coalesce(f.name, f.email)) end desc,
      case when p_sort = 'email' and not descending then lower(f.email) end asc,
      case when p_sort = 'email' and descending then lower(f.email) end desc,
      case when p_sort = 'plan' and not descending then f.plan end asc,
      case when p_sort = 'plan' and descending then f.plan end desc,
      case when p_sort = 'last_seen' and not descending then f.last_seen end asc nulls last,
      case when p_sort = 'last_seen' and descending then f.last_seen end desc nulls last,
      case when coalesce(p_sort, 'created_at') = 'created_at' and not descending then f.created_at end asc,
      case when coalesce(p_sort, 'created_at') = 'created_at' and descending then f.created_at end desc,
      f.id
    limit size offset skip;
end;
$$;
