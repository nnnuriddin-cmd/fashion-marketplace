import fs from 'fs';
import path from 'path';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

// ============================================================================
// Types
// ============================================================================

interface PublicUser {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  phone?: string | null;
  role: string;
  telegram_id?: string | null;
  telegram_code?: string | null;
  created_at?: string;
  updated_at?: string;
}

interface StoreRecord {
  id: string;
  name: string;
  owner_id: string;
  status: string;
}

type AuthAction = 'CREATE' | 'SKIP' | 'CONFLICT';

interface UserReconciliationPlan {
  publicUser: PublicUser;
  authStatus: string;
  action: AuthAction;
  reason: string;
  matchingAuthUser?: User;
}

// ============================================================================
// Environment Configuration Loader
// ============================================================================

function parseEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf8');
  const result: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.substring(0, eqIdx).trim();
    let val = trimmed.substring(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    result[key] = val;
  }
  return result;
}

function initSupabaseAdmin(): SupabaseClient {
  const envLocal = parseEnvFile(path.join(process.cwd(), '.env.local'));
  const envDefault = parseEnvFile(path.join(process.cwd(), '.env'));

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    envLocal.NEXT_PUBLIC_SUPABASE_URL ||
    envDefault.NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    envLocal.SUPABASE_SERVICE_ROLE_KEY ||
    envDefault.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable.');
  }

  if (!serviceRoleKey) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY environment variable. ' +
      'Admin provisioning requires the service_role key to access auth.admin APIs.'
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// ============================================================================
// Reconciliation & Verification Logic
// ============================================================================

async function fetchPublicUsers(supabase: SupabaseClient): Promise<PublicUser[]> {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, password_hash, full_name, phone, role, telegram_id, telegram_code, created_at, updated_at')
    .order('role', { ascending: true })
    .order('email', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch public.users: ${error.message}`);
  }

  return data as PublicUser[];
}

async function fetchAllAuthUsers(supabase: SupabaseClient): Promise<User[]> {
  const authUsers: User[] = [];
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw new Error(`Failed to list auth.users: ${error.message}`);
    }

    const users = data?.users || [];
    authUsers.push(...users);

    if (users.length < perPage) {
      break;
    }
    page++;
  }

  return authUsers;
}

async function fetchStores(supabase: SupabaseClient): Promise<StoreRecord[]> {
  const { data, error } = await supabase
    .from('stores')
    .select('id, name, owner_id, status')
    .order('name', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch stores: ${error.message}`);
  }

  return data as StoreRecord[];
}

function buildReconciliationPlan(
  publicUsers: PublicUser[],
  authUsers: User[]
): UserReconciliationPlan[] {
  const authById = new Map<string, User>();
  const authByEmail = new Map<string, User>();

  for (const au of authUsers) {
    authById.set(au.id, au);
    if (au.email) {
      authByEmail.set(au.email.toLowerCase(), au);
    }
  }

  const plan: UserReconciliationPlan[] = [];

  for (const pu of publicUsers) {
    const matchingById = authById.get(pu.id);
    const matchingByEmail = authByEmail.get(pu.email.toLowerCase());

    if (matchingById) {
      if (matchingById.email?.toLowerCase() === pu.email.toLowerCase()) {
        plan.push({
          publicUser: pu,
          authStatus: 'EXISTS (UUID & email match)',
          action: 'SKIP',
          reason: 'Auth user already provisioned with exact same UUID and email.',
          matchingAuthUser: matchingById,
        });
      } else {
        plan.push({
          publicUser: pu,
          authStatus: 'CONFLICT (UUID match, email mismatch)',
          action: 'CONFLICT',
          reason: `Auth user with UUID ${pu.id} exists but has email "${matchingById.email}".`,
          matchingAuthUser: matchingById,
        });
      }
    } else if (matchingByEmail) {
      plan.push({
        publicUser: pu,
        authStatus: 'CONFLICT (Email taken by different UUID)',
        action: 'CONFLICT',
        reason: `Email "${pu.email}" is already registered to different auth UUID: ${matchingByEmail.id}.`,
        matchingAuthUser: matchingByEmail,
      });
    } else {
      plan.push({
        publicUser: pu,
        authStatus: 'ABSENT (Not in auth.users)',
        action: 'CREATE',
        reason: 'User does not exist in auth.users. Will create with preserved UUID.',
      });
    }
  }

  return plan;
}

