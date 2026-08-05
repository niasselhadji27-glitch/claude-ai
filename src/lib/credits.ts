import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Atomically spend credits via the spend_credits Postgres function.
 * Returns false when the user has an insufficient balance.
 */
export async function spendCredits(
  userId: string,
  amount: number,
  reason: string,
  jobId?: string
): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("spend_credits", {
    p_user_id: userId,
    p_amount: amount,
    p_reason: reason,
    p_job_id: jobId ?? null,
  });
  if (error) throw new Error(`spend_credits failed: ${error.message}`);
  return data === true;
}

export async function grantCredits(
  userId: string,
  amount: number,
  reason: string
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.rpc("grant_credits", {
    p_user_id: userId,
    p_amount: amount,
    p_reason: reason,
  });
  if (error) throw new Error(`grant_credits failed: ${error.message}`);
}
