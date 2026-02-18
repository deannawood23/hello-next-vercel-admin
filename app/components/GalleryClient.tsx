'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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

type CaptionSessionItem = {
    imageId: string;
    imageUrl: string | null;
    caption: {
        id: string;
        content: string | null;
        created_datetime_utc: string;
    };
};

type GalleryClientProps = {
    userEmail: string;
};

const CAPTIONS_PER_SESSION = 10;

export function GalleryClient({ userEmail }: GalleryClientProps) {
    const router = useRouter();
    const seenCaptionIdsRef = useRef<Set<string>>(new Set());
    const fetchMoreCaptionsRef = useRef<(() => Promise<void>) | null>(null);
    const [captionItems, setCaptionItems] = useState<CaptionSessionItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [signingOut, setSigningOut] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [authChecked, setAuthChecked] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);
    const [voteSaving, setVoteSaving] = useState(false);
    const [voteError, setVoteError] = useState<string | null>(null);
    const [votesByCaption, setVotesByCaption] = useState<Record<string, number>>({});

    const currentItem = captionItems[currentIndex] ?? null;
    const nextItem = captionItems[currentIndex + 1] ?? null;
    const isLastCaption = currentIndex >= captionItems.length - 1;
    const selectedVote = currentItem
        ? votesByCaption[currentItem.caption.id] ?? null
        : null;
    const canVote = authChecked && !!userId;

    const preloadImageUrl = useMemo(() => {
        if (!currentItem || !nextItem) {
            return null;
        }
        if (!nextItem.imageUrl || nextItem.imageUrl === currentItem.imageUrl) {
            return null;
        }
        return nextItem.imageUrl;
    }, [currentItem, nextItem]);

    useEffect(() => {
        let isMounted = true;
        let activeUserId: string | null = null;

        const fetchVotesForCaptionIds = async (
            profileId: string,
            captionIds: string[]
        ) => {
            if (captionIds.length === 0) {
                return;
            }

            const { data, error: votesError } = await supabase
                .from('caption_votes')
                .select('caption_id, vote_value')
                .eq('profile_id', profileId)
                .in('caption_id', captionIds);

            if (!isMounted || votesError) {
                return;
            }

            const mappedVotes: Record<string, number> = {};
            for (const row of data ?? []) {
                mappedVotes[row.caption_id] = row.vote_value;
            }
            setVotesByCaption((prev) => ({
                ...prev,
                ...mappedVotes,
            }));
        };

        const fetchUser = async () => {
            const { data, error: userError } = await supabase.auth.getUser();

            if (!isMounted) {
                return null;
            }

            if (userError) {
                setUserId(null);
                setAuthChecked(true);
                return null;
            }

            const id = data.user?.id ?? null;
            activeUserId = id;
            setUserId(id);
            setAuthChecked(true);
            return id;
        };

        const fetchImages = async (
            profileId: string | null,
            reset: boolean
        ) => {
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
                setCaptionItems([]);
                setVotesByCaption({});
                setLoading(false);
                return;
            }

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

            const filtered = normalized.filter((image) => image.captions.length > 0);
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

            const sessionCaptions = sortedImages
                .flatMap((image) =>
                    image.captions.map((caption) => ({
                        imageId: image.id,
                        imageUrl: image.url,
                        caption,
                    }))
                );

            if (reset) {
                const initialBatch = sessionCaptions.slice(0, CAPTIONS_PER_SESSION);
                seenCaptionIdsRef.current = new Set(
                    initialBatch.map((item) => item.caption.id)
                );
                setCaptionItems(initialBatch);
                setCurrentIndex(0);
                if (profileId) {
                    await fetchVotesForCaptionIds(
                        profileId,
                        initialBatch.map((item) => item.caption.id)
                    );
                } else {
                    setVotesByCaption({});
                }
                setError(null);
                setLoading(false);
                return;
            }

            const unseenCaptions = sessionCaptions.filter(
                (item) => !seenCaptionIdsRef.current.has(item.caption.id)
            );
            const nextBatch = unseenCaptions.slice(0, CAPTIONS_PER_SESSION);

            if (nextBatch.length > 0) {
                for (const item of nextBatch) {
                    seenCaptionIdsRef.current.add(item.caption.id);
                }
                setCaptionItems((prev) => [...prev, ...nextBatch]);
                if (profileId) {
                    await fetchVotesForCaptionIds(
                        profileId,
                        nextBatch.map((item) => item.caption.id)
                    );
                }
            }

            setError(null);
            setLoading(false);
        };

        fetchMoreCaptionsRef.current = async () => {
            await fetchImages(activeUserId, false);
        };

        const bootstrap = async () => {
            const profileId = await fetchUser();
            await fetchImages(profileId, true);
        };

        bootstrap();

        const channel = supabase
            .channel('images-captions-live')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'images' },
                () => {
                    fetchImages(activeUserId, false);
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'captions' },
                () => {
                    fetchImages(activeUserId, false);
                }
            )
            .subscribe();

        const pollId = window.setInterval(() => {
            fetchImages(activeUserId, false);
        }, 15000);

        return () => {
            isMounted = false;
            window.clearInterval(pollId);
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

    const goToNextCaption = () => {
        setVoteError(null);
        const nextIndex = currentIndex < captionItems.length ? currentIndex + 1 : currentIndex;
        setCurrentIndex(nextIndex);
        if (captionItems.length - nextIndex <= 2) {
            void fetchMoreCaptionsRef.current?.();
        }
    };

    const goToPreviousCaption = () => {
        setVoteError(null);
        setCurrentIndex((prev) => (prev > 0 ? prev - 1 : 0));
    };

    const voteOnCaption = async (captionId: string, voteValue: 1 | -1) => {
        setVoteError(null);
        setVoteSaving(true);

        try {
            const {
                data: { user },
                error: userError,
            } = await supabase.auth.getUser();
            if (userError) {
                throw userError;
            }
            if (!user) {
                throw new Error('Not signed in');
            }

            setUserId(user.id);

            const { data: existing, error: selectError } = await supabase
                .from('caption_votes')
                .select('id, vote_value')
                .eq('profile_id', user.id)
                .eq('caption_id', captionId)
                .maybeSingle();

            if (selectError) {
                throw selectError;
            }

            const nowISO = new Date().toISOString();

            if (existing?.id) {
                const { error: updateError } = await supabase
                    .from('caption_votes')
                    .update({
                        vote_value: voteValue,
                        modified_datetime_utc: nowISO,
                    })
                    .eq('id', existing.id);

                if (updateError) {
                    throw updateError;
                }
            } else {
                const { error: insertError } = await supabase
                    .from('caption_votes')
                    .insert({
                        profile_id: user.id,
                        caption_id: captionId,
                        vote_value: voteValue,
                        created_datetime_utc: nowISO,
                        modified_datetime_utc: nowISO,
                    });

                if (insertError) {
                    throw insertError;
                }
            }

            setVotesByCaption((prev) => ({
                ...prev,
                [captionId]: voteValue,
            }));

            goToNextCaption();
        } catch (err) {
            const message =
                err instanceof Error ? err.message : 'Failed to save vote.';
            if (message === 'Not signed in') {
                setUserId(null);
                setAuthChecked(true);
                setVoteError('Sign in to vote.');
            } else {
                setVoteError(message);
            }
        } finally {
            setVoteSaving(false);
        }
    };

    return (
        <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white px-4 py-10 text-slate-900 sm:px-8">
            <div className="fixed right-4 top-4">
                <details className="group relative">
                    <summary
                        className="inline-flex h-10 w-10 list-none items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                        aria-label="Account"
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
                            <path d="M20 21a8 8 0 0 0-16 0" />
                            <circle cx="12" cy="8" r="4" />
                        </svg>
                    </summary>
                    <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
                        <p className="text-xs uppercase tracking-wide text-slate-500">
                            Signed in as
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                            {userEmail || 'Unknown user'}
                        </p>
                        <button
                            type="button"
                            onClick={handleSignOut}
                            className="mt-4 w-full rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={signingOut}
                        >
                            Log out
                        </button>
                    </div>
                </details>
            </div>
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
                <header className="space-y-2">
                    <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
                        See what&apos;s cookin
                    </p>
                    <h1 className="font-[var(--font-playfair)] text-3xl font-semibold tracking-tight sm:text-4xl">
                        Newest Crackd Captions 👩‍🍳
                    </h1>
                </header>

                {loading && <p className="text-slate-600">Loading...</p>}
                {error && !loading && (
                    <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">
                        Error: {error}
                    </p>
                )}

                {!loading && !error && (
                    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
                        {currentItem?.imageUrl && (
                            <img
                                src={currentItem.imageUrl}
                                alt=""
                                className="h-auto w-full rounded-xl"
                            />
                        )}

                        {preloadImageUrl && (
                            <img
                                src={preloadImageUrl}
                                alt=""
                                aria-hidden="true"
                                className="hidden"
                            />
                        )}

                        {captionItems.length === 0 && (
                            <p className="text-slate-600">No captions available yet.</p>
                        )}

                        {!currentItem && captionItems.length > 0 && (
                            <>
                                <p className="rounded-xl bg-slate-50 px-4 py-3 text-lg text-slate-800">
                                    You&apos;re done.
                                </p>
                                <div className="flex flex-wrap gap-3 pt-1">
                                    <button
                                        type="button"
                                        onClick={goToPreviousCaption}
                                        className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                                        disabled={currentIndex === 0 || voteSaving}
                                    >
                                        Back
                                    </button>
                                </div>
                            </>
                        )}

                        {currentItem && (
                            <>
                                <p className="text-sm font-medium text-slate-500">
                                    Caption {currentIndex + 1} of {captionItems.length}
                                </p>
                                <p className="rounded-xl bg-slate-50 px-4 py-3 text-lg text-slate-800">
                                    {currentItem.caption.content ?? '(empty caption)'}
                                </p>

                                {!canVote && (
                                    <p className="text-sm text-slate-600">
                                        Sign in to vote.{' '}
                                        <a
                                            href="/login"
                                            className="font-semibold text-slate-800 underline"
                                        >
                                            Go to login
                                        </a>
                                    </p>
                                )}

                                <div className="flex flex-wrap gap-3 pt-1">
                                    <button
                                        type="button"
                                        onClick={goToPreviousCaption}
                                        className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                                        disabled={currentIndex === 0 || voteSaving}
                                    >
                                        Back
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => voteOnCaption(currentItem.caption.id, 1)}
                                        className={`rounded-full border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                                            selectedVote === 1
                                                ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                                                : 'border-slate-300 text-slate-700 hover:border-slate-400 hover:text-slate-900'
                                        }`}
                                        disabled={!canVote || voteSaving}
                                    >
                                        👍 Upvote
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => voteOnCaption(currentItem.caption.id, -1)}
                                        className={`rounded-full border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                                            selectedVote === -1
                                                ? 'border-rose-300 bg-rose-50 text-rose-700'
                                                : 'border-slate-300 text-slate-700 hover:border-slate-400 hover:text-slate-900'
                                        }`}
                                        disabled={!canVote || voteSaving}
                                    >
                                        👎 Downvote
                                    </button>
                                    <button
                                        type="button"
                                        onClick={goToNextCaption}
                                        className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                                        disabled={isLastCaption || voteSaving}
                                    >
                                        Next
                                    </button>
                                    <button
                                        type="button"
                                        onClick={goToNextCaption}
                                        className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                                        disabled={isLastCaption || voteSaving}
                                    >
                                        Skip
                                    </button>
                                </div>

                                {voteError && (
                                    <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                        {voteError}
                                    </p>
                                )}
                            </>
                        )}
                    </section>
                )}
            </div>
        </main>
    );
}
