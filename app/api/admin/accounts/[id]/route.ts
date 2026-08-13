import { NextRequest, NextResponse } from 'next/server';
import { adminDeleteAccount, adminUpdateAccount, getDoctorFromToken } from '@/lib/doctor-store';

export const runtime = 'nodejs';

async function requireAdmin(req: NextRequest) {
  const token = req.headers.get('x-doctor-token') ?? req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const caller = await getDoctorFromToken(token);
  if (!caller || caller.role !== 'admin') return null;
  return caller;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await requireAdmin(req);
  if (!caller) {
    return NextResponse.json({ error: 'Administrator access required.' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const account = await adminUpdateAccount(caller.id, id, { status: body.status, role: body.role });
    return NextResponse.json({ account }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update account';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await requireAdmin(req);
  if (!caller) {
    return NextResponse.json({ error: 'Administrator access required.' }, { status: 403 });
  }

  try {
    const { id } = await params;
    await adminDeleteAccount(caller.id, id);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to delete account';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
