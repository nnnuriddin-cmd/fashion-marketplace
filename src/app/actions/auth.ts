'use server';

import { createClient } from '@/lib/supabase/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

export async function signInAction(prevState: { error?: string } | null, formData: FormData) {
  const email = (formData.get('email') as string)?.trim();
  const password = formData.get('password') as string;

  if (!email || !password) {
    return { error: 'Please enter both email and password.' };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/', 'layout');
  redirect('/account');
}

export async function signOutAction() {
  const supabase = createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/account');
}

export async function signUpAction(prevState: { error?: string } | null, formData: FormData) {
  const fullName = (formData.get('fullName') as string)?.trim();
  const email = (formData.get('email') as string)?.trim().toLowerCase();
  const phone = (formData.get('phone') as string)?.trim() || null;
  const password = formData.get('password') as string;
  const confirmPassword = formData.get('confirmPassword') as string;

  // Validation
  if (!fullName) {
    return { error: 'Full name is required.' };
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'Please enter a valid email address.' };
  }
  if (!password || password.length < 6) {
    return { error: 'Password must be at least 6 characters long.' };
  }
  if (password !== confirmPassword) {
    return { error: 'Passwords do not match.' };
  }

  const adminDb = getServerSupabase();

  // Check if user already exists in public.users
  const { data: existingUser } = await adminDb
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (existingUser) {
    return { error: 'An account with this email already exists.' };
  }

  let createdAuthUserId: string | null = null;

  try {
    // Create user in Supabase Auth via admin API with email_confirm: true
    // This guarantees immediate account activation without SMTP rate limit issues
    const { data: authData, error: authError } = await adminDb.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        phone: phone || undefined,
      },
    });

    if (authError || !authData?.user) {
      return { error: authError?.message || 'Failed to create user account.' };
    }

    createdAuthUserId = authData.user.id;

    // Synchronize matching record in public.users
    // Invariants:
    // - Role is strictly 'CUSTOMER' (never seller, never admin)
    // - ID matches auth.users.id
    // - password_hash is set to safe placeholder 'SUPABASE_AUTH' (satisfies NOT NULL constraint)
    // - telegram fields are explicitly null
    const { error: profileError } = await adminDb
      .from('users')
      .insert({
        id: createdAuthUserId,
        email: email,
        full_name: fullName,
        phone: phone,
        role: 'CUSTOMER',
        password_hash: 'SUPABASE_AUTH',
        telegram_id: null,
        telegram_code: null,
      });

    if (profileError) {
      console.error('Failed to create customer profile in public.users');
      try {
        await adminDb.auth.admin.deleteUser(createdAuthUserId);
      } catch {
        console.error('Rollback deleteUser failed during profile creation failure');
      }
      return { error: 'Failed to create customer profile. Please try again.' };
    }

    // Establish authenticated session via cookie-aware SSR client
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      console.error('Sign-in after registration encountered an error');
    }
  } catch (err) {
    console.error('Unexpected error during registration lifecycle');
    if (createdAuthUserId) {
      try {
        await adminDb.auth.admin.deleteUser(createdAuthUserId);
      } catch {
        console.error('Rollback deleteUser failed in catch block');
      }
    }
    return { error: 'Registration failed. Please try again.' };
  }

  revalidatePath('/', 'layout');
  redirect('/account');
}
