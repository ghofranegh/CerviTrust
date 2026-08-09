import { NextRequest, NextResponse } from 'next/server';
import { deleteDoctor, getDoctorFromToken, publicDoctor, updateDoctor } from '@/lib/doctor-store';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const token = req.headers.get('x-doctor-token') ?? req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) {
    return NextResponse.json({ doctor: null }, { status: 401 });
  }

  const doctor = await getDoctorFromToken(token);
  return NextResponse.json({ doctor: doctor ? publicDoctor(doctor) : null }, { status: doctor ? 200 : 401 });
}

export async function PATCH(req: NextRequest) {
  const token = req.headers.get('x-doctor-token') ?? req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const doctor = await getDoctorFromToken(token);
  if (!doctor) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await req.json()) ?? {};
    // Only these fields can be set from the profile form — never the role.
    const updated = await updateDoctor(doctor.id, {
      fullName: body.fullName,
      email: body.email,
      hospital: body.hospital,
      specialty: body.specialty,
      phone: body.phone,
      avatar: body.avatar,
      currentPassword: body.currentPassword,
      password: body.password,
    });
    return NextResponse.json({ doctor: updated }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update profile';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const token = req.headers.get('x-doctor-token') ?? req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const doctor = await getDoctorFromToken(token);
  if (!doctor) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await deleteDoctor(doctor.id);
  return NextResponse.json({ success: true }, { status: 200 });
}
