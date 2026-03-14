import { revalidatePath } from 'next/cache';
import { AdminImagesGrid } from '../../../components/admin/AdminImagesGrid';
import { requireSuperadmin } from '../../../src/lib/auth/requireSuperadmin';
import { normalizeImageRecord, parseObjectJson } from './_lib';

async function createImage(formData: FormData) {
    'use server';

    const { supabase } = await requireSuperadmin();

    const uploadBucket = process.env.SUPABASE_IMAGE_UPLOAD_BUCKET ?? 'images';
    const explicitUrl = String(formData.get('image_url') ?? '').trim();
    const metadataText = String(formData.get('metadata_json') ?? '').trim();
    const metadata = metadataText ? parseObjectJson(metadataText) : null;

    let uploadedPath = '';
    let uploadedUrl = '';
    const file = formData.get('image_file');

    if (file instanceof File && file.size > 0) {
        const extensionFromName = file.name.includes('.')
            ? file.name.split('.').pop()
            : '';
        const extension = (extensionFromName || 'bin').toLowerCase();
        const objectPath = `admin/${Date.now()}-${crypto.randomUUID()}.${extension}`;

        const upload = await supabase.storage
            .from(uploadBucket)
            .upload(objectPath, file, {
                contentType: file.type || undefined,
                upsert: false,
            });

        if (!upload.error) {
            uploadedPath = objectPath;
            uploadedUrl = supabase.storage
                .from(uploadBucket)
                .getPublicUrl(objectPath).data.publicUrl;
        }
    }

    const resolvedUrl = explicitUrl || uploadedUrl;
    if (!resolvedUrl) {
        return;
    }

    const base: Record<string, unknown> = metadata ? { ...metadata } : {};
    if (uploadedPath) {
        base.storage_path = uploadedPath;
    }

    const payloadCandidates: Array<Record<string, unknown>> = [
        { ...base, url: resolvedUrl },
        { ...base, cdn_url: resolvedUrl },
        { ...base, storage_url: resolvedUrl },
    ];

    for (const payload of payloadCandidates) {
        const result = await supabase.from('images').insert(payload);
        if (!result.error) {
            break;
        }
    }

    revalidatePath('/admin/images');
    revalidatePath('/admin');
}

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
            <div>
                <h2 className="font-[var(--font-playfair)] text-3xl font-semibold tracking-tight text-[#EDEDEF]">Images</h2>
                <p className="mt-1 text-sm text-[#A6ACB6]">Browse images visually, open a detail page by image ID, and manage descriptions.</p>
            </div>
            <AdminImagesGrid images={images} />
            <form
                action={createImage}
                className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4"
            >
                <p className="text-xs uppercase tracking-[0.14em] text-[#8A8F98]">
                    Create image (upload file or paste URL)
                </p>
                <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-1">
                        <span className="text-xs text-[#A6ACB6]">Image URL (optional)</span>
                        <input
                            type="url"
                            name="image_url"
                            placeholder="https://..."
                            className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-[#EDEDEF] outline-none placeholder:text-[#7E8590] focus:border-[#5E6AD2]/70"
                        />
                    </label>
                    <label className="space-y-1">
                        <span className="text-xs text-[#A6ACB6]">Upload file (optional)</span>
                        <input
                            type="file"
                            name="image_file"
                            accept="image/*"
                            className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-[#EDEDEF] outline-none file:mr-3 file:rounded-md file:border-0 file:bg-[#5E6AD2]/30 file:px-2 file:py-1 file:text-xs file:font-semibold file:text-white"
                        />
                    </label>
                </div>
                <label className="space-y-1">
                    <span className="text-xs text-[#A6ACB6]">Metadata JSON (optional object)</span>
                    <textarea
                        name="metadata_json"
                        rows={4}
                        defaultValue={'{}'}
                        className="w-full rounded-lg border border-white/10 bg-black/20 p-3 font-mono text-xs text-[#EDEDEF] outline-none placeholder:text-[#7E8590] focus:border-[#5E6AD2]/70"
                    />
                </label>
                <button
                    type="submit"
                    className="rounded-lg border border-[#5E6AD2]/50 bg-[#5E6AD2]/25 px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#5E6AD2]/35"
                >
                    Create Image Row
                </button>
            </form>
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
