import { requireUser } from '../../src/lib/auth/requireUser';
import { NewPostClient } from '../components/NewPostClient';

export default async function NewPostPage() {
    const { user } = await requireUser();

    return <NewPostClient userEmail={user.email ?? ''} />;
}
