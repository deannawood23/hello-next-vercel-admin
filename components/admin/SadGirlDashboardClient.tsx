'use client';

import { useEffect, useState } from 'react';
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
};

type SadGirlDashboardClientProps = {
    initialData: SadGirlMetrics;
};

async function fetchMetrics() {
    const response = await fetch('/api/admin/humor-flavors/sad-girl', {
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

    useEffect(() => {
        let active = true;
        const supabase = createSupabaseBrowserClient();

        const refresh = async () => {
            try {
                setIsRefreshing(true);
                const next = await fetchMetrics();
                if (active) {
                    setData(next);
                }
            } finally {
                if (active) {
                    setIsRefreshing(false);
                }
            }
        };

        refresh();

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
    }, []);

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
        </div>
    );
}
