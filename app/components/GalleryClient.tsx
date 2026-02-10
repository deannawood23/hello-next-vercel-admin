'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../src/lib/supabase/client';

type Image = {
    id: string;
    url: string | null;
    created_datetime_utc: string;
    captions: {
        id: string;
        content: string | null;
        created_datetime_utc: string;
    }[];
};

export function GalleryClient() {
    const router = useRouter();
    const [images, setImages] = useState<Image[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [signingOut, setSigningOut] = useState(false);

    useEffect(() => {
        let isMounted = true;

        const fetchImages = async () => {
            const { data, error: queryError } = await supabase
                .from('images')
                .select(
                    'id, url, created_datetime_utc, captions ( id, content, created_datetime_utc )'
                )
                .order('created_datetime_utc', { ascending: false });

            if (!isMounted) {
                return;
            }

            if (queryError) {
                setError(queryError.message);
                setImages([]);
            } else {
                const rows = (data ?? []) as Image[];
                const normalized = rows.map((image) => ({
                    ...image,
                    captions: Array.isArray(image.captions)
                        ? [...image.captions].sort(
                              (a, b) =>
                                  Date.parse(b.created_datetime_utc) -
                                  Date.parse(a.created_datetime_utc)
                          )
                        : [],
                }));
                const filtered = normalized.filter(
                    (image) => image.captions.length > 0
                );
                const sortedImages = filtered.sort((a, b) => {
                    const aLatest =
                        a.captions.length > 0
                            ? Date.parse(a.captions[0].created_datetime_utc)
                            : 0;
                    const bLatest =
                        b.captions.length > 0
                            ? Date.parse(b.captions[0].created_datetime_utc)
                            : 0;
                    return bLatest - aLatest;
                });
                setImages(sortedImages);
                setError(null);
            }

            setLoading(false);
        };

        fetchImages();

        const channel = supabase
            .channel('images-captions-live')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'images' },
                () => {
                    fetchImages();
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'captions' },
                () => {
                    fetchImages();
                }
            )
            .subscribe();

        return () => {
            isMounted = false;
            supabase.removeChannel(channel);
        };
    }, []);

    const handleSignOut = async () => {
        setSigningOut(true);
        const { error: signOutError } = await supabase.auth.signOut();

        if (signOutError) {
            setError(signOutError.message);
            setSigningOut(false);
            return;
        }

        router.push('/login');
        router.refresh();
    };

    return (
        <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white px-4 py-10 text-slate-900 sm:px-8">
            <button
                type="button"
                onClick={handleSignOut}
                className="fixed right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Sign out"
                disabled={signingOut}
            >
                <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5"
                >
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                    <path d="M10 17l5-5-5-5" />
                    <path d="M15 12H3" />
                </svg>
            </button>
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
                <header className="space-y-2">
                    <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
                        Gallery
                    </p>
                    <h1 className="font-[var(--font-playfair)] text-3xl font-semibold tracking-tight sm:text-4xl">
                        Crackd Captions
                    </h1>
                </header>

                {loading && <p className="text-slate-600">Loading...</p>}
                {error && !loading && (
                    <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">
                        Error: {error}
                    </p>
                )}

                {!loading && !error && (
                    <div className="space-y-10">
                        {images.map((image) => (
                            <section
                                key={image.id}
                                className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
                            >
                                {image.url && (
                                    <img
                                        src={image.url}
                                        alt=""
                                        className="h-auto w-full rounded-xl"
                                    />
                                )}
                                {image.captions && image.captions.length > 0 && (
                                    <ul className="list-disc space-y-2 pl-5 text-slate-700">
                                        {image.captions
                                            .slice(0, 10)
                                            .map((caption) => (
                                            <li key={caption.id}>
                                                {caption.content ??
                                                    '(empty caption)'}
                                            </li>
                                            ))}
                                    </ul>
                                )}
                            </section>
                        ))}
                    </div>
                )}
            </div>
        </main>
    );
}
