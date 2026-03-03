import { revalidatePath } from 'next/cache';
import { DataTable } from '../../../components/admin/DataTable';
import { requireSuperadmin } from '../../../src/lib/auth/requireSuperadmin';
import { asRecord, formatDate, pickBool, pickDateValue, pickString, shortId } from '../_lib';

async function toggleSuperadmin(formData: FormData) {
    'use server';

    const profileId = String(formData.get('profile_id') ?? '');
    const currentValue = String(formData.get('current_value') ?? '') === 'true';

    if (!profileId) {
        return;
    }

    const { supabase } = await requireSuperadmin();

    await supabase
        .from('profiles')
        .update({ is_superadmin: !currentValue })
        .eq('id', profileId);

    revalidatePath('/admin/users');
    revalidatePath('/admin');
}

export default async function AdminUsersPage() {
    const { supabase } = await requireSuperadmin();

    const primary = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
    const fallback = primary.error
        ? await supabase
              .from('profiles')
              .select('*')
              .order('created_datetime_utc', { ascending: false })
              .limit(200)
        : null;
    const data = primary.error ? fallback?.data ?? [] : primary.data ?? [];

    const rows = data.map((raw) => {
        const row = asRecord(raw);
        const id = pickString(row, ['id'], 'N/A');
        const email = pickString(row, ['email'], 'Unavailable');
        const username = pickString(row, ['username', 'name', 'display_name'], 'N/A');
        const isSuperadmin = pickBool(row, ['is_superadmin']);
        const createdAt = formatDate(
            pickDateValue(row, ['created_at', 'created_datetime_utc'])
        );

        return [
            <span className="font-mono text-xs" key={`id-${id}`}>
                {shortId(id)}
            </span>,
            <span key={`email-${id}`}>{email}</span>,
            <span key={`username-${id}`}>{username}</span>,
            <span
                key={`superadmin-${id}`}
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                    isSuperadmin
                        ? 'bg-emerald-400/20 text-emerald-200'
                        : 'bg-white/10 text-[#B6BCC6]'
                }`}
            >
                {isSuperadmin ? 'true' : 'false'}
            </span>,
            <span key={`created-${id}`}>{createdAt}</span>,
            <form action={toggleSuperadmin} key={`action-${id}`}>
                <input type="hidden" name="profile_id" value={id} />
                <input type="hidden" name="current_value" value={String(isSuperadmin)} />
                <button
                    type="submit"
                    className="rounded-lg border border-[#5E6AD2]/50 bg-[#5E6AD2]/25 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-[#5E6AD2]/35"
                >
                    Toggle Superadmin
                </button>
            </form>,
        ];
    });

    return (
        <div className="space-y-4">
            <div>
                <h2 className="font-[var(--font-playfair)] text-3xl font-semibold tracking-tight text-[#EDEDEF]">Users</h2>
                <p className="mt-1 text-sm text-[#A6ACB6]">Manage profiles and superadmin access.</p>
            </div>
            <DataTable
                columns={['ID', 'Email', 'Username / Name', 'is_superadmin', 'Created', 'Actions']}
                rows={rows}
                emptyMessage="No profile rows found."
            />
        </div>
    );
}
