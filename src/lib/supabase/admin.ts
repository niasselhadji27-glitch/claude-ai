import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client for webhooks, job callbacks and credit operations.
 * Bypasses RLS — never expose to the browser and never use with
 * user-controlled table/column names.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
