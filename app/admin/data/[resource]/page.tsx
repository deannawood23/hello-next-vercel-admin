/* eslint-disable @next/next/no-img-element */
import type { ReactNode } from 'react';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { notFound } from 'next/navigation';
import { DataTable } from '../../../../components/admin/DataTable';
import { requireSuperadmin } from '../../../../src/lib/auth/requireSuperadmin';
import { asRecord, formatDate, pickDateValue, pickString, shortId } from '../../_lib';

type ResourceMode = 'read' | 'crud' | 'read_update';

type ResourceConfig = {
    table: string;
    title: string;
    description: string;
    mode: ResourceMode;
};

const RESOURCE_CONFIG: Record<string, ResourceConfig> = {
    'humor-flavors': {
        table: 'humor_flavors',
        title: 'Humor Flavors',
        description: 'Read humor flavor records.',
        mode: 'read',
    },
    'humor-flavor-steps': {
        table: 'humor_flavor_steps',
        title: 'Humor Flavor Steps',
        description: 'Read humor flavor step records.',
        mode: 'read',
    },
    'humor-mix': {
        table: 'humor_mix',
        title: 'Humor Mix',
        description: 'Read and update humor mix records.',
        mode: 'read_update',
    },
    terms: {
        table: 'terms',
        title: 'Terms',
        description: 'Create, read, update, and delete terms.',
        mode: 'crud',
    },
    'caption-requests': {
        table: 'caption_requests',
        title: 'Caption Requests',
        description: 'Read caption request records.',
        mode: 'read',
    },
    'caption-examples': {
        table: 'caption_examples',
        title: 'Caption Examples',
        description: 'Create, read, update, and delete caption examples.',
        mode: 'crud',
    },
    'llm-models': {
        table: 'llm_models',
        title: 'LLM Models',
        description: 'Create, read, update, and delete model records.',
        mode: 'crud',
    },
    'llm-providers': {
        table: 'llm_providers',
        title: 'LLM Providers',
        description: 'Create, read, update, and delete provider records.',
        mode: 'crud',
    },
    'llm-prompt-chains': {
        table: 'llm_prompt_chains',
        title: 'LLM Prompt Chains',
        description: 'Read prompt chain records.',
        mode: 'read',
    },
    'llm-model-responses': {
        table: 'llm_model_responses',
        title: 'LLM Model Responses',
        description: 'Read exact prompts and model responses for audit trails.',
        mode: 'read',
    },
    'allowed-signup-domains': {
        table: 'allowed_signup_domains',
        title: 'Allowed Signup Domains',
        description: 'Create, read, update, and delete allowed signup domains.',
        mode: 'crud',
    },
    'whitelisted-email-addresses': {
        table: 'whitelisted_email_addresses',
        title: 'Whitelisted Email Addresses',
        description:
            'Create, read, update, and delete whitelisted e-mail addresses.',
        mode: 'crud',
    },
};

type RowMatch = {
    key: string;
    value: string;
};

function parseObjectJson(text: string): Record<string, unknown> | null {
    try {
        const parsed = JSON.parse(text);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return null;
        }
        return parsed as Record<string, unknown>;
    } catch {
        return null;
    }
}

function getMatchForRow(row: Record<string, unknown>): RowMatch | null {
    const preferredKeys = ['id', 'slug', 'name', 'key', 'email', 'domain'];
    for (const key of preferredKeys) {
        const value = row[key];
        if (
            typeof value === 'string' ||
            typeof value === 'number' ||
            typeof value === 'boolean'
        ) {
            return { key, value: String(value) };
        }
    }

    for (const [key, value] of Object.entries(row)) {
        if (
            typeof value === 'string' ||
            typeof value === 'number' ||
            typeof value === 'boolean'
        ) {
            return { key, value: String(value) };
        }
    }

    return null;
}

function parseScalar(raw: string): string | number | boolean {
    if (raw === 'true') {
        return true;
    }
    if (raw === 'false') {
        return false;
    }
    if (/^-?\d+(\.\d+)?$/.test(raw)) {
        return Number(raw);
    }
    return raw;
}

