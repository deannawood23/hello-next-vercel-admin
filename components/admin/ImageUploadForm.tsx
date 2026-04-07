'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

const SUPPORTED_IMAGE_TYPES = new Set([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic',
]);

function parseErrorMessage(data: unknown, fallback: string): string {
    if (!data || typeof data !== 'object') {
        return fallback;
    }

    const details = data as { message?: unknown; error?: unknown; detail?: unknown };
    const candidate = details.message ?? details.error ?? details.detail;

    return typeof candidate === 'string' && candidate.trim().length > 0
        ? candidate
        : fallback;
}

async function parseJsonResponse(response: Response): Promise<unknown> {
    return response.json().catch(() => ({}));
}

function parseMetadataIsCommonUse(value: string): boolean {
    if (!value.trim()) {
        return false;
    }

    const parsed = JSON.parse(value) as Record<string, unknown>;
    const candidate = parsed.isCommonUse ?? parsed.is_common_use;

    return candidate === true;
}

type ImageUploadFormProps = {
    title?: string;
    description?: string;
};

export function ImageUploadForm({
    title = 'Upload Images',
    description = 'Create an image row from a remote URL or by uploading a local file.',
}: ImageUploadFormProps) {
    const router = useRouter();
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [imageUrlInput, setImageUrlInput] = useState('');
    const [metadataText, setMetadataText] = useState('{}');
    const [submitting, setSubmitting] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [registeredImageUrl, setRegisteredImageUrl] = useState<string | null>(null);

    const fileLabel = useMemo(() => selectedFile?.name ?? 'No file selected', [selectedFile]);

    const onFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0] ?? null;
        setErrorMessage(null);
        setStatusMessage(null);
        setRegisteredImageUrl(null);

        if (!file) {
            setSelectedFile(null);
            return;
        }

        if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
            setSelectedFile(null);
            setErrorMessage(
                `Unsupported file type: ${file.type || 'unknown'}. Use JPEG, PNG, WEBP, GIF, or HEIC.`
            );
            return;
        }

        setSelectedFile(file);
        setImageUrlInput('');
    };

    const submitUpload = async () => {
        if (!selectedFile && !imageUrlInput.trim()) {
            setErrorMessage('Provide either an image URL or a local file.');
            return;
        }

        setSubmitting(true);
        setErrorMessage(null);
        setStatusMessage(null);
        setRegisteredImageUrl(null);

        try {
            const isCommonUse = parseMetadataIsCommonUse(metadataText);
            let imageUrl = imageUrlInput.trim();

            if (selectedFile) {
                setStatusMessage('Generating presigned upload URL...');
                const presignResponse = await fetch('/api/admin/pipeline/generate-presigned-url', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contentType: selectedFile.type }),
                });
                const presignData = (await parseJsonResponse(presignResponse)) as {
                    presignedUrl?: string;
                    cdnUrl?: string;
                };

                if (!presignResponse.ok || !presignData.presignedUrl || !presignData.cdnUrl) {
                    throw new Error(
                        parseErrorMessage(presignData, 'Failed to generate upload URL.')
                    );
                }

                setStatusMessage('Uploading image...');
                const uploadResponse = await fetch(presignData.presignedUrl, {
                    method: 'PUT',
                    headers: { 'Content-Type': selectedFile.type },
                    body: selectedFile,
                });

                if (!uploadResponse.ok) {
                    throw new Error(`Image upload failed with status ${uploadResponse.status}.`);
                }

                imageUrl = presignData.cdnUrl;
            }

            setStatusMessage('Registering image in pipeline...');
            const registerResponse = await fetch('/api/admin/pipeline/upload-image-from-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    imageUrl,
                    isCommonUse,
                }),
            });
            const registerData = (await parseJsonResponse(registerResponse)) as {
                imageId?: string;
                imageUrl?: string;
                cdnUrl?: string;
            };

            if (!registerResponse.ok || !registerData.imageId) {
                throw new Error(
                    parseErrorMessage(registerData, 'Failed to register image URL.')
                );
            }

            setRegisteredImageUrl(registerData.imageUrl ?? registerData.cdnUrl ?? imageUrl);
            setStatusMessage('Image uploaded.');
            router.refresh();
        } catch (error) {
            const message =
                error instanceof Error ? error.message : 'Unexpected upload failure.';
            setErrorMessage(message);
            setStatusMessage(null);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div>
                <h3 className="text-lg font-semibold text-[#EDEDEF]">{title}</h3>
                <p className="mt-1 text-sm text-[#A6ACB6]">{description}</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1">
                    <span className="text-xs uppercase tracking-[0.14em] text-[#8A8F98]">
                        Image URL
                    </span>
                    <input
                        type="url"
                        name="image_url"
                        value={imageUrlInput}
                        onChange={(event) => {
                            setImageUrlInput(event.target.value);
                            if (event.target.value.trim()) {
                                setSelectedFile(null);
                            }
                        }}
                        placeholder="https://..."
                        disabled={submitting}
                        className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-[#EDEDEF] outline-none placeholder:text-[#7E8590] focus:border-[#5E6AD2]/70 disabled:cursor-not-allowed disabled:opacity-60"
                    />
                </label>
                <label className="space-y-1">
                    <span className="text-xs uppercase tracking-[0.14em] text-[#8A8F98]">
                        Local file
                    </span>
                    <input
                        type="file"
                        name="image_file"
                        accept="image/*"
                        onChange={onFileSelect}
                        disabled={submitting}
                        className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-[#EDEDEF] outline-none file:mr-3 file:rounded-md file:border-0 file:bg-[#5E6AD2]/30 file:px-2 file:py-1 file:text-xs file:font-semibold file:text-white disabled:cursor-not-allowed disabled:opacity-60"
                    />
                    <p className="text-xs text-[#8A8F98]">{fileLabel}</p>
                </label>
            </div>
            <label className="space-y-1">
                <span className="text-xs uppercase tracking-[0.14em] text-[#8A8F98]">
                    Metadata JSON
                </span>
                <textarea
                    name="metadata_json"
                    rows={5}
                    value={metadataText}
                    onChange={(event) => setMetadataText(event.target.value)}
                    disabled={submitting}
                    className="w-full rounded-lg border border-white/10 bg-black/20 p-3 font-mono text-xs text-[#EDEDEF] outline-none placeholder:text-[#7E8590] focus:border-[#5E6AD2]/70 disabled:cursor-not-allowed disabled:opacity-60"
                />
                <p className="text-xs text-[#8A8F98]">
                    Use <code>{'{"isCommonUse": true}'}</code> or <code>{'{"is_common_use": true}'}</code> to mark the image as common use.
                </p>
            </label>

            <button
                type="button"
                onClick={submitUpload}
                disabled={submitting}
                className="rounded-lg border border-[#5E6AD2]/50 bg-[#5E6AD2]/25 px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#5E6AD2]/35 disabled:cursor-not-allowed disabled:opacity-60"
            >
                {submitting ? 'Uploading...' : 'Upload Image'}
            </button>

            {statusMessage && (
                <p className="rounded-xl border border-sky-400/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
                    {statusMessage}
                </p>
            )}

            {errorMessage && (
                <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                    {errorMessage}
                </p>
            )}

            {registeredImageUrl && (
                <p className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                    Registered image: {registeredImageUrl}
                </p>
            )}
        </div>
    );
}
