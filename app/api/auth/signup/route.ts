import { NextRequest, NextResponse } from 'next/server';
import { registerDoctor } from '@/lib/doctor-store';

export const runtime = 'nodejs';

/**
 * Bootstraps the very first (administrator) account on a fresh install.
 * `registerDoctor` itself refuses once any account exists — every account
 * after that must be created by an administrator from the admin console.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { doctor, token } = await registerDoctor({
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      password: body.password,
      hospital: body.hospital,
      specialty: body.specialty,
      phone: body.phone,
    });
    return NextResponse.json({ doctor, token }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create account';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
