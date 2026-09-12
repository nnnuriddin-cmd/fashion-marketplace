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
  const accountType = (formData.get('accountType') as string)?.trim();
  // Strictly enforce role: only 'SELLER' or 'CUSTOMER'. Never accept 'ADMIN' or arbitrary strings.
  const validatedRole: 'CUSTOMER' | 'SELLER' = accountType === 'SELLER' ? 'SELLER' : 'CUSTOMER';

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

  // Seller-specific validation
  const storeName = (formData.get('storeName') as string)?.trim();
  const city = (formData.get('city') as string)?.trim() || 'Tashkent';
  const storeDescription = (formData.get('storeDescription') as string)?.trim() || null;

  if (validatedRole === 'SELLER') {
    if (!phone) {
      return { error: 'Phone number is required for seller registration.' };
    }
    if (!storeName) {
      return { error: 'Store name is required for seller registration.' };
    }
    if (!city) {
      return { error: 'City is required.' };
    }
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
  let storeCreated = false;

  try {
    // 1. Create user in Supabase Auth via admin API with email_confirm: true
    const { data: authData, error: authError } = await adminDb.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        phone: phone || undefined,
        role: validatedRole,
      },
    });

    if (authError || !authData?.user) {
      return { error: authError?.message || 'Failed to create user account.' };
    }

    createdAuthUserId = authData.user.id;

    // 2. Synchronize matching record in public.users
    const { error: profileError } = await adminDb
      .from('users')
      .insert({
        id: createdAuthUserId,
        email: email,
        full_name: fullName,
        phone: phone,
        role: validatedRole,
        password_hash: 'SUPABASE_AUTH',
        telegram_id: null,
        telegram_code: null,
      });

    if (profileError) {
      console.error('Failed to create profile in public.users:', profileError);
      try {
        await adminDb.auth.admin.deleteUser(createdAuthUserId);
      } catch {
        console.error('Rollback deleteUser failed during profile creation failure');
      }
      return { error: 'Failed to create user profile. Please try again.' };
    }

    // 3. For SELLER, create store with unique deterministic slug and status = PENDING
    if (validatedRole === 'SELLER') {
      let baseSlug = storeName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      if (!baseSlug) baseSlug = 'store';

      let candidateSlug = baseSlug;
      let counter = 1;
      while (true) {
        const { data: existingStore } = await adminDb
          .from('stores')
          .select('id')
          .eq('slug', candidateSlug)
          .maybeSingle();

        if (!existingStore) break;
        counter++;
        candidateSlug = `${baseSlug}-${counter}`;
      }

      const { error: storeError } = await adminDb
        .from('stores')
        .insert({
          owner_id: createdAuthUserId,
          name: storeName,
          slug: candidateSlug,
          description: storeDescription,
          city: city,
          phone: phone,
          status: 'PENDING',
        });

      if (storeError) {
        console.error('Failed to create store record during seller registration:', storeError);
        try {
          await adminDb.from('users').delete().eq('id', createdAuthUserId);
          await adminDb.auth.admin.deleteUser(createdAuthUserId);
        } catch (rbErr) {
          console.error('Rollback failed after store creation failure:', rbErr);
        }
        return { error: 'Failed to create store profile. Please try again.' };
      }

      storeCreated = true;
    }

    // 4. Establish authenticated session via cookie-aware SSR client
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      console.error('Sign-in after registration encountered an error:', signInError);
      // Account and store are created; do not rollback. Inform user to sign in manually.
      return {
        success: true,
        role: validatedRole,
        warning: 'Account created successfully. Please sign in with your credentials.',
        redirectUrl: '/account',
      };
    }
  } catch (err) {
    console.error('Unexpected error during registration lifecycle:', err);
    if (createdAuthUserId) {
      try {
        if (storeCreated) {
          await adminDb.from('stores').delete().eq('owner_id', createdAuthUserId);
        }
        await adminDb.from('users').delete().eq('id', createdAuthUserId);
        await adminDb.auth.admin.deleteUser(createdAuthUserId);
      } catch {
        console.error('Rollback failed in catch block');
      }
    }
    return { error: 'Registration failed. Please try again.' };
  }

  revalidatePath('/', 'layout');
  return {
    success: true,
    role: validatedRole,
    redirectUrl: validatedRole === 'SELLER' ? '/seller/dashboard' : '/account',
  };
}
