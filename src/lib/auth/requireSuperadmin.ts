import { redirect } from 'next/navigation';
import { requireUser } from './requireUser';

export async function requireSuperadmin() {
    const { user, supabase } = await requireUser();

    const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, is_superadmin')
        .eq('id', user.id)
        .maybeSingle();

    if (error || profile?.is_superadmin !== true) {
        redirect('/login');
    }

    return { user, supabase, profile };
}
