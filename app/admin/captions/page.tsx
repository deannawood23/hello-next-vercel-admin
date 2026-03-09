import { revalidatePath } from 'next/cache';
import { DataTable } from '../../../components/admin/DataTable';
import { requireSuperadmin } from '../../../src/lib/auth/requireSuperadmin';
import { asRecord, formatDate, pickDateValue, pickString, shortId } from '../_lib';

async function createCaption(formData: FormData) {
    'use server';

    const content = String(formData.get('content') ?? '').trim();
    const imageId = String(formData.get('image_id') ?? '').trim();

    if (!content) {
        return;
    }

    const { supabase } = await requireSuperadmin();
    const payload: Record<string, string> = { content };

    if (imageId) {
        payload.image_id = imageId;
    }

    await supabase.from('captions').insert(payload);

    revalidatePath('/admin/captions');
    revalidatePath('/admin');
}

async function deleteCaption(formData: FormData) {
    'use server';

    const captionId = String(formData.get('caption_id') ?? '');
    if (!captionId) {
        return;
    }

    const { supabase } = await requireSuperadmin();

    await supabase.from('captions').delete().eq('id', captionId);

    revalidatePath('/admin/captions');
    revalidatePath('/admin');
}

export default async function AdminCaptionsPage() {
    const { supabase } = await requireSuperadmin();

    const [primaryCaptions, votesResult] = await Promise.all([
        supabase
            .from('captions')
            .select('*')
            .order('created_datetime_utc', { ascending: false })
            .limit(200),
        supabase.from('caption_votes').select('caption_id, vote_value'),
    ]);
    const fallbackCaptions = primaryCaptions.error
        ? await supabase
              .from('captions')
              .select('*')
              .order('created_at', { ascending: false })
              .limit(200)
        : null;
    const captions = primaryCaptions.error
        ? fallbackCaptions?.data ?? []
        : primaryCaptions.data ?? [];
    const votes = votesResult.data ?? [];

    const voteCountByCaption = new Map<string, number>();
    for (const vote of votes) {
        const voteRow = asRecord(vote);
        const captionId = pickString(voteRow, ['caption_id'], '');
        if (!captionId) {
            continue;
        }

        const voteValueRaw = voteRow.vote_value;
        const voteValue = typeof voteValueRaw === 'number' ? voteValueRaw : 0;
        voteCountByCaption.set(captionId, (voteCountByCaption.get(captionId) ?? 0) + voteValue);
    }

    const rows = captions.map((raw) => {
        const row = asRecord(raw);
        const id = pickString(row, ['id']);
        const content = pickString(row, ['content', 'caption', 'text'], 'N/A');
        const imageId = pickString(row, ['image_id'], 'N/A');
        const createdAt = formatDate(
            pickDateValue(row, ['created_datetime_utc', 'created_at'])
        );
        const voteCount = voteCountByCaption.get(id) ?? 0;

        return [
            <span className="font-mono text-xs" key={`id-${id}`}>
                {shortId(id)}
            </span>,
            <span key={`content-${id}`} className="line-clamp-2 max-w-[380px]">
                {content}
            </span>,
            <span className="font-mono text-xs" key={`image-${id}`}>
                {shortId(imageId)}
            </span>,
            <span key={`created-${id}`}>{createdAt}</span>,
            <span key={`votes-${id}`}>{voteCount}</span>,
            <form action={deleteCaption} key={`action-${id}`}>
                <input type="hidden" name="caption_id" value={id} />
                <button
                    type="submit"
                    className="rounded-lg border border-rose-400/40 bg-rose-400/15 px-2.5 py-1 text-xs font-semibold text-rose-200 transition hover:bg-rose-400/25"
                >
                    Delete
                </button>
            </form>,
        ];
    });

    return (
        <div className="space-y-4">
            <div>
                <h2 className="font-[var(--font-playfair)] text-3xl font-semibold tracking-tight text-[#EDEDEF]">Captions</h2>
                <p className="mt-1 text-sm text-[#A6ACB6]">Manage generated captions and remove low-quality entries.</p>
            </div>
            <form
                action={createCaption}
                className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 md:grid-cols-[1fr_220px_auto]"
            >
                <label className="space-y-1">
                    <span className="text-xs uppercase tracking-[0.14em] text-[#8A8F98]">Caption</span>
                    <input
                        type="text"
                        name="content"
                        required
                        placeholder="Type caption text..."
                        className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-[#EDEDEF] outline-none ring-0 placeholder:text-[#7E8590] focus:border-[#5E6AD2]/70"
                    />
                </label>
                <label className="space-y-1">
                    <span className="text-xs uppercase tracking-[0.14em] text-[#8A8F98]">Image ID (optional)</span>
                    <input
                        type="text"
                        name="image_id"
                        placeholder="UUID"
                        className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-[#EDEDEF] outline-none ring-0 placeholder:text-[#7E8590] focus:border-[#5E6AD2]/70"
                    />
                </label>
                <div className="flex items-end">
                    <button
                        type="submit"
                        className="rounded-lg border border-[#5E6AD2]/50 bg-[#5E6AD2]/25 px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#5E6AD2]/35"
                    >
                        Add Caption
                    </button>
                </div>
            </form>
            <DataTable
                columns={['ID', 'Caption', 'Image ID', 'Created', 'Votes', 'Actions']}
                rows={rows}
                emptyMessage="No caption rows found."
            />
        </div>
    );
}
