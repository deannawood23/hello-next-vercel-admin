'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createSupabaseBrowserClient } from '../../src/lib/supabase/client';
import { DivergingBarChart } from './DivergingBarChart';
import { SimpleBarChart } from './SimpleBarChart';
import { StatCard } from './StatCard';

type SimpleChartPoint = {
    label: string;
    value: number;
};

type DivergingChartPoint = {
    label: string;
    value: number;
    upvotes: number;
    downvotes: number;
};

type SadGirlMetrics = {
    flavorIds: number[];
    users: number;
    totalCaptions: number;
    images: number;
    votes: number;
    activity: SimpleChartPoint[];
    voteActivity: DivergingChartPoint[];
    updatedAt: string;
    topCaptions: {
        id: string;
        content: string;
        imageId: string;
        imageUrl: string;
        captionRequestId: string;
        upvotes: number;
        createdAt: string;
    }[];
    topCaptionsPage: number;
    topCaptionsPageSize: number;
    topCaptionsTotalPages: number;
    topCaptionsTotalCount: number;
};

type SadGirlDashboardClientProps = {
    initialData: SadGirlMetrics;
};

async function fetchMetrics(page: number, pageSize: number) {
    const response = await fetch(`/api/admin/humor-flavors/sad-girl?page=${page}&pageSize=${pageSize}`, {
        method: 'GET',
        cache: 'no-store',
    });

    if (!response.ok) {
        throw new Error('Failed to fetch sad-girl metrics.');
    }

    return (await response.json()) as SadGirlMetrics;
}

export function SadGirlDashboardClient({ initialData }: SadGirlDashboardClientProps) {
    const [data, setData] = useState(initialData);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [currentPage, setCurrentPage] = useState(initialData.topCaptionsPage);

    useEffect(() => {
        let active = true;
        const supabase = createSupabaseBrowserClient();

        const refresh = async () => {
            try {
                setIsRefreshing(true);
                const next = await fetchMetrics(currentPage, data.topCaptionsPageSize);
                if (active) {
                    setData(next);
                    setCurrentPage(next.topCaptionsPage);
                }
            } finally {
                if (active) {
                    setIsRefreshing(false);
                }
            }
        };

        void refresh();

        const intervalId = window.setInterval(refresh, 15000);
        const channel = supabase
            .channel('sad-girl-admin-live')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'captions' },
                () => {
                    void refresh();
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'caption_votes' },
                () => {
                    void refresh();
                }
            )
            .subscribe();

        return () => {
            active = false;
            window.clearInterval(intervalId);
            void supabase.removeChannel(channel);
        };
    }, [currentPage, data.topCaptionsPageSize]);

    return (
        <div className="space-y-6">
            <div>
                <h2 className="font-[var(--font-playfair)] text-3xl font-semibold tracking-tight text-[#EDEDEF]">
                    Sad-Girl Data
                </h2>
                <p className="mt-1 text-sm text-[#A6ACB6]">
                    Admin metrics and 7-day caption activity for the sad-girl humor flavor.
                </p>
                <p className="mt-1 text-xs text-[#8A8F98]">
                    {isRefreshing ? 'Refreshing live data...' : `Last updated: ${new Date(data.updatedAt).toLocaleString('en-US')}`}
                </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Users" value={data.users} />
                <StatCard label="Total Captions" value={data.totalCaptions} />
                <StatCard label="Images" value={data.images} />
                <StatCard label="Votes" value={data.votes} />
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
                <SimpleBarChart title="Last 7 Days Caption Activity" data={data.activity} />
                <DivergingBarChart title="Last 7 Days Vote Total" data={data.voteActivity} />
            </div>

            <section className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h3 className="text-lg font-semibold text-[#EDEDEF]">Top Captions By Upvotes</h3>
                        <p className="mt-1 text-sm text-[#A6ACB6]">
                            Showing {data.topCaptions.length} of {data.topCaptionsTotalCount} sad-girl captions, ranked by upvotes.
                        </p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs uppercase tracking-[0.14em] text-[#8A8F98]">
                        Page {data.topCaptionsPage} of {data.topCaptionsTotalPages}
                    </div>
                </div>

                {data.topCaptions.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 px-5 py-12 text-center text-sm text-[#8A8F98]">
                        No sad-girl captions found.
                    </div>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                        {data.topCaptions.map((caption) => (
                            <article
                                key={caption.id}
                                className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
                            >
                                <div className="aspect-square bg-black/25">
                                    {caption.imageUrl ? (
                                        <img
                                            src={caption.imageUrl}
                                            alt={caption.content}
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        <div className="flex h-full items-center justify-center text-sm text-[#7E8590]">
                                            No image
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-3 p-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-xs font-semibold text-emerald-200">
                                            {caption.upvotes} upvotes
                                        </span>
                                        <span className="font-mono text-[11px] text-[#8A8F98]">
                                            {caption.id.slice(0, 8)}...
                                        </span>
                                    </div>
                                    <p className="line-clamp-4 text-sm text-[#D4D8DF]">{caption.content}</p>
                                    <div className="space-y-1 text-xs text-[#8A8F98]">
                                        <p>{caption.createdAt ? new Date(caption.createdAt).toLocaleString('en-US') : 'Unknown date'}</p>
                                        <p className="truncate">Image: {caption.imageId || 'Unknown'}</p>
                                    </div>
                                    {caption.captionRequestId ? (
                                        <Link
                                            href={`/admin/data/caption-requests/${encodeURIComponent(caption.captionRequestId)}`}
                                            className="inline-flex rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs font-semibold text-[#D4D8DF] transition hover:border-white/20 hover:bg-white/[0.08]"
                                        >
                                            View caption request
                                        </Link>
                                    ) : (
                                        <span className="inline-flex rounded-lg border border-white/10 bg-black/10 px-3 py-2 text-xs font-semibold text-[#6F7682]">
                                            No caption request
                                        </span>
                                    )}
                                </div>
                            </article>
                        ))}
                    </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-[#A6ACB6]">
                    <button
                        type="button"
                        onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                        disabled={data.topCaptionsPage <= 1}
                        className={`rounded-lg border px-3 py-2 font-semibold transition ${
                            data.topCaptionsPage <= 1
                                ? 'cursor-not-allowed border-white/10 bg-black/10 text-[#6F7682]'
                                : 'border-white/10 bg-black/20 text-[#D4D8DF] hover:bg-white/[0.08]'
                        }`}
                    >
                        Previous
                    </button>
                    <span>
                        Page {data.topCaptionsPage} of {data.topCaptionsTotalPages}
                    </span>
                    <button
                        type="button"
                        onClick={() =>
                            setCurrentPage((page) => Math.min(data.topCaptionsTotalPages, page + 1))
                        }
                        disabled={data.topCaptionsPage >= data.topCaptionsTotalPages}
                        className={`rounded-lg border px-3 py-2 font-semibold transition ${
                            data.topCaptionsPage >= data.topCaptionsTotalPages
                                ? 'cursor-not-allowed border-white/10 bg-black/10 text-[#6F7682]'
                                : 'border-white/10 bg-black/20 text-[#D4D8DF] hover:bg-white/[0.08]'
                        }`}
                    >
                        Next
                    </button>
                </div>
            </section>
        </div>
    );
}
