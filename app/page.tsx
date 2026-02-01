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
        <main className="min-h-screen bg-white px-6 py-10 text-slate-900">
            <h1 className="mb-6 text-3xl font-semibold">Captions</h1>

            {loading && <p>Loading...</p>}
            {error && !loading && <p>Error: {error}</p>}

            {!loading && !error && (
                <div className="space-y-10">
                    {images.map((image) => (
                        <section key={image.id} className="space-y-3">
                            {image.url && (
                                <img
                                    src={image.url}
                                    alt=""
                                    className="max-w-xl rounded-lg"
                                />
                            )}
                            {image.captions && image.captions.length > 0 && (
                                <ul className="list-disc space-y-2 pl-5">
                                    {image.captions.map((caption) => (
                                        <li key={caption.id}>
                                            {caption.content ?? '(empty caption)'}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    ))}
                </div>
            )}
        </main>
    );
}
