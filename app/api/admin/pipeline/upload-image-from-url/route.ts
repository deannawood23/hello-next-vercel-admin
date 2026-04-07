import { proxyPipelineRequest } from '../_lib';

export async function POST(request: Request) {
    const payload = await request.json().catch(() => ({}));
    return proxyPipelineRequest('/pipeline/upload-image-from-url', payload);
}
