import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '../../src/lib/supabase/server';

async function signOut() {
    'use server';

    const supabase = createSupabaseServerClient();
    await supabase.auth.signOut();
    redirect('/login');
}

export default async function ProtectedPage() {
    const supabase = createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    const user = data.user;

    if (!user) {
        redirect('/login?message=Please%20sign%20in%20to%20continue.');
    }

    return (
        <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white px-4 py-12 text-slate-900 sm:px-8">
            <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                <div className="space-y-2">
                    <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
                        Protected
                    </p>
                    <h1 className="font-[var(--font-playfair)] text-3xl font-semibold tracking-tight">
                        You&apos;re signed in
                    </h1>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    Signed in as <span className="font-semibold">{user.email}</span>
                </div>

                <form action={signOut}>
                    <button
                        type="submit"
                        className="w-full rounded-full border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                    >
                        Sign out
                    </button>
                </form>
            </div>
        </main>
    );
}
