import { NextResponse } from 'next/server';
import { getSadGirlMetrics } from '../../../../admin/data/humor-flavors/sad-girl/_lib';
import { requireSuperadmin } from '../../../../../src/lib/auth/requireSuperadmin';

export const dynamic = 'force-dynamic';

export async function GET() {
    await requireSuperadmin();

    const data = await getSadGirlMetrics();
    return NextResponse.json(data);
}
