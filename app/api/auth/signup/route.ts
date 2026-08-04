import { NextRequest, NextResponse } from 'next/server';
import { registerDoctor } from '@/lib/doctor-store';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { doctor, token } = await registerDoctor(body);
    return NextResponse.json({ doctor, token }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create account';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
