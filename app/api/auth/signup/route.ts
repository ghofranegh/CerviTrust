import { NextRequest, NextResponse } from 'next/server';
import { registerDoctor } from '@/lib/doctor-store';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const wantsAdmin = body.role === 'admin';

    // When ADMIN_SIGNUP_CODE is configured, administrator accounts require it.
    const requiredCode = process.env.ADMIN_SIGNUP_CODE;
    if (wantsAdmin && requiredCode && body.adminCode !== requiredCode) {
      return NextResponse.json({ error: 'Invalid administrator access code.' }, { status: 403 });
    }

    const { doctor, token } = await registerDoctor({
      fullName: body.fullName,
      email: body.email,
      password: body.password,
      hospital: body.hospital,
      specialty: body.specialty,
      phone: body.phone,
      role: wantsAdmin ? 'admin' : 'doctor',
    });
    return NextResponse.json({ doctor, token }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create account';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
