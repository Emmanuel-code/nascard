import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hkcermcicstagvvyyutf.supabase.co';

const rawAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
export const isSupabaseConfigured =
  Boolean(rawAnonKey) &&
  rawAnonKey !== '' &&
  rawAnonKey !== 'REPLACE_WITH_YOUR_SUPABASE_ANON_KEY';

// Fallback dummy JWT payload to prevent createClient from throwing 'supabaseKey is required'
const SUPABASE_ANON_KEY = isSupabaseConfigured
  ? (rawAnonKey as string)
  : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder_anon_key';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: isSupabaseConfigured,
    persistSession: isSupabaseConfigured,
    detectSessionInUrl: false,
  },
});

