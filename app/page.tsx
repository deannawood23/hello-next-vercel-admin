'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../src/lib/supabaseClient';

type Caption = {
    id: string | number;
    content: string | null;
};

export default function Home() {
    const [captions, setCaptions] = useState<Caption[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchCaptions = async () => {
            const { data, error: queryError } = await supabase
                .from('captions')
                .select('id, content');

            if (queryError) {
                setError(queryError.message);
                setCaptions([]);
            } else {
                setCaptions(data ?? []);
                setError(null);
            }

            setLoading(false);
        };

        fetchCaptions();
    }, []);

    return (
        <main className="min-h-screen bg-white px-6 py-10 text-slate-900">
            <h1 className="mb-6 text-3xl font-semibold">Captions</h1>

            {loading && <p>Loading...</p>}
            {error && !loading && <p>Error: {error}</p>}

            {!loading && !error && (
                <ul className="list-disc space-y-2 pl-5">
                    {captions.map((caption) => (
                        <li key={caption.id}>
                            {caption.content ?? '(empty caption)'}
                        </li>
                    ))}
                </ul>
            )}
        </main>
    );
}
