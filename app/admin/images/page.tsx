import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { AdminImagesGrid } from '../../../components/admin/AdminImagesGrid';
import { ImageUploadForm } from '../../../components/admin/ImageUploadForm';
import { requireSuperadmin } from '../../../src/lib/auth/requireSuperadmin';
import { normalizeImageRecord, parseObjectJson } from './_lib';

async function updateImage(formData: FormData) {
    'use server';

    const imageId = String(formData.get('image_id') ?? '').trim();
    const payloadText = String(formData.get('payload') ?? '').trim();
    const payload = parseObjectJson(payloadText);

    if (!imageId || !payload) {
        return;
    }

    const { supabase } = await requireSuperadmin();
    await supabase.from('images').update(payload).eq('id', imageId);

    revalidatePath('/admin/images');
    revalidatePath('/admin');
}

async function deleteImage(formData: FormData) {
    'use server';

    const imageId = String(formData.get('image_id') ?? '');
    if (!imageId) {
        return;
    }

    const { supabase } = await requireSuperadmin();

    await supabase.from('images').delete().eq('id', imageId);

    revalidatePath('/admin/images');
    revalidatePath('/admin');
}

export default async function AdminImagesPage() {
    const { supabase } = await requireSuperadmin();

    const primary = await supabase
        .from('images')
        .select('*')
        .order('created_datetime_utc', { ascending: false })
        .limit(200);
    const fallback = primary.error
        ? await supabase
              .from('images')
              .select('*')
              .order('created_at', { ascending: false })
              .limit(200)
        : null;
    const data = primary.error ? fallback?.data ?? [] : primary.data ?? [];

    const profileIds = Array.from(
        new Set(
            data
                .map((row) => {
                    const value = row?.profile_id;
                    return typeof value === 'string' && value.trim().length > 0 ? value : null;
                })
                .filter((value): value is string => Boolean(value))
        )
    );
    const uploaderById = new Map<string, Record<string, unknown>>();

    if (profileIds.length > 0) {
        const { data: profiles } = await supabase
            .from('profiles')
            .select('id, email, username, name, display_name')
            .in('id', profileIds);

        for (const profile of profiles ?? []) {
            if (profile?.id && typeof profile.id === 'string') {
                uploaderById.set(profile.id, profile as Record<string, unknown>);
            }
        }
    }

    const images = data
        .map((raw) => {
            const profileId =
                raw?.profile_id && typeof raw.profile_id === 'string' ? raw.profile_id : null;
            return normalizeImageRecord(raw, profileId ? uploaderById.get(profileId) : null);
        })
        .filter((image) => image.id);

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h2 className="font-[var(--font-playfair)] text-3xl font-semibold tracking-tight text-[#EDEDEF]">Images</h2>
                    <p className="mt-1 text-sm text-[#A6ACB6]">Browse images visually, open a detail page by image ID, and manage descriptions.</p>
                </div>
                <Link
                    href="/admin/images/upload"
                    className="rounded-lg border border-[#5E6AD2]/50 bg-[#5E6AD2]/25 px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#5E6AD2]/35"
                >
                    Upload Images
                </Link>
            </div>
            <AdminImagesGrid images={images} />
            <ImageUploadForm
                title="Quick Upload"
                description="Add a new image here, or use the dedicated Upload Images page from the sidebar."
            />
            <details className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <summary className="cursor-pointer text-sm font-semibold text-[#EDEDEF]">
                    Advanced raw JSON editor and delete
                </summary>
                <div className="mt-4 grid gap-4">
                    {images.map((image) => (
                        <div
                            key={image.id}
                            className="rounded-xl border border-white/10 bg-black/20 p-4"
                        >
                            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                                <span className="font-mono text-xs text-[#EDEDEF]">{image.id}</span>
                                <form action={deleteImage}>
                                    <input type="hidden" name="image_id" value={image.id} />
                                    <button
                                        type="submit"
                                        className="rounded-lg border border-rose-400/40 bg-rose-400/15 px-2.5 py-1 text-xs font-semibold text-rose-200 transition hover:bg-rose-400/25"
                                    >
                                        Delete
                                    </button>
                                </form>
                            </div>
                            <form action={updateImage} className="space-y-2">
                                <input type="hidden" name="image_id" value={image.id} />
                                <textarea
                                    name="payload"
                                    defaultValue={JSON.stringify(image.raw, null, 2)}
                                    rows={8}
                                    className="w-full rounded-lg border border-white/10 bg-black/20 p-3 font-mono text-xs text-[#EDEDEF] outline-none placeholder:text-[#7E8590] focus:border-[#5E6AD2]/70"
                                />
                                <button
                                    type="submit"
                                    className="rounded-lg border border-[#5E6AD2]/50 bg-[#5E6AD2]/25 px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#5E6AD2]/35"
                                >
                                    Save Raw JSON
                                </button>
                            </form>
                        </div>
                    ))}
                </div>
            </details>
        </div>
    );
}
