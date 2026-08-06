import { promises as fs } from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { getDoctorFromToken, getPlatformStats } from '@/lib/doctor-store';

export const runtime = 'nodejs';

const INFERENCE_URL = process.env.INFERENCE_URL || 'http://localhost:8000/predict';

/** Reads the deployed model bundle: weights on disk and the inference config
 * that pins classes, input size and the uncertainty method. */
async function readModelBundle() {
  const bundleDir = path.join(process.cwd(), 'model_bundle');
  const artifacts: Array<{ name: string; sizeMb: number; updatedAt: string }> = [];
  let config: Record<string, unknown> = {};

  try {
    const entries = await fs.readdir(bundleDir);
    for (const entry of entries) {
      if (!entry.endsWith('.pt')) continue;
      const stat = await fs.stat(path.join(bundleDir, entry));
      artifacts.push({
        name: entry,
        sizeMb: Number((stat.size / 1024 / 1024).toFixed(1)),
        updatedAt: stat.mtime.toISOString(),
      });
    }
    config = JSON.parse(await fs.readFile(path.join(bundleDir, 'inference_config.json'), 'utf8'));
  } catch {
    // A missing bundle is reported as an empty list rather than a hard failure.
  }

  return { artifacts: artifacts.sort((a, b) => a.name.localeCompare(b.name)), config };
}

/** Live probe of the inference service that backs classification, segmentation
 * and Grad-CAM. A reachable FastAPI app answers the OpenAPI route. */
async function probeInference() {
  const base = INFERENCE_URL.replace(/\/predict\/?$/, '');
  const started = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${base}/openapi.json`, { signal: controller.signal, cache: 'no-store' });
    clearTimeout(timeout);
    return {
      endpoint: base,
      status: res.ok ? 'online' : 'degraded',
      latencyMs: Date.now() - started,
    };
  } catch {
    return { endpoint: base, status: 'offline', latencyMs: null };
  }
}

export async function GET(req: NextRequest) {
  const token = req.headers.get('x-doctor-token') ?? req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const doctor = await getDoctorFromToken(token);
  if (!doctor) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (doctor.role !== 'admin') {
    return NextResponse.json({ error: 'Administrator access required.' }, { status: 403 });
  }

  const [stats, inference, bundle] = await Promise.all([getPlatformStats(), probeInference(), readModelBundle()]);

  return NextResponse.json({ stats, inference, bundle }, { status: 200 });
}
