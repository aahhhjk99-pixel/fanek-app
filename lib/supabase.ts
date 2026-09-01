import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  '';

const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  '';

// On native, Supabase has no default storage adapter and silently keeps the
// session in memory only, so users were being signed out on every app
// restart. AsyncStorage persists it across launches. On web, the SDK's
// built-in localStorage-based storage already works, so we let it use its
// default there instead of passing AsyncStorage (which isn't meant for web).
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: Platform.OS === 'web' ? undefined : AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