function printPlanTable(plans: UserReconciliationPlan[]): void {
  console.log('\n================================================================================================');
  console.log('                               PROVISIONING RECONCILIATION PLAN                                ');
  console.log('================================================================================================');
  console.log(
    '#'.padEnd(4) +
    'ROLE'.padEnd(10) +
    'EMAIL'.padEnd(25) +
    'PUBLIC USER UUID'.padEnd(38) +
    'ACTION'.padEnd(10) +
    'STATUS'
  );
  console.log('-'.repeat(110));

  plans.forEach((p, idx) => {
    const num = (idx + 1).toString().padEnd(4);
    const role = p.publicUser.role.padEnd(10);
    const email = p.publicUser.email.padEnd(25);
    const id = p.publicUser.id.padEnd(38);
    const action = p.action.padEnd(10);
    const status = p.authStatus;
    console.log(`${num}${role}${email}${id}${action}${status}`);
  });

  console.log('='.repeat(110));
}

// ============================================================================
// Apply Phase (Guarded by --apply)
// ============================================================================

async function applyProvisioning(
  supabase: SupabaseClient,
  plans: UserReconciliationPlan[]
): Promise<void> {
  const toCreate = plans.filter((p) => p.action === 'CREATE');
  const conflicts = plans.filter((p) => p.action === 'CONFLICT');

  if (conflicts.length > 0) {
    console.error(`\n❌ ERROR: Found ${conflicts.length} conflict(s). Aborting before applying any mutations.`);
    conflicts.forEach((c) => {
      console.error(`  - User ${c.publicUser.email} (${c.publicUser.id}): ${c.reason}`);
    });
    throw new Error('Provisioning halted due to conflicts. Resolve conflicts before running --apply.');
  }

  if (toCreate.length === 0) {
    console.log('\n✨ No users require creation. All records are already provisioned.');
    return;
  }

  console.log(`\n🚀 Executing provisioning for ${toCreate.length} user(s)...`);

  for (const item of toCreate) {
    const pu = item.publicUser;
    console.log(`\n-> Creating auth user for: ${pu.email} (UUID: ${pu.id}, Role: ${pu.role})`);

    // Invariant verification: Ensure password is provided
    if (!pu.password_hash) {
      throw new Error(`Public user ${pu.id} (${pu.email}) has no password value.`);
    }

    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      id: pu.id,
      email: pu.email,
      password: pu.password_hash,
      email_confirm: true,
      user_metadata: {
        full_name: pu.full_name,
        role: pu.role,
        phone: pu.phone || undefined,
      },
    });

    if (createError) {
      throw new Error(`Failed to create auth user for ${pu.email}: ${createError.message}`);
    }

    const createdUser = createData.user;
    if (!createdUser) {
      throw new Error(`Failed to receive created user object for ${pu.email}.`);
    }

    // Strict Post-Creation Invariants Check:
    if (createdUser.id !== pu.id) {
      throw new Error(
        `CRITICAL SECURITY VIOLATION: Created auth user ID (${createdUser.id}) does not match public.users ID (${pu.id})!`
      );
    }

    if (createdUser.email?.toLowerCase() !== pu.email.toLowerCase()) {
      throw new Error(
        `CRITICAL ERROR: Created auth user email (${createdUser.email}) does not match public user email (${pu.email})!`
      );
    }

    if (!createdUser.email_confirmed_at) {
      throw new Error(`CRITICAL ERROR: Auth user for ${pu.email} was created but email_confirmed_at is not set!`);
    }

    const hasEmailIdentity = createdUser.identities?.some(
      (ident) => ident.provider === 'email'
    );

    console.log(`   ✅ Successfully provisioned & verified:`);
    console.log(`      UUID match:      ${createdUser.id} === ${pu.id}`);
    console.log(`      Email confirmed: ${createdUser.email_confirmed_at}`);
    console.log(`      Email identity:  ${hasEmailIdentity !== undefined ? (hasEmailIdentity ? 'Present' : 'Not listed') : 'N/A'}`);
  }

  console.log('\n🎉 All target users provisioned successfully!');
}

// ============================================================================
// Final Integrity Verification
// ============================================================================

