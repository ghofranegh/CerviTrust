import { NextRequest, NextResponse } from 'next/server';
import { getDoctorFromToken, getPatientForDoctor, updatePatient } from '@/lib/doctor-store';

export const runtime = 'nodejs';

async function authenticate(req: NextRequest) {
  const token = req.headers.get('x-doctor-token') ?? req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  return getDoctorFromToken(token);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const doctor = await authenticate(req);
  if (!doctor) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const patient = await getPatientForDoctor(doctor.id, id);
  if (!patient) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
  }
  return NextResponse.json({ patient }, { status: 200 });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const doctor = await authenticate(req);
  if (!doctor) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const patient = await updatePatient(doctor.id, id, {
      firstName: body.firstName,
      lastName: body.lastName,
      dateOfBirth: body.dateOfBirth,
      notes: body.notes,
    });
    return NextResponse.json({ patient }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update patient';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
