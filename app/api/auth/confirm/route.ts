import { NextResponse } from 'next/server';
import { route } from '@/lib/server/http.cjs';
import { confirmAccount } from '@/lib/server/accounts.cjs';
export const POST = route('POST', async (request) => NextResponse.json(await confirmAccount(await request.json())));
