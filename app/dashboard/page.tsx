'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Activity, CheckCircle2, ClipboardList, FileText, Microscope, ShieldAlert } from 'lucide-react';
import { Navigation } from '@/components/navigation';
import { Footer } from '@/components/footer';
import { AuthGate } from '@/components/auth-gate';
import { BarDistribution, DonutChart, StatTile, TrendChart, classColor } from '@/components/charts';
import { getStoredDoctorToken } from '@/lib/client-auth';
import {
  DoctorProfile,
  ReportStatus,
  TONE_BADGE,
  classMeta,
  priorityLabel,
  priorityTone,
  reportStatusLabel,
  reportStatusTone,
} from '@/lib/analysis-types';

interface SavedReport {
  id: string;
  patientName: string;
  patientId: string;
  assessment: string;
  confidence: number;
  priority: string;
  reportStatus: ReportStatus;
  qualityScore: number | null;
  cellsDetected: number;
  cellsReviewed: number;
  findings: string;
  createdAt: string;
}

const DAYS = 14;

/** Last N calendar days, oldest first. */
function recentDays(count: number): string[] {
  const today = new Date();
  return Array.from({ length: count }, (_, index) => {
    const day = new Date(today);
    day.setDate(today.getDate() - (count - 1 - index));
    return day.toISOString().slice(0, 10);
  });
}

export default function DashboardPage() {
  return (
    <AuthGate
      headline="Sign in to open your dashboard"
      message="Your screening activity, review queue and quality trends live behind your account."
    >
      {(doctor) => <DashboardContent doctor={doctor} />}
    </AuthGate>
  );
}

