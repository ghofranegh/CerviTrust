import { NextRequest, NextResponse } from 'next/server';
import { getDoctorFromToken, listDoctorAnalyses, saveDoctorAnalysis } from '@/lib/doctor-store';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const token = req.headers.get('x-doctor-token') ?? req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) {
    return NextResponse.json({ analyses: [] }, { status: 401 });
  }

  const doctor = await getDoctorFromToken(token);
  if (!doctor) {
    return NextResponse.json({ analyses: [] }, { status: 401 });
  }

  const analyses = await listDoctorAnalyses(doctor.id);
  return NextResponse.json({ analyses }, { status: 200 });
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
    const analysis = await saveDoctorAnalysis(doctor.id, body);
    return NextResponse.json({ analysis }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to save analysis';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
