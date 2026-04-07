import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { asRecord, pickDateValue, pickString } from '../../../_lib';

type CaptionRow = Record<string, unknown>;
type VoteRow = Record<string, unknown>;

export type SimpleChartPoint = {
    label: string;
    value: number;
};

export type DivergingChartPoint = {
    label: string;
    value: number;
    upvotes: number;
    downvotes: number;
};

export type SadGirlMetrics = {
    flavorIds: number[];
    users: number;
    totalCaptions: number;
    images: number;
    votes: number;
    activity: SimpleChartPoint[];
    voteActivity: DivergingChartPoint[];
    updatedAt: string;
};

export type SadGirlTopCaption = {
    id: string;
    content: string;
    imageId: string;
    imageUrl: string;
    upvotes: number;
    createdAt: string;
};

export type SadGirlDashboardData = SadGirlMetrics & {
    topCaptions: SadGirlTopCaption[];
    topCaptionsPage: number;
    topCaptionsPageSize: number;
    topCaptionsTotalPages: number;
    topCaptionsTotalCount: number;
};

export function createPublicSupabaseClient() {
    const projectId = process.env.NEXT_PUBLIC_SUPABASE_PROJECT_ID;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!projectId || !anonKey) {
        throw new Error('Missing Supabase public environment variables.');
    }

    return createClient(`https://${projectId}.supabase.co`, anonKey);
}

function getEasternDayKey(date: Date) {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(date);
}

function getLast7EasternDayKeys() {
    const keys: string[] = [];
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        weekday: 'short',
    });
    const now = new Date();

    for (let i = 6; i >= 0; i -= 1) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const key = getEasternDayKey(d);
        keys.push(key);
    }

    return keys.map((key) => ({
        key,
        label: formatter.format(new Date(`${key}T12:00:00Z`)),
    }));
}

function buildLast7DaysCounts(rows: CaptionRow[]) {
    const map = new Map<string, number>();

    for (const day of getLast7EasternDayKeys()) {
        map.set(day.key, 0);
    }

    for (const row of rows) {
        const date = pickDateValue(row, ['created_datetime_utc']);
        if (!date) {
            continue;
        }

        const key = getEasternDayKey(date);
        if (map.has(key)) {
            map.set(key, (map.get(key) ?? 0) + 1);
        }
    }

    return getLast7EasternDayKeys().map((day) => ({
        label: day.label,
        value: map.get(day.key) ?? 0,
    }));
}

function buildLast7DaysVoteTotals(rows: VoteRow[]) {
    const map = new Map<string, { value: number; upvotes: number; downvotes: number }>();

    for (const day of getLast7EasternDayKeys()) {
        map.set(day.key, { value: 0, upvotes: 0, downvotes: 0 });
    }

    for (const row of rows) {
        const date = pickDateValue(row, ['created_datetime_utc']);
        if (!date) {
            continue;
        }

        const key = getEasternDayKey(date);
        const bucket = map.get(key);
        if (!bucket) {
            continue;
        }

        const voteValue = typeof row.vote_value === 'number' ? row.vote_value : 0;
        bucket.value += voteValue;
        if (voteValue > 0) {
            bucket.upvotes += voteValue;
        } else if (voteValue < 0) {
            bucket.downvotes += Math.abs(voteValue);
        }
    }

    return getLast7EasternDayKeys().map((day) => {
        const totals = map.get(day.key) ?? { value: 0, upvotes: 0, downvotes: 0 };
        return {
            label: day.label,
            value: totals.value,
            upvotes: totals.upvotes,
            downvotes: totals.downvotes,
        };
    });
}

async function findSadGirlFlavorIds(supabase: SupabaseClient) {
    const result = await supabase
        .from('humor_flavors')
        .select('id, slug, description')
        .or('slug.ilike.sad-girl%,description.ilike.%sad girl%,description.ilike.%sad-girl%')
        .order('id', { ascending: true });

    return (result.data ?? [])
        .map((row) => asRecord(row))
        .filter((row) => {
            const slug = pickString(row, ['slug'], '').toLowerCase();
            const description = pickString(row, ['description'], '').toLowerCase();
            return (
                slug === 'sad-girl' ||
                slug.startsWith('sad-girl') ||
                slug === 'sadgirl' ||
                description.includes('sad girl') ||
                description.includes('sad-girl')
            );
        })
        .map((row) => Number(row.id))
        .filter((value) => Number.isFinite(value));
}

async function fetchAllCaptions(supabase: SupabaseClient, flavorIds: number[]) {
    const rows: CaptionRow[] = [];
    const pageSize = 1000;

    for (let from = 0; ; from += pageSize) {
        const to = from + pageSize - 1;
        const result = await supabase
            .from('captions')
            .select('id, content, created_datetime_utc, image_id, profile_id, humor_flavor_id')
            .in('humor_flavor_id', flavorIds)
            .order('created_datetime_utc', { ascending: false })
            .range(from, to);

        const batch = (result.data ?? []).map((row) => asRecord(row));
        rows.push(...batch);

        if (batch.length < pageSize) {
            break;
        }
    }

    return rows;
}

async function fetchImagesByIds(supabase: SupabaseClient, imageIds: string[]) {
    const rows: Record<string, unknown>[] = [];
    const chunkSize = 200;

    for (let index = 0; index < imageIds.length; index += chunkSize) {
        const ids = imageIds.slice(index, index + chunkSize);
        const result = await supabase.from('images').select('id, url').in('id', ids);
        rows.push(...((result.data ?? []).map((row) => asRecord(row))));
    }

    return rows;
}

