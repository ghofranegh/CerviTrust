import { NextRequest, NextResponse } from 'next/server';
import { resetPassword } from '@/lib/doctor-store';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    await resetPassword(body.token, body.password);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to reset password';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
