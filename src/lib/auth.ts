import { createClient } from '@/lib/supabase/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { User } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';

export interface AuthenticatedUserProfile {
  user: User;
  id: string;
  email: string;
  role: 'ADMIN' | 'SELLER' | 'CUSTOMER' | string;
  fullName: string;
}

/**
 * Retrieves the currently authenticated Supabase user from request cookies.
 * Uses `supabase.auth.getUser()` to securely validate the JWT on the Supabase Auth backend.
 * Never trusts unverified client state or client-supplied IDs.
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const supabase = createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }
    return user;
  } catch (err) {
    console.error('Error verifying Supabase user session:', err);
    return null;
  }
}

/**
 * Requires an authenticated user session.
 * Throws an error if no valid session is present.
 */
export async function requireAuthenticatedUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Unauthorized: Authentication required');
  }
  return user;
}

/**
 * Resolves the authenticated user's profile from `public.users` using their verified auth ID.
 * Authoritative role is derived strictly from `public.users.role`.
 */
export async function getCurrentUserProfile(): Promise<AuthenticatedUserProfile | null> {
  const authUser = await getCurrentUser();
  if (!authUser) return null;

  try {
    // We use getServerSupabase() here to reliably query public.users by authUser.id
    // ensuring the authoritative role from public.users is retrieved server-side
    const serverSupabase = getServerSupabase();
    const { data: profile, error } = await serverSupabase
      .from('users')
      .select('id, email, role, full_name')
      .eq('id', authUser.id)
      .maybeSingle();

    if (error || !profile) {
      console.error('Failed to fetch public.users profile for user:', authUser.id, error);
      return null;
    }

    return {
      user: authUser,
      id: profile.id,
      email: profile.email,
      role: profile.role,
      fullName: profile.full_name,
    };
  } catch (err) {
    console.error('Error retrieving authenticated user profile:', err);
    return null;
  }
}

/**
 * Enforces role-based server-side authorization.
 * 
 * Rules:
 * - If unauthenticated -> redirects to `unauthenticatedRedirect` (default: '/account')
 * - If role is not in `allowedRoles` -> redirects to `forbiddenRedirect` (default: '/')
 * - If authorized -> returns the verified AuthenticatedUserProfile
 */
export async function requireRole(
  allowedRoles: string[],
  unauthenticatedRedirect: string = '/account',
  forbiddenRedirect: string = '/'
): Promise<AuthenticatedUserProfile> {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect(unauthenticatedRedirect);
  }

  if (!allowedRoles.includes(profile.role)) {
    redirect(forbiddenRedirect);
  }

  return profile;
}

