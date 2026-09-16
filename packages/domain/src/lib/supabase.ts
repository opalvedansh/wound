import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL'] || process.env['EXPO_PUBLIC_SUPABASE_URL'] || '';
// Anon key only. This package is bundled into web and mobile clients.
const supabaseKey = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] || process.env['EXPO_PUBLIC_SUPABASE_ANON_KEY'] || '';

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase credentials not found. Make sure SUPABASE_URL and SUPABASE_KEY are set.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);