function formatValue(value: unknown): ReactNode {
    if (value === null || value === undefined) {
        return <span className="text-[#8A8F98]">null</span>;
    }
    if (typeof value === 'boolean') {
        return value ? 'true' : 'false';
    }
    if (typeof value === 'number') {
        return value;
    }
    if (typeof value === 'string') {
        if (value.length > 42) {
            return (
                <span title={value} className="font-mono text-xs">
                    {value.slice(0, 39)}...
                </span>
            );
        }
        return value;
    }
    return (
        <span className="font-mono text-xs text-[#B7C5FF]">
            {JSON.stringify(value)}
        </span>
    );
}

async function fetchTableRows(
    supabase: Awaited<ReturnType<typeof requireSuperadmin>>['supabase'],
    table: string
) {
    const orderKeys = ['created_datetime_utc', 'created_at', 'updated_at', 'id'];
    for (const key of orderKeys) {
        const result = await supabase
            .from(table)
            .select('*')
            .order(key, { ascending: false })
            .limit(200);
        if (!result.error) {
            return {
                rows: (result.data ?? []).map((row) => asRecord(row)),
                error: null as string | null,
            };
        }
    }

    const fallback = await supabase.from(table).select('*').limit(200);
    return {
        rows: (fallback.data ?? []).map((row) => asRecord(row)),
        error: fallback.error?.message ?? null,
    };
}

