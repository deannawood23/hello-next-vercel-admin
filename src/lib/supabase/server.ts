import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const supabaseProjectId = process.env.NEXT_PUBLIC_SUPABASE_PROJECT_ID;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseProjectId || !supabaseAnonKey) {
    throw new Error(
        'Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_PROJECT_ID and/or NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    );
}

const supabaseUrl = `https://${supabaseProjectId}.supabase.co`;

export function createSupabaseServerClient() {
    const cookieStore = cookies();

    return createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
            get(name) {
                return cookieStore.get(name)?.value;
            },
            set(name, value, options) {
                cookieStore.set({ name, value, ...options });
            },
            remove(name, options) {
                cookieStore.set({ name, value: '', ...options });
            },
        },
    });
}
