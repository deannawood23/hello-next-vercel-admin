/* eslint-disable @next/next/no-img-element */
'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { ImageRecord } from '../../app/admin/images/_lib';
import { formatImageTimestamp } from '../../app/admin/images/_lib';

type AdminImagesGridProps = {
    images: ImageRecord[];
};

type FilterMode = 'all' | 'common' | 'uploaded';
type SortMode = 'recent' | 'oldest';

export function AdminImagesGrid({ images }: AdminImagesGridProps) {
    const [query, setQuery] = useState('');
    const [filterMode, setFilterMode] = useState<FilterMode>('all');
    const [sortMode, setSortMode] = useState<SortMode>('recent');

    const normalizedQuery = query.trim().toLowerCase();
    const filteredImages = [...images]
        .filter((image) => {
            if (filterMode === 'common') {
                return image.isCommonUse;
            }

            if (filterMode === 'uploaded') {
                return !image.isCommonUse;
            }

            return true;
        })
        .filter((image) => {
            if (!normalizedQuery) {
                return true;
            }

            return image.id.toLowerCase().includes(normalizedQuery);
        })
        .sort((a, b) => {
            const left = Date.parse(a.createdAt ?? '') || 0;
            const right = Date.parse(b.createdAt ?? '') || 0;
            return sortMode === 'recent' ? right - left : left - right;
        });

    return (
        <div className="space-y-4">
            <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
                <label className="space-y-1">
                    <span className="text-xs uppercase tracking-[0.14em] text-[#8A8F98]">
                        Search by image ID
                    </span>
                    <input
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="de57bc47-8b61-4ac1-801b-61b9ee5b7ce2"
                        className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-[#EDEDEF] outline-none placeholder:text-[#7E8590] focus:border-[#5E6AD2]/70"
                    />
                </label>
                <div className="space-y-1">
                    <span className="text-xs uppercase tracking-[0.14em] text-[#8A8F98]">
                        Category
                    </span>
                    <div className="flex flex-wrap gap-2">
                        {[
                            ['all', 'All Images'],
                            ['common', 'Common Use'],
                            ['uploaded', 'User Uploaded'],
                        ].map(([value, label]) => {
                            const active = filterMode === value;
                            return (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => setFilterMode(value as FilterMode)}
                                    className={`rounded-full border px-3 py-2 text-sm font-medium transition ${
                                        active
                                            ? 'border-[#5E6AD2]/70 bg-[#5E6AD2]/25 text-white'
                                            : 'border-white/10 bg-black/20 text-[#B6BCC6] hover:border-white/20 hover:text-white'
                                    }`}
                                >
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                </div>
                <label className="space-y-1">
                    <span className="text-xs uppercase tracking-[0.14em] text-[#8A8F98]">Sort</span>
                    <select
                        value={sortMode}
                        onChange={(event) => setSortMode(event.target.value as SortMode)}
                        className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-[#EDEDEF] outline-none focus:border-[#5E6AD2]/70"
                    >
                        <option value="recent">Most recent</option>
                        <option value="oldest">Oldest</option>
                    </select>
                </label>
            </div>

            <div className="flex items-center justify-between text-sm text-[#A6ACB6]">
                <span>
                    Showing {filteredImages.length} of {images.length} images
                </span>
            </div>

            {filteredImages.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 px-5 py-12 text-center text-sm text-[#8A8F98]">
                    No images match the current search and filters.
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                    {filteredImages.map((image) => (
                        <Link
                            key={image.id}
                            href={`/admin/images/${image.id}`}
                            className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] transition hover:border-[#5E6AD2]/45 hover:bg-white/[0.05]"
                        >
                            <div className="aspect-square bg-black/25">
                                {image.url ? (
                                    <img
                                        src={image.url}
                                        alt={image.description || `Image ${image.id}`}
                                        className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                                    />
                                ) : (
                                    <div className="flex h-full items-center justify-center text-sm text-[#7E8590]">
                                        No preview
                                    </div>
                                )}
                            </div>
                            <div className="space-y-3 p-4">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="truncate font-mono text-xs text-[#EDEDEF]">
                                        {image.id}
                                    </span>
                                    <span
                                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                            image.isCommonUse
                                                ? 'bg-emerald-400/20 text-emerald-200'
                                                : 'bg-sky-400/20 text-sky-200'
                                        }`}
                                    >
                                        {image.isCommonUse ? 'Common use' : 'User uploaded'}
                                    </span>
                                </div>
                                <p className="line-clamp-2 text-sm text-[#B6BCC6]">
                                    {image.description || 'No description yet.'}
                                </p>
                                <div className="space-y-1 text-xs text-[#8A8F98]">
                                    <p>{formatImageTimestamp(image.createdAt)}</p>
                                    <p className="truncate">
                                        {image.uploaderName} | {image.uploaderEmail}
                                    </p>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
