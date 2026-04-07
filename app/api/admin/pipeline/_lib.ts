import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '../../../../src/lib/supabase/server';

const PIPELINE_BASE_URL = process.env.PIPELINE_BASE_URL ?? 'https://api.almostcrackd.ai';

type AuthHeadersResult =
    | {
          headers: HeadersInit;
          response?: never;
      }
    | {
          headers?: never;
          response: NextResponse;
      };

async function getPipelineAuthHeaders(): Promise<AuthHeadersResult> {
    const supabase = await createSupabaseServerClient();
    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
        return {
            response: NextResponse.json(
                { message: 'Unauthorized. Sign in again and retry.' },
                { status: 401 }
            ),
        };
    }

    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('is_superadmin')
        .eq('id', user.id)
        .maybeSingle();

    if (profileError) {
        return {
            response: NextResponse.json(
                { message: 'Failed to validate admin access.' },
                { status: 500 }
            ),
        };
    }

    if (profile?.is_superadmin !== true) {
        return {
            response: NextResponse.json({ message: 'Forbidden.' }, { status: 403 }),
        };
    }

    const {
        data: { session },
        error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.access_token) {
        return {
            response: NextResponse.json(
                { message: 'Missing access token. Sign in again and retry.' },
                { status: 401 }
            ),
        };
    }

    return {
        headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
        },
    };
}

export async function proxyPipelineRequest(path: string, payload: unknown) {
    const authResult = await getPipelineAuthHeaders();
    if (authResult.response) {
        return authResult.response;
    }

    try {
        const response = await fetch(`${PIPELINE_BASE_URL}${path}`, {
            method: 'POST',
            headers: authResult.headers,
            body: JSON.stringify(payload),
            cache: 'no-store',
        });
        const contentType = response.headers.get('content-type') ?? 'application/json';
        const body = await response.text();

        return new NextResponse(body, {
            status: response.status,
            headers: {
                'content-type': contentType,
            },
        });
    } catch (error) {
        const message =
            error instanceof Error ? error.message : 'Failed to reach pipeline service.';

        return NextResponse.json({ message }, { status: 502 });
    }
}
