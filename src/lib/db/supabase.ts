// @ts-nocheck
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Admin client — server-side only, bypasses RLS. This is the only client
// actually used anywhere in the codebase (verified: nothing imports an
// anon-key client — every read/write goes through the service role).
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
