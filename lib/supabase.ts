import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Supabase project credentials
const SUPABASE_URL = 'https://zuspbhabwlpxzmlxydgx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_KzgmXSkpNiajIPe9KGQKMA_Ff1pX8uJ';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
