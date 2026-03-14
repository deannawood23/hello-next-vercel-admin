import { revalidatePath } from 'next/cache';
import { DataTable } from '../../../components/admin/DataTable';
import { requireSuperadmin } from '../../../src/lib/auth/requireSuperadmin';
import { asRecord, formatDate, pickBool, pickDateValue, pickString } from '../_lib';

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

export default async function AdminUsersPage({
    searchParams,
}: {
    searchParams?: Promise<{ q?: string }>;
}) {
    const { supabase } = await requireSuperadmin();
    const params = searchParams ? await searchParams : undefined;
    const query = String(params?.q ?? '').trim().toLowerCase();

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
    const filteredData = data.filter((raw) => {
        if (!query) {
            return true;
        }

        const row = asRecord(raw);
        const id = pickString(row, ['id'], '').toLowerCase();
        const email = pickString(row, ['email'], '').toLowerCase();
        return id.includes(query) || email.includes(query);
    });

    const rows = filteredData.map((raw) => {
        const row = asRecord(raw);
        const id = pickString(row, ['id'], 'N/A');
        const email = pickString(row, ['email'], 'Unavailable');
        const isSuperadmin = pickBool(row, ['is_superadmin']);
        const createdAt = formatDate(
            pickDateValue(row, ['created_at', 'created_datetime_utc'])
        );

        return [
            <div className="flex max-w-[240px] items-center gap-2" key={`email-${id}`}>
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[#C2C8D2]">
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        className="h-4 w-4"
                        aria-hidden="true"
                    >
                        <circle cx="12" cy="8" r="3.25" />
                        <path d="M5 19a7 7 0 0 1 14 0" />
                    </svg>
                </span>
                <span className="truncate">{email}</span>
            </div>,
            <span className="inline-block min-w-[180px] font-mono text-xs" key={`id-${id}`}>
                {id}
            </span>,
            <span key={`created-${id}`}>{createdAt}</span>,
            <div className="flex items-center gap-3" key={`role-${id}`}>
                <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                        isSuperadmin
                            ? 'bg-emerald-400/20 text-emerald-200'
                            : 'bg-white/10 text-[#B6BCC6]'
                    }`}
                >
                    {isSuperadmin ? 'Super Admin' : 'User'}
                </span>
            </div>,
            <form action={toggleSuperadmin} key={`action-${id}`}>
                <input type="hidden" name="profile_id" value={id} />
                <input type="hidden" name="current_value" value={String(isSuperadmin)} />
                <button
                    type="submit"
                    className="group inline-flex items-center gap-3 rounded-full border border-white/10 bg-black/20 px-2 py-1 text-xs text-[#D4D8DF] transition hover:border-white/20"
                    aria-label={
                        isSuperadmin
                            ? `Turn off super admin for ${email}`
                            : `Turn on super admin for ${email}`
                    }
                >
                    <span
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                            isSuperadmin ? 'bg-emerald-500/70' : 'bg-white/15'
                        }`}
                    >
                        <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition ${
                                isSuperadmin ? 'translate-x-5' : 'translate-x-0.5'
                            }`}
                        />
                    </span>
                    <span className="font-semibold">
                        {isSuperadmin ? 'On' : 'Off'}
                    </span>
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
            <form className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 md:grid-cols-[minmax(0,1fr)_auto]">
                <label className="space-y-1">
                    <span className="text-xs uppercase tracking-[0.14em] text-[#8A8F98]">
                        Search by email or ID
                    </span>
                    <input
                        type="search"
                        name="q"
                        defaultValue={query}
                        placeholder="Search users..."
                        className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-[#EDEDEF] outline-none placeholder:text-[#7E8590] focus:border-[#5E6AD2]/70"
                    />
                </label>
                <div className="flex items-end gap-2">
                    <button
                        type="submit"
                        className="rounded-lg border border-[#5E6AD2]/50 bg-[#5E6AD2]/25 px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#5E6AD2]/35"
                    >
                        Search
                    </button>
                    {query ? (
                        <a
                            href="/admin/users"
                            className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm font-semibold text-[#D4D8DF] transition hover:border-white/20"
                        >
                            Clear
                        </a>
                    ) : null}
                </div>
            </form>
            <DataTable
                columns={['Email', 'ID', 'Sign Up Date', 'Role', 'Toggle Super Admin']}
                rows={rows}
                emptyMessage={query ? 'No users match that email or ID.' : 'No profile rows found.'}
            />
        </div>
    );
}
