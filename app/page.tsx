import { requireUser } from '../src/lib/auth/requireUser';
import { GalleryClient } from './components/GalleryClient';

export default async function Home() {
    const { user } = await requireUser();

    return <GalleryClient userEmail={user.email ?? ''} />;
}
