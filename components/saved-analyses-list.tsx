'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loader2, Pencil, Trash2 } from 'lucide-react';
import { getStoredDoctorToken } from '@/lib/client-auth';
import { CellZoomModal } from '@/components/cell-zoom-modal';
import { PatientOverviewModal } from '@/components/patient-overview-modal';
import { DonutChart, MeterBar, classColor } from '@/components/charts';
import {
  Analysis,
  CellReviewMap,
  ReportStatus,
  RegionOfInterest,
  TONE_BADGE,
  classMeta,
  effectiveClass,
  formatNumber,
  personName,
  priorityLabel,
  priorityTone,
  qualityLabel,
  qualityTone,
  reportStatusLabel,
  reportStatusTone,
  reviewLabel,
  reviewTone,
  toPercent,
} from '@/lib/analysis-types';

interface SavedReport {
  id: string;
  patientRecordId: string;
  patientFirstName: string;
  patientLastName: string;
  patientId: string;
  dateOfBirth: string;
  notes: string;
  assessment: string;
  confidence: number;
  findings: string;
  recommendation: string;
  analysisData: Analysis & Record<string, unknown>;
  cellReviews: CellReviewMap;
  reviewerObservations: string;
  reportStatus: ReportStatus;
  priority: string;
  qualityScore: number | null;
  cellsDetected: number;
  cellsReviewed: number;
  createdAt: string;
}

function reportPatientName(entry: { patientFirstName: string; patientLastName: string }): string {
  return personName({ firstName: entry.patientFirstName, lastName: entry.patientLastName }, 'Unnamed patient');
}

type SortBy = 'date' | 'name' | 'id';

type GroupedReports = Array<{
  patientId: string;
  patientFirstName: string;
  patientLastName: string;
  reports: SavedReport[];
}>;

