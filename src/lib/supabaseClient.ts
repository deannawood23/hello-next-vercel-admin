import { createClient } from '@supabase/supabase-js';

const supabaseProjectId = process.env.NEXT_PUBLIC_SUPABASE_PROJECT_ID;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseProjectId || !supabaseAnonKey) {
    throw new Error(
        'Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_PROJECT_ID and/or NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    );
}

const supabaseUrl = `https://${supabaseProjectId}.supabase.co`;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
