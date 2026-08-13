import { NextRequest, NextResponse } from 'next/server';
import { deleteDoctorAnalysis, getDoctorAnalysis, getDoctorFromToken, updateDoctorAnalysis } from '@/lib/doctor-store';

export const runtime = 'nodejs';

async function authenticate(req: NextRequest) {
  const token = req.headers.get('x-doctor-token') ?? req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  return getDoctorFromToken(token);
}

/** Fetches one saved report — used to reopen it for editing. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const doctor = await authenticate(req);
  if (!doctor) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const analysis = await getDoctorAnalysis(doctor.id, id);
    return NextResponse.json({ analysis }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load report';
    return NextResponse.json({ error: message }, { status: 404 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const doctor = await authenticate(req);
  if (!doctor) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    await deleteDoctorAnalysis(doctor.id, id);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to delete report';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/** Updates the review state of a saved report: per-cell decisions, reviewer
 * observations and report status (draft / in review / validated). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = req.headers.get('x-doctor-token') ?? req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const doctor = await getDoctorFromToken(token);
  if (!doctor) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const analysis = await updateDoctorAnalysis(doctor.id, id, {
      cellReviews: body.cellReviews,
      reviewerObservations: body.reviewerObservations,
      reportStatus: body.reportStatus,
      notes: body.notes,
    });
    return NextResponse.json({ analysis }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update report';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
