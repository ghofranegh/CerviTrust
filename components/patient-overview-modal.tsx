'use client';

import { X } from 'lucide-react';
import Link from 'next/link';
import { DonutChart, classColor } from '@/components/charts';
import { TONE_BADGE, classMeta, personName, reportStatusLabel, reportStatusTone } from '@/lib/analysis-types';

export interface PatientReportSummary {
  id: string;
  assessment: string;
  confidence: number;
  qualityScore: number | null;
  reportStatus: 'draft' | 'in_review' | 'validated';
  createdAt: string;
}

/**
 * A patient's mini dashboard: report count, assessment distribution and a
 * quick list of their reports. Opens as a popup — no dedicated page — from
 * both the patient roster and the saved-reports patient groups.
 */
export function PatientOverviewModal({
  patient,
  reports,
  onClose,
}: {
  patient: { firstName: string; lastName: string; id: string };
  reports: PatientReportSummary[];
  onClose: () => void;
}) {
  const distribution = Object.entries(
    reports.reduce<Record<string, number>>((acc, report) => {
      const key = (report.assessment || 'unknown').toUpperCase();
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([name, value]) => ({ label: classMeta(name).label, value, color: classColor(name) }));

  const qualityScores = reports.map((r) => r.qualityScore).filter((v): v is number => typeof v === 'number');
  const avgQuality = qualityScores.length ? Math.round(qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length) : null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/50 p-4"
      onClick={onClose}
    >
      <div className="my-8 w-full max-w-2xl rounded-xl border border-border bg-white p-6 shadow-xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-border pb-4">
          <div>
            <h3 className="text-xl font-semibold text-foreground">{personName(patient, 'Unnamed patient')}</h3>
            <p className="text-sm text-foreground/60">Patient ID: {patient.id}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-foreground/60 hover:bg-secondary hover:text-foreground" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border bg-secondary/30 p-3">
                <p className="text-xs text-foreground/60">Reports</p>
                <p className="text-2xl font-semibold text-foreground tabular-nums">{reports.length}</p>
              </div>
              <div className="rounded-lg border border-border bg-secondary/30 p-3">
                <p className="text-xs text-foreground/60">Mean quality</p>
                <p className="text-2xl font-semibold text-foreground tabular-nums">{avgQuality ?? '—'}</p>
              </div>
            </div>

            {distribution.length ? (
              <DonutChart segments={distribution} centerValue={reports.length} centerLabel="reports" size={140} />
            ) : (
              <p className="text-sm text-foreground/60">No report saved for this patient yet.</p>
            )}
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground/60">Report history</p>
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {reports
                .slice()
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map((report) => (
                  <Link
                    key={report.id}
                    href={`/saved-reports?patientId=${patient.id}`}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-secondary"
                  >
                    <span className="text-foreground/70">{new Date(report.createdAt).toLocaleDateString()}</span>
                    <span className="flex items-center gap-2">
                      <span className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${TONE_BADGE[classMeta(report.assessment).tone]}`}>
                        {classMeta(report.assessment).label}
                      </span>
                      <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${TONE_BADGE[reportStatusTone(report.reportStatus)]}`}>
                        {reportStatusLabel(report.reportStatus)}
                      </span>
                    </span>
                  </Link>
                ))}
              {!reports.length ? <p className="text-sm text-foreground/60">Nothing to show yet.</p> : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
