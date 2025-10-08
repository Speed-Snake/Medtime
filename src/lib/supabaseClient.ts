import 'react-native-get-random-values';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// ⛔️ CAMBIA ESTO POR TU DOMINIO REAL (Project Settings → API → Legacy API Keys → Project URL)
const SUPABASE_URL = 'https://aqpdfhqhkhxjofsybdsy.supabase.co';

// ⛔️ Pega aquí tu anon public key (Legacy API Keys → anon public)
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFxcGRmaHFoa2h4am9mc3liZHN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzOTgzMjcsImV4cCI6MjA3MTk3NDMyN30.ey1raLzz-RW36xxuBlHjECKNOq6YOEhFK5ayTtB5SA8'; // completa la tuya

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage as any,
    autoRefreshToken: true,
    persistSession: false,
    detectSessionInUrl: false,
  },
});
