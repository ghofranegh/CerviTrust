import { NextRequest, NextResponse } from 'next/server';
import { createPatient, getDoctorFromToken, listDoctorPatients } from '@/lib/doctor-store';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const token = req.headers.get('x-doctor-token') ?? req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) {
    return NextResponse.json({ patients: [] }, { status: 401 });
  }

  const doctor = await getDoctorFromToken(token);
  if (!doctor) {
    return NextResponse.json({ patients: [] }, { status: 401 });
  }

  const patients = await listDoctorPatients(doctor.id);
  return NextResponse.json({ patients }, { status: 200 });
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('x-doctor-token') ?? req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const doctor = await getDoctorFromToken(token);
  if (!doctor) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const patient = await createPatient(doctor.id, {
      firstName: body.firstName,
      lastName: body.lastName,
      dateOfBirth: body.dateOfBirth,
      notes: body.notes,
    });
    return NextResponse.json({ patient }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to add patient';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