export default async function AdminResourcePage({
    params,
}: {
    params: Promise<{ resource: string }>;
}) {
    const { resource } = await params;
    const config = RESOURCE_CONFIG[resource];
    if (!config) {
        notFound();
    }

    async function createRow(formData: FormData) {
        'use server';

        if (config.mode !== 'crud') {
            return;
        }

        const payloadText = String(formData.get('payload') ?? '').trim();
        const payload = parseObjectJson(payloadText);
        if (!payload) {
            return;
        }

        const { supabase } = await requireSuperadmin();
        await supabase.from(config.table).insert(payload);

        revalidatePath(`/admin/data/${resource}`);
        revalidatePath('/admin');
    }

    async function updateRow(formData: FormData) {
        'use server';

        if (config.mode === 'read') {
            return;
        }

        const matchKey = String(formData.get('match_key') ?? '').trim();
        const matchValue = String(formData.get('match_value') ?? '').trim();
        const payloadText = String(formData.get('payload') ?? '').trim();
        const payload = parseObjectJson(payloadText);

        if (!matchKey || !matchValue || !payload) {
            return;
        }

        const { supabase } = await requireSuperadmin();
        await supabase
            .from(config.table)
            .update(payload)
            .eq(matchKey, parseScalar(matchValue));

        revalidatePath(`/admin/data/${resource}`);
        revalidatePath('/admin');
    }

    async function deleteRow(formData: FormData) {
        'use server';

        if (config.mode !== 'crud') {
            return;
        }

        const matchKey = String(formData.get('match_key') ?? '').trim();
        const matchValue = String(formData.get('match_value') ?? '').trim();
        if (!matchKey || !matchValue) {
            return;
        }

        const { supabase } = await requireSuperadmin();
        await supabase
            .from(config.table)
            .delete()
            .eq(matchKey, parseScalar(matchValue));

        revalidatePath(`/admin/data/${resource}`);
        revalidatePath('/admin');
    }

    const { supabase } = await requireSuperadmin();
    const { rows: data, error } = await fetchTableRows(supabase, config.table);

    if (resource === 'caption-requests') {
        const imageIds = Array.from(
            new Set(
                data
                    .map((row) => pickString(row, ['image_id'], ''))
                    .filter((value) => value && value !== 'N/A')
            )
        );
        const profileIds = Array.from(
            new Set(
                data
                    .map((row) => pickString(row, ['profile_id'], ''))
                    .filter((value) => value && value !== 'N/A')
            )
        );

        const [imagesResult, profilesResult] = await Promise.all([
            imageIds.length > 0
                ? supabase.from('images').select('*').in('id', imageIds)
                : Promise.resolve({ data: [], error: null }),
            profileIds.length > 0
                ? supabase.from('profiles').select('id, email').in('id', profileIds)
                : Promise.resolve({ data: [], error: null }),
        ]);

        const imageUrlById = new Map<string, string>();
        for (const image of imagesResult.data ?? []) {
            const row = asRecord(image);
            const id = pickString(row, ['id'], '');
            const url = pickString(row, ['url', 'storage_url', 'cdn_url'], '');
            if (id && url) {
                imageUrlById.set(id, url);
            }
        }

        const emailByProfileId = new Map<string, string>();
        for (const profile of profilesResult.data ?? []) {
            const row = asRecord(profile);
            const id = pickString(row, ['id'], '');
            const email = pickString(row, ['email'], '');
            if (id && email) {
                emailByProfileId.set(id, email);
            }
        }

        const requestRows = data.map((row) => {
            const rawId = row.id;
            const id =
                typeof rawId === 'number'
                    ? String(rawId)
                    : typeof rawId === 'string' && rawId.trim().length > 0
                    ? rawId
                    : 'N/A';
            const imageId = pickString(row, ['image_id'], '');
            const profileId = pickString(row, ['profile_id'], '');
            const imageUrl = imageUrlById.get(imageId) ?? '';
            const email = emailByProfileId.get(profileId) ?? 'Unknown';
            const createdAt = formatDate(
                pickDateValue(row, ['created_datetime_utc', 'created_at'])
            );

            return [
                <Link
                    href={`/admin/data/caption-requests/${id}`}
                    key={`id-${id}`}
                    className="block font-mono text-xs text-[#B7C5FF] underline-offset-2 hover:underline"
                >
                    {id}
                </Link>,
                <Link
                    href={`/admin/data/caption-requests/${id}`}
                    key={`image-${id}`}
                    className="block"
                >
                    {imageUrl ? (
                        <img
                            src={imageUrl}
                            alt={`Caption request ${id}`}
                            className="h-14 w-14 rounded-lg object-cover"
                        />
                    ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-white/10 bg-black/20 text-[11px] text-[#7E8590]">
                            No image
                        </div>
                    )}
                </Link>,
                <Link
                    href={`/admin/data/caption-requests/${id}`}
                    key={`email-${id}`}
                    className="block max-w-[260px] truncate text-[#D4D8DF]"
                >
                    {email}
                </Link>,
                <Link
                    href={`/admin/data/caption-requests/${id}`}
                    key={`created-${id}`}
                    className="block text-[#D4D8DF]"
                >
                    {createdAt}
                </Link>,
            ];
        });

        return (
            <div className="space-y-4">
                <div>
                    <h2 className="font-[var(--font-playfair)] text-3xl font-semibold tracking-tight text-[#EDEDEF]">
                        {config.title}
                    </h2>
                    <p className="mt-1 text-sm text-[#A6ACB6]">{config.description}</p>
                    {error ? (
                        <p className="mt-2 rounded-lg border border-amber-400/25 bg-amber-300/10 px-3 py-2 text-xs text-amber-200">
                            Query warning: {error}
                        </p>
                    ) : null}
                </div>

                <DataTable
                    columns={['ID', 'Image', 'Created By', 'Created']}
                    rows={requestRows}
                    emptyMessage={`No rows found in ${config.table}.`}
                />
            </div>
        );
    }

    if (resource === 'caption-examples') {
        const exampleRows = data.map((row) => {
            const rawId = row.id;
            const id =
                typeof rawId === 'number'
                    ? String(rawId)
                    : typeof rawId === 'string' && rawId.trim().length > 0
                    ? rawId
                    : 'N/A';
            const caption = pickString(row, ['caption', 'content', 'text'], 'N/A');
            const imageDescription = pickString(
                row,
                ['image_description', 'image_notes', 'description'],
                'N/A'
            );
            const explanation = pickString(
                row,
                ['explanation', 'reasoning', 'notes', 'additional_context'],
                'N/A'
            );
            const match = getMatchForRow(row);
            const rawJson = JSON.stringify(row, null, 2);

            return [
                <span className="font-mono text-xs text-[#B7C5FF]" key={`id-${id}`}>
                    {id}
                </span>,
                <span
                    key={`caption-${id}`}
                    className="block min-w-[260px] max-w-[440px] whitespace-pre-wrap text-[#D4D8DF]"
                >
                    {caption}
                </span>,
                <span
                    key={`image-description-${id}`}
                    className="block min-w-[260px] max-w-[440px] whitespace-pre-wrap text-[#D4D8DF]"
                >
                    {imageDescription}
                </span>,
                <span
                    key={`explanation-${id}`}
                    className="block min-w-[260px] max-w-[440px] whitespace-pre-wrap text-[#D4D8DF]"
                >
                    {explanation}
                </span>,
                match ? (
                    <div className="space-y-2" key={`actions-${id}`}>
                        <details>
                            <summary className="cursor-pointer text-xs text-[#B7C5FF]">
                                Edit
                            </summary>
                            <form action={updateRow} className="mt-2 space-y-2">
                                <input type="hidden" name="match_key" value={match.key} />
                                <input type="hidden" name="match_value" value={match.value} />
                                <textarea
                                    name="payload"
                                    defaultValue={rawJson}
                                    rows={8}
                                    className="w-full min-w-[320px] rounded-lg border border-white/10 bg-black/20 p-2 font-mono text-xs text-[#EDEDEF] outline-none placeholder:text-[#7E8590] focus:border-[#5E6AD2]/70"
                                />
                                <button
                                    type="submit"
                                    className="rounded-lg border border-[#5E6AD2]/50 bg-[#5E6AD2]/25 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-[#5E6AD2]/35"
                                >
                                    Update
                                </button>
                            </form>
                        </details>
                        <form action={deleteRow}>
                            <input type="hidden" name="match_key" value={match.key} />
                            <input type="hidden" name="match_value" value={match.value} />
                            <button
                                type="submit"
                                className="rounded-lg border border-rose-400/40 bg-rose-400/15 px-2.5 py-1 text-xs font-semibold text-rose-200 transition hover:bg-rose-400/25"
                            >
                                Delete
                            </button>
                        </form>
                    </div>
                ) : (
                    <span className="text-xs text-[#8A8F98]" key={`actions-${id}`}>
                        No stable key for updates.
                    </span>
                ),
            ];
        });

        return (
            <div className="space-y-4">
                <div>
                    <h2 className="font-[var(--font-playfair)] text-3xl font-semibold tracking-tight text-[#EDEDEF]">
                        {config.title}
                    </h2>
                    <p className="mt-1 text-sm text-[#A6ACB6]">
                        Curated examples used for prompts and quality checks
                    </p>
                    {error ? (
                        <p className="mt-2 rounded-lg border border-amber-400/25 bg-amber-300/10 px-3 py-2 text-xs text-amber-200">
                            Query warning: {error}
                        </p>
                    ) : null}
                </div>

                <DataTable
                    columns={['ID', 'Caption', 'Image Description', 'Explanation', 'Actions']}
                    rows={exampleRows}
                    emptyMessage={`No rows found in ${config.table}.`}
                />
            </div>
        );
    }

    const allKeys = Array.from(
        new Set(data.flatMap((row) => Object.keys(row)))
    ).filter((key) => key !== 'embedding');
    const displayKeys = allKeys.slice(0, 6);
    const columns = [...displayKeys, 'Raw'];
    if (config.mode !== 'read') {
        columns.push('Actions');
    }

    const rows = data.map((row) => {
        const match = getMatchForRow(row);
        const rowId =
            typeof row.id === 'string'
                ? row.id
                : typeof row.id === 'number'
                ? String(row.id)
                : '';
        const rawJson = JSON.stringify(row, null, 2);

        const cells: ReactNode[] = displayKeys.map((key) =>
            key === 'id' && rowId ? (
                <span className="font-mono text-xs" key={`${rowId}-${key}`}>
                    {shortId(rowId)}
                </span>
            ) : (
                <span key={`${rowId}-${key}`}>{formatValue(row[key])}</span>
            )
        );

        cells.push(
            <details key={`${rowId}-raw`}>
                <summary className="cursor-pointer text-xs text-[#B7C5FF]">
                    View JSON
                </summary>
                <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-black/20 p-2 font-mono text-[11px] text-[#C5CBD5]">
                    {rawJson}
                </pre>
            </details>
        );

        if (config.mode !== 'read') {
            cells.push(
                match ? (
                    <div className="space-y-2" key={`${rowId}-actions`}>
                        <form action={updateRow} className="space-y-2">
                            <input type="hidden" name="match_key" value={match.key} />
                            <input
                                type="hidden"
                                name="match_value"
                                value={match.value}
                            />
                            <textarea
                                name="payload"
                                defaultValue={rawJson}
                                rows={6}
                                className="w-full min-w-[280px] rounded-lg border border-white/10 bg-black/20 p-2 font-mono text-xs text-[#EDEDEF] outline-none placeholder:text-[#7E8590] focus:border-[#5E6AD2]/70"
                            />
                            <button
                                type="submit"
                                className="rounded-lg border border-[#5E6AD2]/50 bg-[#5E6AD2]/25 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-[#5E6AD2]/35"
                            >
                                Update
                            </button>
                        </form>
                        {config.mode === 'crud' ? (
                            <form action={deleteRow}>
                                <input
                                    type="hidden"
                                    name="match_key"
                                    value={match.key}
                                />
                                <input
                                    type="hidden"
                                    name="match_value"
                                    value={match.value}
                                />
                                <button
                                    type="submit"
                                    className="rounded-lg border border-rose-400/40 bg-rose-400/15 px-2.5 py-1 text-xs font-semibold text-rose-200 transition hover:bg-rose-400/25"
                                >
                                    Delete
                                </button>
                            </form>
                        ) : null}
                    </div>
                ) : (
                    <span className="text-xs text-[#8A8F98]" key={`${rowId}-no-actions`}>
                        No stable key for updates.
                    </span>
                )
            );
        }

        return cells;
    });

    return (
        <div className="space-y-4">
            <div>
                <h2 className="font-[var(--font-playfair)] text-3xl font-semibold tracking-tight text-[#EDEDEF]">
                    {config.title}
                </h2>
                <p className="mt-1 text-sm text-[#A6ACB6]">{config.description}</p>
                {error ? (
                    <p className="mt-2 rounded-lg border border-amber-400/25 bg-amber-300/10 px-3 py-2 text-xs text-amber-200">
                        Query warning: {error}
                    </p>
                ) : null}
            </div>

            {config.mode === 'crud' ? (
                <form
                    action={createRow}
                    className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-4"
                >
                    <p className="text-xs uppercase tracking-[0.14em] text-[#8A8F98]">
                        Create row (JSON object)
                    </p>
                    <textarea
                        name="payload"
                        rows={6}
                        defaultValue={'{}'}
                        className="w-full rounded-lg border border-white/10 bg-black/20 p-3 font-mono text-xs text-[#EDEDEF] outline-none placeholder:text-[#7E8590] focus:border-[#5E6AD2]/70"
                    />
                    <button
                        type="submit"
                        className="rounded-lg border border-[#5E6AD2]/50 bg-[#5E6AD2]/25 px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#5E6AD2]/35"
                    >
                        Create
                    </button>
                </form>
            ) : null}

            <DataTable
                columns={columns}
                rows={rows}
                emptyMessage={`No rows found in ${config.table}.`}
            />
        </div>
    );
}