function DashboardContent({ doctor }: { doctor: DoctorProfile }) {
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getStoredDoctorToken();
    if (!token) {
      setLoading(false);
      return;
    }

    void (async () => {
      try {
        const res = await fetch('/api/analyses', { headers: { 'x-doctor-token': token } });
        const data = await res.json();
        setReports(Array.isArray(data.analyses) ? data.analyses : []);
      } catch {
        setReports([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const stats = useMemo(() => {
    const validated = reports.filter((report) => report.reportStatus === 'validated').length;
    const highPriority = reports.filter((report) => report.priority === 'high').length;
    const cellsDetected = reports.reduce((sum, report) => sum + (report.cellsDetected ?? 0), 0);
    const cellsReviewed = reports.reduce((sum, report) => sum + (report.cellsReviewed ?? 0), 0);
    const withQuality = reports.filter((report) => typeof report.qualityScore === 'number');
    const avgQuality = withQuality.length
      ? Math.round(withQuality.reduce((sum, report) => sum + (report.qualityScore ?? 0), 0) / withQuality.length)
      : null;
    const avgConfidence = reports.length
      ? Math.round(reports.reduce((sum, report) => sum + report.confidence, 0) / reports.length)
      : 0;

    return {
      total: reports.length,
      validated,
      pending: reports.length - validated,
      highPriority,
      cellsDetected,
      cellsReviewed,
      avgQuality,
      avgConfidence,
    };
  }, [reports]);

  const days = useMemo(() => recentDays(DAYS), []);

  const trend = useMemo(() => {
    const analysed = days.map((day) => reports.filter((report) => report.createdAt.slice(0, 10) === day).length);
    const validated = days.map(
      (day) => reports.filter((report) => report.createdAt.slice(0, 10) === day && report.reportStatus === 'validated').length,
    );
    const flagged = days.map(
      (day) => reports.filter((report) => report.createdAt.slice(0, 10) === day && report.priority === 'high').length,
    );
    return { analysed, validated, flagged };
  }, [days, reports]);

  const distribution = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const report of reports) {
      const key = (report.assessment || 'unknown').toUpperCase();
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return Object.entries(counts)
      .filter(([, value]) => value > 0)
      .map(([name, value]) => ({ label: classMeta(name).label, value, color: classColor(name) }));
  }, [reports]);

  const qualityBuckets = useMemo(() => {
    const buckets = [
      { label: '0–20', min: 0, max: 20 },
      { label: '21–40', min: 21, max: 40 },
      { label: '41–60', min: 41, max: 60 },
      { label: '61–80', min: 61, max: 80 },
      { label: '81–100', min: 81, max: 100 },
    ];
    return buckets.map((bucket) => ({
      label: bucket.label,
      value: reports.filter(
        (report) => typeof report.qualityScore === 'number' && report.qualityScore >= bucket.min && report.qualityScore <= bucket.max,
      ).length,
      color: 'var(--primary)',
    }));
  }, [reports]);

  const reviewQueue = useMemo(
    () =>
      reports
        .filter((report) => report.reportStatus !== 'validated')
        .sort((a, b) => {
          const rank = (priority: string) => (priority === 'high' ? 0 : priority === 'medium' ? 1 : 2);
          return rank(a.priority) - rank(b.priority) || b.createdAt.localeCompare(a.createdAt);
        })
        .slice(0, 6),
    [reports],
  );

  return (
    <main className="min-h-screen flex flex-col bg-background">
      <Navigation />

      <section className="flex-1 py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-semibold text-foreground mb-2">Practitioner dashboard</h1>
            <p className="text-foreground/60">
              {doctor.fullName} — {doctor.hospital || 'no site recorded'}
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/analysis" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90">
              New analysis
            </Link>
            <Link href="/saved-reports" className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium text-foreground/80 hover:bg-secondary">
              All reports
            </Link>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-foreground/60">Loading your activity…</p>
        ) : (
          <div className="space-y-8">
            {/* KPI row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-4">
              <StatTile label="Reports" value={stats.total} deltaLabel="saved in total" icon={<FileText size={18} />} trend={trend.analysed} />
              <StatTile label="Validated" value={stats.validated} deltaLabel={`${stats.pending} awaiting validation`} icon={<CheckCircle2 size={18} />} />
              <StatTile label="High priority" value={stats.highPriority} deltaLabel="flagged by triage" icon={<ShieldAlert size={18} />} />
              <StatTile label="Cells detected" value={stats.cellsDetected} deltaLabel={`${stats.cellsReviewed} reviewed`} icon={<Microscope size={18} />} />
              <StatTile label="Mean quality" value={stats.avgQuality ?? '—'} deltaLabel="score / 100" icon={<Activity size={18} />} />
              <StatTile label="Mean confidence" value={`${stats.avgConfidence}%`} deltaLabel="calibrated probability" icon={<ClipboardList size={18} />} />
            </div>

            {/* Activity + distribution */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2 rounded-lg border border-border bg-white p-6">
                <h2 className="text-lg font-semibold text-foreground mb-1">Activity — last {DAYS} days</h2>
                <p className="text-sm text-foreground/60 mb-4">Reports you saved, validated, and those triage marked as high priority.</p>
                <TrendChart
                  labels={days.map((day) => day.slice(5))}
                  series={[
                    { label: 'Reports saved', color: '#C62828', values: trend.analysed },
                    { label: 'Validated', color: '#2E7D32', values: trend.validated },
                    { label: 'High priority', color: '#E3A008', values: trend.flagged },
                  ]}
                />
              </div>

              <div className="rounded-lg border border-border bg-white p-6">
                <h2 className="text-lg font-semibold text-foreground mb-1">Result distribution</h2>
                <p className="text-sm text-foreground/60 mb-4">Assessment recorded on each saved report.</p>
                {distribution.length ? (
                  <DonutChart segments={distribution} centerValue={stats.total} centerLabel="reports" size={160} />
                ) : (
                  <p className="text-sm text-foreground/60">No report saved yet.</p>
                )}
              </div>
            </div>

            {/* Queue + quality */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2 rounded-lg border border-border bg-white p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Review queue ({reviewQueue.length})</h2>
                    <p className="text-sm text-foreground/60">Reports that are not validated yet, highest priority first.</p>
                  </div>
                  <Link href="/saved-reports" className="text-sm text-primary hover:underline">
                    See all
                  </Link>
                </div>

                {reviewQueue.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[620px] text-sm">
                      <thead>
                        <tr className="border-b border-border text-left">
                          <th className="py-2 pr-4 font-semibold text-foreground/70">Patient</th>
                          <th className="py-2 pr-4 font-semibold text-foreground/70">Assessment</th>
                          <th className="py-2 pr-4 font-semibold text-foreground/70">Confidence</th>
                          <th className="py-2 pr-4 font-semibold text-foreground/70">Priority</th>
                          <th className="py-2 pr-4 font-semibold text-foreground/70">Status</th>
                          <th className="py-2 font-semibold text-foreground/70">Saved</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reviewQueue.map((report) => (
                          <tr key={report.id} className="border-b border-border last:border-0">
                            <td className="py-2.5 pr-4">
                              <p className="font-medium text-foreground">{report.patientName || 'Unnamed patient'}</p>
                              <p className="text-xs text-foreground/60">{report.patientId || '—'}</p>
                            </td>
                            <td className="py-2.5 pr-4">
                              <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold ${TONE_BADGE[classMeta(report.assessment).tone]}`}>
                                {classMeta(report.assessment).label}
                              </span>
                            </td>
                            <td className="py-2.5 pr-4 tabular-nums">{report.confidence}%</td>
                            <td className="py-2.5 pr-4">
                              <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium ${TONE_BADGE[priorityTone(report.priority as never)]}`}>
                                {priorityLabel(report.priority as never)}
                              </span>
                            </td>
                            <td className="py-2.5 pr-4">
                              <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium ${TONE_BADGE[reportStatusTone(report.reportStatus)]}`}>
                                {reportStatusLabel(report.reportStatus)}
                              </span>
                            </td>
                            <td className="py-2.5 text-foreground/70">{new Date(report.createdAt).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-foreground/60">Nothing pending — every saved report has been validated.</p>
                )}
              </div>

              <div className="rounded-lg border border-border bg-white p-6">
                <h2 className="text-lg font-semibold text-foreground mb-1">Image quality</h2>
                <p className="text-sm text-foreground/60 mb-4">Distribution of slide quality scores across your reports.</p>
                <BarDistribution bars={qualityBuckets} height={140} />
                <p className="mt-4 text-xs text-foreground/60">
                  Scores below 45 mark fields that are not reliably interpretable and should be re-acquired.
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

      <Footer />
    </main>
  );
}
