import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || 'https://byixlfiypxnbfehesibl.supabase.co';
const supabaseKey = (import.meta as any).env.VITE_SUPABASE_KEY || 'sb_publishable_UuEA_RP4zUjK2GprnTrZpw_hn4OQK-x';

export const supabase = createClient(supabaseUrl, supabaseKey);
