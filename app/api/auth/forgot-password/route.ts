import { NextRequest, NextResponse } from 'next/server';
import { requestPasswordReset } from '@/lib/doctor-store';

export const runtime = 'nodejs';

/** Always responds the same way, whether or not the email is registered — avoids account enumeration. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  try {
    await requestPasswordReset(body.email ?? '');
  } catch {
    // Swallowed on purpose — the response never reveals whether the email exists.
  }
  return NextResponse.json(
    { message: 'If an account exists for this email, a reset link has been sent.' },
    { status: 200 },
  );
}
