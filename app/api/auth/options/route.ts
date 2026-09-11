import { NextResponse } from 'next/server';
import { route } from '@/lib/server/http.cjs';
import { publicRegistration } from '@/lib/server/accounts.cjs';
export const GET = route('GET', async () => NextResponse.json({ publicRegistration: publicRegistration() }));
