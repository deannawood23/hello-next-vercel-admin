import { SadGirlDashboardClient } from '../../../../../components/admin/SadGirlDashboardClient';
import { getSadGirlMetrics } from './_lib';
import { requireSuperadmin } from '../../../../../src/lib/auth/requireSuperadmin';

export const dynamic = 'force-dynamic';

export default async function SadGirlFlavorPage() {
    await requireSuperadmin();
    const initialData = await getSadGirlMetrics();

    return <SadGirlDashboardClient initialData={initialData} />;
}