export function SavedAnalysesList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [filter, setFilter] = useState(searchParams.get('patientId') ?? '');
  const [statusFilter, setStatusFilter] = useState<'all' | ReportStatus>('all');
  const [expandedPatient, setExpandedPatient] = useState<string | null>(searchParams.get('patientId'));
  const [modalReport, setModalReport] = useState<SavedReport | null>(null);
  const [overviewGroup, setOverviewGroup] = useState<GroupedReports[number] | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [zoomRoi, setZoomRoi] = useState<RegionOfInterest | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function loadReports() {
    const token = getStoredDoctorToken();
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch('/api/analyses', { headers: { 'x-doctor-token': token ?? '' } });
      const data = await res.json();
      if (res.ok) setReports(data.analyses ?? []);
    } catch {
      setReports([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadReports();
  }, []);

  const updateStatus = async (report: SavedReport, status: ReportStatus) => {
    const token = getStoredDoctorToken();
    setUpdatingId(report.id);
    try {
      const res = await fetch(`/api/analyses/${report.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-doctor-token': token ?? '' },
        body: JSON.stringify({ reportStatus: status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to update report');
      setReports((current) => current.map((entry) => (entry.id === report.id ? { ...entry, ...data.analysis } : entry)));
      setModalReport((current) => (current && current.id === report.id ? { ...current, ...data.analysis } : current));
    } catch (error) {
      console.error(error);
    } finally {
      setUpdatingId(null);
    }
  };

  const deleteReport = async (report: SavedReport) => {
    if (!window.confirm('Delete this report? This cannot be undone.')) return;
    const token = getStoredDoctorToken();
    setDeletingId(report.id);
    try {
      const res = await fetch(`/api/analyses/${report.id}`, { method: 'DELETE', headers: { 'x-doctor-token': token ?? '' } });
      if (!res.ok) throw new Error('Unable to delete report');
      setReports((current) => current.filter((entry) => entry.id !== report.id));
      setModalReport((current) => (current?.id === report.id ? null : current));
    } catch (error) {
      console.error(error);
    } finally {
      setDeletingId(null);
    }
  };

  const normalizedFilter = filter.trim().toLowerCase();

  const filteredReports = reports.filter((report) => {
    if (statusFilter !== 'all' && report.reportStatus !== statusFilter) return false;
    if (!normalizedFilter) return true;
    const haystack = `${personName({ firstName: report.patientFirstName, lastName: report.patientLastName })} ${report.patientId} ${report.dateOfBirth} ${report.assessment} ${new Date(
      report.createdAt,
    ).toLocaleDateString()}`.toLowerCase();
    return haystack.includes(normalizedFilter);
  });

  const groupedReports = filteredReports.reduce<GroupedReports>((acc, report) => {
    const patientId = report.patientId || 'unknown';
    const existing = acc.find((item) => item.patientId === patientId);
    if (existing) {
      existing.reports.push(report);
    } else {
      acc.push({ patientId, patientFirstName: report.patientFirstName, patientLastName: report.patientLastName, reports: [report] });
    }
    return acc;
  }, []);

  groupedReports.forEach((group) => {
    group.reports.sort((a, b) => {
      if (sortBy === 'name') return reportPatientName(a).localeCompare(reportPatientName(b));
      if (sortBy === 'id') return (a.patientId || '').localeCompare(b.patientId || '');
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  });

  groupedReports.sort((a, b) => {
    if (sortBy === 'name') return reportPatientName(a).localeCompare(reportPatientName(b));
    if (sortBy === 'id') return a.patientId.localeCompare(b.patientId);
    return new Date(b.reports[0]?.createdAt ?? 0).getTime() - new Date(a.reports[0]?.createdAt ?? 0).getTime();
  });

  if (loading) return <p className="text-sm text-foreground/70">Loading saved analyses…</p>;
  if (!reports.length) return <p className="text-sm text-foreground/70">No saved analyses yet.</p>;

  const modalAnalysis = modalReport?.analysisData;
  const modalRegions = modalAnalysis?.regions_of_interest ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <input
          className="rounded-lg border border-border px-3 py-2 text-sm"
          placeholder="Filter by name, ID, result, or date"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
        <div className="flex gap-3">
          <select
            className="rounded-lg border border-border px-3 py-2 text-sm"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as 'all' | ReportStatus)}
          >
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="in_review">In review</option>
            <option value="validated">Validated</option>
          </select>
          <select className="rounded-lg border border-border px-3 py-2 text-sm" value={sortBy} onChange={(event) => setSortBy(event.target.value as SortBy)}>
            <option value="date">Sort by date saved</option>
            <option value="name">Sort by patient name</option>
            <option value="id">Sort by patient ID</option>
          </select>
        </div>
      </div>

      {groupedReports.length === 0 ? <p className="text-sm text-foreground/70">No matches for this filter.</p> : null}

      <div className="space-y-3">
        {groupedReports.map((group) => {
          const isExpanded = expandedPatient === group.patientId;
          const latest = group.reports[0];
          return (
            <div key={group.patientId} className="rounded-lg border border-border bg-secondary/30 p-4">
              <div className="flex w-full items-center justify-between gap-3">
                <button type="button" className="flex flex-1 items-center justify-between gap-3 text-left" onClick={() => setExpandedPatient(isExpanded ? null : group.patientId)}>
                  <div>
                    <p className="font-semibold text-foreground">{reportPatientName(group)}</p>
                    <p className="text-sm text-foreground/60">
                      ID: {group.patientId || '—'} • {group.reports.length} saved analysis{group.reports.length > 1 ? 'es' : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${TONE_BADGE[classMeta(latest?.assessment ?? '').tone]}`}>
                      {classMeta(latest?.assessment ?? '').label}
                    </span>
                    <span className="text-sm text-foreground/70 tabular-nums">{latest?.confidence}%</span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setOverviewGroup(group)}
                  className="flex-shrink-0 rounded-md border border-border bg-white px-3 py-1.5 text-xs font-medium text-foreground/80 hover:bg-secondary"
                >
                  Patient overview
                </button>
              </div>

              {isExpanded ? (
                <div className="mt-4 space-y-3">
                  {group.reports.map((report) => (
                    <div key={report.id} className="rounded-lg border border-border bg-white p-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-foreground">Saved on {new Date(report.createdAt).toLocaleString()}</p>
                          <p className="text-sm text-foreground/60">DOB: {report.dateOfBirth || '—'}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${TONE_BADGE[priorityTone(report.priority as never)]}`}>
                            {priorityLabel(report.priority as never)} priority
                          </span>
                          <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${TONE_BADGE[reportStatusTone(report.reportStatus)]}`}>
                            {reportStatusLabel(report.reportStatus)}
                          </span>
                          <button
                            type="button"
                            className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground/80 hover:bg-secondary"
                            onClick={() => setModalReport(report)}
                          >
                            View details
                          </button>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-foreground/80 hover:bg-secondary"
                            onClick={() => router.push(`/analysis?reportId=${report.id}`)}
                          >
                            <Pencil size={13} /> Edit
                          </button>
                          <button
                            type="button"
                            disabled={deletingId === report.id}
                            className="inline-flex items-center gap-1.5 rounded-md border border-destructive/40 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50"
                            onClick={() => deleteReport(report)}
                          >
                            {deletingId === report.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} Delete
                          </button>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-foreground/60">
                        <span>Quality: {report.qualityScore ?? '—'}/100</span>
                        <span>
                          Cells: {report.cellsReviewed}/{report.cellsDetected} reviewed
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-foreground/70">{report.findings}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {modalReport ? (
        <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/50 p-4">
          <div className="w-full max-w-4xl rounded-xl border border-border bg-white p-6 shadow-xl my-8">
            <div className="flex items-start justify-between gap-3 border-b border-border pb-4">
              <div>
                <h3 className="text-xl font-semibold text-foreground">{personName({ firstName: modalReport.patientFirstName, lastName: modalReport.patientLastName }, 'Unnamed patient')}</h3>
                <p className="text-sm text-foreground/60">
                  Patient ID: {modalReport.patientId || '—'} • DOB: {modalReport.dateOfBirth || '—'} • Saved{' '}
                  {new Date(modalReport.createdAt).toLocaleString()}
                </p>
              </div>
              <button type="button" className="text-sm text-foreground/70 hover:text-foreground" onClick={() => setModalReport(null)}>
                Close
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${TONE_BADGE[classMeta(modalReport.assessment).tone]}`}>
                    {classMeta(modalReport.assessment).label}
                  </span>
                  <span className={`rounded-md border px-2 py-1 text-xs font-medium ${TONE_BADGE[priorityTone(modalReport.priority as never)]}`}>
                    {priorityLabel(modalReport.priority as never)} priority
                  </span>
                  <span className={`rounded-md border px-2 py-1 text-xs font-medium ${TONE_BADGE[qualityTone(modalAnalysis?.quality?.label)]}`}>
                    {qualityLabel(modalAnalysis?.quality?.label)}
                  </span>
                </div>

                <MeterBar label="Calibrated probability" value={modalReport.confidence / 100} display={`${modalReport.confidence}%`} />

                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-t border-border">
                      <td className="py-1.5 text-foreground/70">Bayesian uncertainty</td>
                      <td className="py-1.5 text-right font-medium tabular-nums">± {formatNumber((modalAnalysis?.uncertainty ?? 0) * 100, 1)} pts</td>
                    </tr>
                    <tr className="border-t border-border">
                      <td className="py-1.5 text-foreground/70">Predictive entropy</td>
                      <td className="py-1.5 text-right font-medium tabular-nums">{formatNumber(modalAnalysis?.entropy, 2)}</td>
                    </tr>
                    <tr className="border-t border-border">
                      <td className="py-1.5 text-foreground/70">Slide quality score</td>
                      <td className="py-1.5 text-right font-medium tabular-nums">{modalReport.qualityScore ?? '—'}/100</td>
                    </tr>
                    <tr className="border-t border-border">
                      <td className="py-1.5 text-foreground/70">Cells detected / reviewed</td>
                      <td className="py-1.5 text-right font-medium tabular-nums">
                        {modalReport.cellsDetected} / {modalReport.cellsReviewed}
                      </td>
                    </tr>
                    <tr className="border-t border-border">
                      <td className="py-1.5 text-foreground/70">Segmentation method</td>
                      <td className="py-1.5 text-right font-medium">
                        {modalAnalysis?.segmentationStats?.source === 'hovernet' ? 'HoVer-Net' : 'Watershed'}
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div className="space-y-2 text-sm text-foreground/70">
                  <p>
                    <span className="font-semibold text-foreground">Findings:</span> {modalReport.findings}
                  </p>
                  <p>
                    <span className="font-semibold text-foreground">Recommendation:</span> {modalReport.recommendation}
                  </p>
                  {modalReport.notes ? (
                    <p>
                      <span className="font-semibold text-foreground">Clinical notes:</span> {modalReport.notes}
                    </p>
                  ) : null}
                  {modalReport.reviewerObservations ? (
                    <p>
                      <span className="font-semibold text-foreground">Reviewer observations:</span> {modalReport.reviewerObservations}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
                  <span className="text-sm text-foreground/70">Report status:</span>
                  {(['draft', 'in_review', 'validated'] as ReportStatus[]).map((status) => (
                    <button
                      key={status}
                      type="button"
                      disabled={updatingId === modalReport.id}
                      onClick={() => updateStatus(modalReport, status)}
                      className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                        modalReport.reportStatus === status ? TONE_BADGE[reportStatusTone(status)] : 'border-border text-foreground/70 hover:bg-secondary'
                      }`}
                    >
                      {reportStatusLabel(status)}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
                  <Link
                    href={`/analysis?reportId=${modalReport.id}`}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-foreground/80 hover:bg-secondary"
                  >
                    <Pencil size={13} /> Edit report
                  </Link>
                  <button
                    type="button"
                    disabled={deletingId === modalReport.id}
                    onClick={() => deleteReport(modalReport)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-destructive/40 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50"
                  >
                    {deletingId === modalReport.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} Delete report
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {modalAnalysis?.classDistribution && modalRegions.length ? (
                  <div>
                    <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wide mb-2">Class distribution</p>
                    <DonutChart
                      segments={Object.entries(modalAnalysis.classDistribution)
                        .filter(([, value]) => value > 0)
                        .map(([name, value]) => ({ label: classMeta(name).label, value, color: classColor(name) }))}
                      centerValue={modalRegions.length}
                      centerLabel="cells"
                      size={150}
                    />
                  </div>
                ) : null}

                {modalRegions.length ? (
                  <div>
                    <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wide mb-2">Per-cell decisions</p>
                    <div className="max-h-72 overflow-y-auto rounded-lg border border-border">
                      <table className="w-full text-sm">
                        <tbody>
                          {modalRegions.map((roi) => {
                            const review = modalReport.cellReviews?.[String(roi.id)];
                            const decision = review?.decision ?? 'pending';
                            return (
                              <tr key={roi.id} className="border-b border-border last:border-0">
                                <td className="p-2">
                                  <button type="button" onClick={() => setZoomRoi(roi)} title="Zoom in on this cell">
                                    <img src={`data:image/png;base64,${roi.image}`} alt={`Cell ${roi.id}`} className="h-10 w-10 rounded object-cover" />
                                  </button>
                                </td>
                                <td className="p-2 text-foreground/70">#{roi.id}</td>
                                <td className="p-2">
                                  <span className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${TONE_BADGE[classMeta(effectiveClass(roi, review)).tone]}`}>
                                    {classMeta(effectiveClass(roi, review)).label}
                                  </span>
                                </td>
                                <td className="p-2 text-right tabular-nums text-foreground/70">{toPercent(roi.confidence, 0)}</td>
                                <td className="p-2 text-right">
                                  <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${TONE_BADGE[reviewTone(decision)]}`}>
                                    {reviewLabel(decision)}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}

                {modalAnalysis?.gradcam?.overlay ? (
                  <figure>
                    <img src={`data:image/png;base64,${modalAnalysis.gradcam.overlay}`} alt="Grad-CAM overlay" className="w-full h-40 rounded-lg border border-border object-cover" />
                    <figcaption className="mt-1 text-xs text-foreground/60">Attention overlay recorded with this report</figcaption>
                  </figure>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {overviewGroup ? (
        <PatientOverviewModal
          patient={{ firstName: overviewGroup.patientFirstName, lastName: overviewGroup.patientLastName, id: overviewGroup.patientId }}
          reports={overviewGroup.reports}
          onClose={() => setOverviewGroup(null)}
        />
      ) : null}

      {zoomRoi ? <CellZoomModal roi={zoomRoi} onClose={() => setZoomRoi(null)} /> : null}
    </div>
  );
}
