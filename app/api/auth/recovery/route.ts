import { NextResponse } from 'next/server';
import { route } from '@/lib/server/http.cjs';
import { requestAccountLink } from '@/lib/server/accounts.cjs';
export const POST = route('POST', async (request) => NextResponse.json(await requestAccountLink(await request.json(), 'reset'), { status: 202 }));
