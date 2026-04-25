import { supabase } from './supabase/client';
import { Session, User } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

export interface Profile {
  user_id: string;
  display_name: string | null;
  preferred_role: 'customer' | 'merchant' | null;
  first_login_completed: boolean;
  locale: string;
}

export const DEMO_EMAIL = 'demo@citywallet.dev';
export const DEMO_PASSWORD = 'CityWallet2026';

export async function signInWithPassword(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUpWithPassword(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signInDemo() {
  // Try login first; if account doesn't exist, sign up.
  try {
    return await signInWithPassword(DEMO_EMAIL, DEMO_PASSWORD);
  } catch {
    return await signUpWithPassword(DEMO_EMAIL, DEMO_PASSWORD);
  }
}

export async function signOut() {
  await supabase.auth.signOut();
  // Wipe any local profile cache so the next user gets a fresh walkthrough
  await AsyncStorage.multiRemove([
    'merchant_id',
    'cw_saved_offers_v1',
    'cw_savings_v1',
  ]);
}

export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error) return null;
  return data as Profile;
}

export async function markFirstLoginCompleted(userId: string) {
  await supabase
    .from('profiles')
    .update({ first_login_completed: true })
    .eq('user_id', userId);
}

export async function setPreferredRole(userId: string, role: 'customer' | 'merchant') {
  await supabase
    .from('profiles')
    .update({ preferred_role: role })
    .eq('user_id', userId);
}

// React hook
export function useSession() {
  const [session, setSession] = useState<Session | null | undefined>(undefined); // undefined = loading

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSession(data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (mounted) setSession(s);
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  return session;
}

export function useProfile(user: User | null | undefined) {
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  useEffect(() => {
    if (!user) { setProfile(null); return; }
    let mounted = true;
    getProfile(user.id).then(p => { if (mounted) setProfile(p); });
    return () => { mounted = false; };
  }, [user?.id]);
  return profile;
}
