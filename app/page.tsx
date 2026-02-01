'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../src/lib/supabaseClient';

type Image = {
    id: string;
    url: string | null;
    captions: { id: string; content: string | null }[];
};

export default function Home() {
    const [images, setImages] = useState<Image[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchImages = async () => {
            const { data, error: queryError } = await supabase
                .from('images')
                .select('id, url, captions ( id, content )');

            if (queryError) {
                setError(queryError.message);
                setImages([]);
            } else {
                const rows = (data ?? []) as Image[];
                const filtered = rows.filter(
                    (image) => image.captions && image.captions.length > 0
                );
                setImages(filtered);
                setError(null);
            }

            setLoading(false);
        };

        fetchImages();
    }, []);

    return (
        <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white px-4 py-10 text-slate-900 sm:px-8">
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
                <header className="space-y-2">
                    <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
                        Gallery
                    </p>
                    <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                        Captions
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
                                        {image.captions.map((caption) => (
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
