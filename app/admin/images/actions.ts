'use server';

import { revalidatePath } from 'next/cache';
import { requireSuperadmin } from '../../../src/lib/auth/requireSuperadmin';
import { parseObjectJson } from './_lib';

export async function createImage(formData: FormData) {
    const { supabase } = await requireSuperadmin();

    const uploadBucket = process.env.SUPABASE_IMAGE_UPLOAD_BUCKET ?? 'images';
    const explicitUrl = String(formData.get('image_url') ?? '').trim();
    const metadataText = String(formData.get('metadata_json') ?? '').trim();
    const metadata = metadataText ? parseObjectJson(metadataText) : null;

    let uploadedPath = '';
    let uploadedUrl = '';
    const file = formData.get('image_file');

    if (file instanceof File && file.size > 0) {
        const extensionFromName = file.name.includes('.') ? file.name.split('.').pop() : '';
        const extension = (extensionFromName || 'bin').toLowerCase();
        const objectPath = `admin/${Date.now()}-${crypto.randomUUID()}.${extension}`;

        const upload = await supabase.storage.from(uploadBucket).upload(objectPath, file, {
            contentType: file.type || undefined,
            upsert: false,
        });

        if (!upload.error) {
            uploadedPath = objectPath;
            uploadedUrl = supabase.storage.from(uploadBucket).getPublicUrl(objectPath).data.publicUrl;
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
    revalidatePath('/admin/images/upload');
    revalidatePath('/admin');
}
