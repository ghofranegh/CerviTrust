import { NextResponse } from 'next/server';
import { needsBootstrap } from '@/lib/doctor-store';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({ needsBootstrap: await needsBootstrap() }, { status: 200 });
}