async function verifyIntegrity(
  supabase: SupabaseClient,
  initialPublicCount: number,
  initialStores: StoreRecord[]
): Promise<boolean> {
  console.log('\n================================================================================================');
  console.log('                               INTEGRITY VERIFICATION AUDIT                                     ');
  console.log('================================================================================================');

  // 1. Verify public.users count and integrity
  const currentPublicUsers = await fetchPublicUsers(supabase);
  console.log(`1. public.users count: ${currentPublicUsers.length} (Initial: ${initialPublicCount})`);
  if (currentPublicUsers.length !== initialPublicCount) {
    console.error('❌ FAIL: public.users count changed during provisioning!');
    return false;
  }

  // 2. Verify all public.users have matching auth.users
  const currentAuthUsers = await fetchAllAuthUsers(supabase);
  const currentAuthMap = new Map(currentAuthUsers.map((u) => [u.id, u]));

  let allMatched = true;
  for (const pu of currentPublicUsers) {
    const authUser = currentAuthMap.get(pu.id);
    if (!authUser) {
      console.error(`❌ MISSING: public user ${pu.email} (${pu.id}) not found in auth.users!`);
      allMatched = false;
    } else if (authUser.email?.toLowerCase() !== pu.email.toLowerCase()) {
      console.error(`❌ MISMATCH: public user ${pu.id} email ${pu.email} != auth email ${authUser.email}!`);
      allMatched = false;
    }
  }

  if (allMatched) {
    console.log(`2. UUID & Email 1-to-1 mapping: 100% verified for all ${currentPublicUsers.length} users.`);
  } else {
    console.error('2. UUID & Email 1-to-1 mapping: FAILED some checks.');
  }

  // 3. Verify stores.owner_id foreign key consistency
  const currentStores = await fetchStores(supabase);
  console.log(`3. stores count: ${currentStores.length} (Initial: ${initialStores.length})`);
  
  const publicUserIds = new Set(currentPublicUsers.map((u) => u.id));
  let storesIntact = true;

  for (const store of currentStores) {
    if (!publicUserIds.has(store.owner_id)) {
      console.error(`❌ FAIL: Store "${store.name}" owner_id ${store.owner_id} does not exist in public.users!`);
      storesIntact = false;
    }
    const initialMatch = initialStores.find((s) => s.id === store.id);
    if (!initialMatch || initialMatch.owner_id !== store.owner_id) {
      console.error(`❌ FAIL: Store "${store.name}" owner_id was altered!`);
      storesIntact = false;
    }
  }

  if (storesIntact) {
    console.log(`   All ${currentStores.length} stores retain exact original owner_id relationships.`);
  }

  const overallSuccess = allMatched && storesIntact && currentPublicUsers.length === initialPublicCount;
  console.log('='.repeat(110));
  console.log(`Integrity Verification Result: ${overallSuccess ? '✅ PASSED' : '❌ FAILED'}`);
  console.log('='.repeat(110));

  return overallSuccess;
}

// ============================================================================
// Main CLI Entrypoint
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const isApply = args.includes('--apply');
  const isVerifyOnly = args.includes('--verify');

  console.log('================================================================================================');
  console.log('                   TRENDMALL SUPABASE AUTH PROVISIONING TOOL                                    ');
  console.log('================================================================================================');
  console.log(`Execution Mode: ${isApply ? '🔥 APPLY (LIVE MUTATION)' : isVerifyOnly ? '🔍 VERIFY ONLY' : '🛡️  DRY-RUN (READ-ONLY)'}`);

  const supabase = initSupabaseAdmin();

  // 1. Fetch baseline data
  const publicUsers = await fetchPublicUsers(supabase);
  const authUsers = await fetchAllAuthUsers(supabase);
  const stores = await fetchStores(supabase);

  console.log(`\nLive Database State:`);
  console.log(`- public.users: ${publicUsers.length} records`);
  console.log(`- auth.users:   ${authUsers.length} records`);
  console.log(`- stores:       ${stores.length} records`);

  if (isVerifyOnly) {
    const ok = await verifyIntegrity(supabase, publicUsers.length, stores);
    process.exit(ok ? 0 : 1);
  }

  // 2. Build reconciliation plan
  const plan = buildReconciliationPlan(publicUsers, authUsers);
  printPlanTable(plan);

  const summary = {
    totalPublicUsers: publicUsers.length,
    existingAuthUsers: authUsers.length,
    plannedCreate: plan.filter((p) => p.action === 'CREATE').length,
    plannedSkip: plan.filter((p) => p.action === 'SKIP').length,
    plannedConflict: plan.filter((p) => p.action === 'CONFLICT').length,
  };

  console.log('\nPlan Summary:');
  console.log(`- Total public.users:   ${summary.totalPublicUsers}`);
  console.log(`- Total auth.users:     ${summary.existingAuthUsers}`);
  console.log(`- Actions: CREATE: ${summary.plannedCreate} | SKIP: ${summary.plannedSkip} | CONFLICT: ${summary.plannedConflict}`);

  if (!isApply) {
    console.log('\n🛡️  [DRY-RUN COMPLETED] Zero changes were made to auth.users, public.users, or stores.');
    console.log('To execute this plan and provision auth users, run with:');
    console.log('  npx tsx scripts/provision-auth-users.ts --apply\n');
    return;
  }

  // 3. Apply changes if --apply was passed
  await applyProvisioning(supabase, plan);

  // 4. Run post-apply integrity verification
  const verificationPassed = await verifyIntegrity(supabase, publicUsers.length, stores);
  if (!verificationPassed) {
    console.error('Post-provisioning integrity verification failed!');
    process.exit(1);
  }

  console.log('\n🎉 Auth provisioning and post-run verification completed successfully!');
}

main().catch((err) => {
  console.error('\n❌ Fatal Error during script execution:');
  console.error(err.message || err);
  process.exit(1);
});
