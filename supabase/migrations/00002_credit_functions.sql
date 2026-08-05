-- ============================================================
-- Atomic credit spend / grant functions.
-- Called from the app with the service-role key via supabase.rpc().
-- ============================================================

create or replace function public.spend_credits(
  p_user_id uuid,
  p_amount integer,
  p_reason text,
  p_job_id uuid default null
)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_updated integer;
begin
  if p_amount <= 0 then
    raise exception 'spend amount must be positive';
  end if;

  -- Atomic conditional decrement; fails the WHERE when balance is short.
  update public.profiles
     set credits_balance = credits_balance - p_amount
   where id = p_user_id
     and credits_balance >= p_amount;
  get diagnostics v_updated = row_count;

  if v_updated = 0 then
    return false;
  end if;

  insert into public.credit_ledger (user_id, delta, reason, job_id)
  values (p_user_id, -p_amount, p_reason, p_job_id);

  return true;
end;
$$;

create or replace function public.grant_credits(
  p_user_id uuid,
  p_amount integer,
  p_reason text
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if p_amount <= 0 then
    raise exception 'grant amount must be positive';
  end if;

  update public.profiles
     set credits_balance = credits_balance + p_amount
   where id = p_user_id;

  insert into public.credit_ledger (user_id, delta, reason)
  values (p_user_id, p_amount, p_reason);
end;
$$;

-- Only the service role may call these.
revoke execute on function public.spend_credits(uuid, integer, text, uuid) from public, anon, authenticated;
revoke execute on function public.grant_credits(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.spend_credits(uuid, integer, text, uuid) to service_role;
grant execute on function public.grant_credits(uuid, integer, text) to service_role;