async function fetchVotesForCaptionIds(supabase: SupabaseClient, captionIds: string[]) {
    const rows: VoteRow[] = [];
    const chunkSize = 200;

    for (let index = 0; index < captionIds.length; index += chunkSize) {
        const ids = captionIds.slice(index, index + chunkSize);
        const result = await supabase
            .from('caption_votes')
            .select('caption_id, vote_value, created_datetime_utc')
            .in('caption_id', ids);

        rows.push(...((result.data ?? []).map((row) => asRecord(row))));
    }

    return rows;
}

export async function getSadGirlMetrics(
    supabase: SupabaseClient = createPublicSupabaseClient(),
    topCaptionsPage = 1,
    topCaptionsPageSize = 12
): Promise<SadGirlDashboardData> {
    const flavorIds = await findSadGirlFlavorIds(supabase);
    if (flavorIds.length === 0) {
        return {
            flavorIds: [],
            users: 0,
            totalCaptions: 0,
            images: 0,
            votes: 0,
            activity: buildLast7DaysCounts([]),
            voteActivity: buildLast7DaysVoteTotals([]),
            topCaptions: [],
            topCaptionsPage: 1,
            topCaptionsPageSize,
            topCaptionsTotalPages: 1,
            topCaptionsTotalCount: 0,
            updatedAt: new Date().toISOString(),
        };
    }

    const captions = await fetchAllCaptions(supabase, flavorIds);
    const captionIds = captions
        .map((row) => pickString(row, ['id'], ''))
        .filter((value): value is string => value.length > 0);
    const votes = captionIds.length > 0 ? await fetchVotesForCaptionIds(supabase, captionIds) : [];
    const upvoteCountByCaptionId = new Map<string, number>();
    const voteScoreByCaptionId = new Map<string, number>();

    for (const vote of votes) {
        const captionId = pickString(vote, ['caption_id'], '');
        if (!captionId) {
            continue;
        }

        const voteValue = typeof vote.vote_value === 'number' ? vote.vote_value : 0;
        voteScoreByCaptionId.set(captionId, (voteScoreByCaptionId.get(captionId) ?? 0) + voteValue);
        if (voteValue > 0) {
            upvoteCountByCaptionId.set(
                captionId,
                (upvoteCountByCaptionId.get(captionId) ?? 0) + voteValue
            );
        }
    }

    const sortedCaptions = [...captions].sort((left, right) => {
        const leftId = pickString(left, ['id'], '');
        const rightId = pickString(right, ['id'], '');
        const upvoteDelta =
            (upvoteCountByCaptionId.get(rightId) ?? 0) - (upvoteCountByCaptionId.get(leftId) ?? 0);

        if (upvoteDelta !== 0) {
            return upvoteDelta;
        }

        const voteScoreDelta =
            (voteScoreByCaptionId.get(rightId) ?? 0) - (voteScoreByCaptionId.get(leftId) ?? 0);
        if (voteScoreDelta !== 0) {
            return voteScoreDelta;
        }

        const leftCreatedAt = pickDateValue(left, ['created_datetime_utc'])?.getTime() ?? 0;
        const rightCreatedAt = pickDateValue(right, ['created_datetime_utc'])?.getTime() ?? 0;
        return rightCreatedAt - leftCreatedAt;
    });

    const totalTopCaptions = sortedCaptions.length;
    const safePageSize = Math.max(1, topCaptionsPageSize);
    const totalTopCaptionPages = Math.max(1, Math.ceil(totalTopCaptions / safePageSize));
    const safePage = Math.min(Math.max(1, topCaptionsPage), totalTopCaptionPages);
    const pageStart = (safePage - 1) * safePageSize;
    const pageCaptions = sortedCaptions.slice(pageStart, pageStart + safePageSize);
    const imageIds = Array.from(
        new Set(
            pageCaptions
                .map((row) => pickString(row, ['image_id'], ''))
                .filter((value) => value.length > 0)
        )
    );
    const imageRows = imageIds.length > 0 ? await fetchImagesByIds(supabase, imageIds) : [];
    const imageUrlById = new Map<string, string>();
    for (const image of imageRows) {
        const imageId = pickString(image, ['id'], '');
        const imageUrl = pickString(image, ['url'], '');
        if (imageId && imageUrl) {
            imageUrlById.set(imageId, imageUrl);
        }
    }

    const topCaptions: SadGirlTopCaption[] = pageCaptions.map((row) => {
        const id = pickString(row, ['id'], '');
        const imageId = pickString(row, ['image_id'], '');
        return {
            id,
            content: pickString(row, ['content', 'caption', 'text'], 'N/A'),
            imageId,
            imageUrl: imageUrlById.get(imageId) ?? '',
            upvotes: upvoteCountByCaptionId.get(id) ?? 0,
            createdAt: pickDateValue(row, ['created_datetime_utc'])?.toISOString() ?? '',
        };
    });

    return {
        flavorIds,
        users: new Set(captions.map((row) => pickString(row, ['profile_id'], '')).filter(Boolean)).size,
        totalCaptions: captions.length,
        images: new Set(captions.map((row) => pickString(row, ['image_id'], '')).filter(Boolean)).size,
        votes: votes.length,
        activity: buildLast7DaysCounts(captions),
        voteActivity: buildLast7DaysVoteTotals(votes),
        topCaptions,
        topCaptionsPage: safePage,
        topCaptionsPageSize: safePageSize,
        topCaptionsTotalPages: totalTopCaptionPages,
        topCaptionsTotalCount: totalTopCaptions,
        updatedAt: new Date().toISOString(),
    };
}
