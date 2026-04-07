import { NextResponse } from 'next/server';
import { getSadGirlMetrics } from '../../../../admin/data/humor-flavors/sad-girl/_lib';
import { requireSuperadmin } from '../../../../../src/lib/auth/requireSuperadmin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    await requireSuperadmin();
    const { searchParams } = new URL(request.url);
    const requestedPage = Number.parseInt(searchParams.get('page') ?? '1', 10);
    const requestedPageSize = Number.parseInt(searchParams.get('pageSize') ?? '12', 10);
    const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    const pageSize =
        Number.isFinite(requestedPageSize) && requestedPageSize > 0
            ? Math.min(requestedPageSize, 24)
            : 12;

    const data = await getSadGirlMetrics(undefined, page, pageSize);
    return NextResponse.json(data);
}
