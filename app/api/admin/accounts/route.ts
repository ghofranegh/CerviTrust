import { NextRequest, NextResponse } from 'next/server';
import { createAccount, getDoctorFromToken } from '@/lib/doctor-store';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const token = req.headers.get('x-doctor-token') ?? req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const caller = await getDoctorFromToken(token);
  if (!caller) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (caller.role !== 'admin') {
    return NextResponse.json({ error: 'Administrator access required.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const account = await createAccount(caller.id, {
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      password: body.password,
      confirmPassword: body.confirmPassword,
      hospital: body.hospital,
      department: body.department,
      specialty: body.specialty,
      phone: body.phone,
      roleSelection: body.roleSelection,
    });
    return NextResponse.json({ account }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create account';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
