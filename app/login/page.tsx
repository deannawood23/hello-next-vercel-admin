import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '../../src/lib/supabase/server';

type LoginPageProps = {
    searchParams?: Promise<{ message?: string }>;
};

async function signInWithGoogle() {
    'use server';

    try {
        const supabase = createSupabaseServerClient();
        const headerList = await headers();
        const host =
            headerList.get('x-forwarded-host') ?? headerList.get('host');
        const proto = headerList.get('x-forwarded-proto') ?? 'http';
        const origin = headerList.get('origin') ?? (host ? `${proto}://${host}` : '');

        if (!origin) {
            redirect('/login?message=Unable%20to%20determine%20origin.');
        }

        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${origin}/auth/callback`,
            },
        });

        if (error || !data?.url) {
            redirect(
                `/login?message=${encodeURIComponent(
                    error?.message ?? 'No OAuth URL returned'
                )}`
            );
        }

        redirect(data.url);
    } catch (error) {
        redirect('/login?message=Unable%20to%20sign%20in%20right%20now.');
    }
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
    const resolvedSearchParams = await searchParams;
    const message = resolvedSearchParams?.message;

    return (
        <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white px-4 py-12 text-slate-900 sm:px-8">
            <div className="mx-auto flex w-full max-w-md flex-col gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                <div className="space-y-2">
                    <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
                        Welcome back
                    </p>
                    <h1 className="font-[var(--font-playfair)] text-3xl font-semibold tracking-tight">
                        Sign in
                    </h1>
                </div>

                {message && (
                    <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                        {message}
                    </p>
                )}

                <form action={signInWithGoogle}>
                    <button
                        type="submit"
                        className="flex w-full items-center justify-center rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                        Sign in with Google
                    </button>
                </form>
            </div>
        </main>
    );
}
