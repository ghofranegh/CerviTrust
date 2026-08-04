import { NextRequest, NextResponse } from 'next/server';
import { loginDoctor } from '@/lib/doctor-store';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { doctor, token } = await loginDoctor(body.email, body.password);
    return NextResponse.json({ doctor, token }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to sign in';
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
