import 'server-only';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Returns a dedicated server-side Supabase client with service_role privileges.
 * 
 * SECURITY INVARIANTS:
 * 1. Protected by `import 'server-only'` — cannot be bundled into browser client bundles.
 * 2. Reads `SUPABASE_SERVICE_ROLE_KEY` (non-public, without NEXT_PUBLIC_ prefix).
 * 3. Throws an explicit configuration error if the key is missing.
 * 4. Must ONLY be used for privileged server-side mutations (such as checkout operations)
 *    where RLS policies require backend authority.
 */
export function getServerSupabase(): SupabaseClient {
  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
  }

  if (!serviceRoleKey) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY environment variable. ' +
      'Privileged server-side mutations require a configured service-role key.'
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
