import { revalidatePath } from 'next/cache';
import { DataTable } from '../../../components/admin/DataTable';
import { ImageFlagButton } from '../../../components/admin/ImageFlagButton';
import { requireSuperadmin } from '../../../src/lib/auth/requireSuperadmin';
import { asRecord, formatDate, pickDateValue, pickString, shortId } from '../_lib';

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

    const rows = data.map((raw) => {
        const row = asRecord(raw);
        const id = pickString(row, ['id']);
        const url = pickString(row, ['url', 'cdn_url', 'cdnUrl', 'storage_url'], 'N/A');
        const createdAt = formatDate(
            pickDateValue(row, ['created_datetime_utc', 'created_at'])
        );
        const uploader = pickString(row, ['profile_id', 'user_id', 'uploader_id'], 'N/A');

        return [
            <span className="font-mono text-xs" key={`id-${id}`}>
                {shortId(id)}
            </span>,
            <a
                key={`url-${id}`}
                href={url === 'N/A' ? undefined : url}
                target="_blank"
                rel="noreferrer"
                className="max-w-[280px] truncate text-[#B7C5FF] underline-offset-2 hover:underline"
            >
                {url}
            </a>,
            <span key={`created-${id}`}>{createdAt}</span>,
            <span className="font-mono text-xs" key={`uploader-${id}`}>
                {shortId(uploader)}
            </span>,
            <div className="flex items-center gap-2" key={`actions-${id}`}>
                <form action={deleteImage}>
                    <input type="hidden" name="image_id" value={id} />
                    <button
                        type="submit"
                        className="rounded-lg border border-rose-400/40 bg-rose-400/15 px-2.5 py-1 text-xs font-semibold text-rose-200 transition hover:bg-rose-400/25"
                    >
                        Delete
                    </button>
                </form>
                <ImageFlagButton imageId={id} />
            </div>,
        ];
    });

    return (
        <div className="space-y-4">
            <div>
                <h2 className="font-[var(--font-playfair)] text-3xl font-semibold tracking-tight text-[#EDEDEF]">Images</h2>
                <p className="mt-1 text-sm text-[#A6ACB6]">Manage uploaded images and moderation flags.</p>
            </div>
            <DataTable
                columns={['ID', 'CDN / URL', 'Created', 'Uploader', 'Actions']}
                rows={rows}
                emptyMessage="No image rows found."
            />
        </div>
    );
}
