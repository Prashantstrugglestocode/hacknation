import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const url = Constants.expoConfig?.extra?.supabaseUrl as string;
const anonKey = Constants.expoConfig?.extra?.supabaseAnonKey as string;

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: AsyncStorage as any,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
