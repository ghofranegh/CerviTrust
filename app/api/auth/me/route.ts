import { NextRequest, NextResponse } from 'next/server';
import { getDoctorFromToken, publicDoctor } from '@/lib/doctor-store';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const token = req.headers.get('x-doctor-token') ?? req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) {
    return NextResponse.json({ doctor: null }, { status: 401 });
  }

  const doctor = await getDoctorFromToken(token);
  if (!doctor) {
    return NextResponse.json({ doctor: null }, { status: 401 });
  }

  return NextResponse.json({ doctor: publicDoctor(doctor) }, { status: 200 });
}
