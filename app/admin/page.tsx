'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Brain, CheckCircle2, Cpu, FileText, Hourglass, ShieldCheck, Users } from 'lucide-react';
import { Navigation } from '@/components/navigation';
import { Footer } from '@/components/footer';
import { DonutChart, StatTile, TrendChart, classColor } from '@/components/charts';
import { getStoredDoctorToken } from '@/lib/client-auth';
import {
  DoctorProfile,
  TONE_BADGE,
  classMeta,
  reportStatusLabel,
  reportStatusTone,
  priorityLabel,
  priorityTone,
} from '@/lib/analysis-types';

interface AdminStats {
  totals: {
    doctors: number;
    admins: number;
    activeSessions: number;
    reports: number;
    validated: number;
    pending: number;
    highPriority: number;
    cellsDetected: number;
    cellsReviewed: number;
    averageQuality: number | null;
  };
  assessments: Record<string, number>;
  activity: Array<{ day: string; reports: number; validated: number; flagged: number }>;
  doctors: Array<DoctorProfile & { reportCount: number; lastActivity: string }>;
  events: Array<{ id: string; doctorName: string; type: string; message: string; createdAt: string }>;
  recentReports: Array<{
    id: string;
    patientName: string;
    patientId: string;
    assessment: string;
    confidence: number;
    priority: string;
    reportStatus: 'draft' | 'in_review' | 'validated';
    qualityScore: number | null;
    createdAt: string;
    doctorName: string;
  }>;
}

interface InferenceHealth {
  endpoint: string;
  status: 'online' | 'degraded' | 'offline';
  latencyMs: number | null;
}

interface ModelBundle {
  artifacts: Array<{ name: string; sizeMb: number; updatedAt: string }>;
  config: Record<string, unknown>;
}

const DAYS = 14;

function recentDays(count: number): string[] {
  const today = new Date();
  return Array.from({ length: count }, (_, index) => {
    const day = new Date(today);
    day.setDate(today.getDate() - (count - 1 - index));
    return day.toISOString().slice(0, 10);
  });
}

const SERVICE_TONE: Record<string, string> = {
  online: 'bg-status-success/10 text-status-success border-status-success/30',
  degraded: 'bg-status-warning/10 text-status-warning border-status-warning/30',
  offline: 'bg-status-critical/10 text-status-critical border-status-critical/30',
};

export default function AdminPage() {
  const [doctor, setDoctor] = useState<DoctorProfile | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [inference, setInference] = useState<InferenceHealth | null>(null);
  const [bundle, setBundle] = useState<ModelBundle | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getStoredDoctorToken();
    if (!token) {
      setLoading(false);
      return;
    }

    void (async () => {
      try {
        const meRes = await fetch('/api/auth/me', { headers: { 'x-doctor-token': token } });
        const me = await meRes.json();
        setDoctor(me.doctor ?? null);

        const statsRes = await fetch('/api/admin/stats', { headers: { 'x-doctor-token': token } });
        const data = await statsRes.json();
        if (!statsRes.ok) {
          setError(data.error ?? 'Unable to load platform statistics.');
          return;
        }
        setStats(data.stats);
        setInference(data.inference);
        setBundle(data.bundle);
      } catch {
        setError('Unable to load platform statistics.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const days = useMemo(() => recentDays(DAYS), []);

  const trend = useMemo(() => {
    const byDay = new Map(stats?.activity.map((entry) => [entry.day, entry]) ?? []);
    return {
      reports: days.map((day) => byDay.get(day)?.reports ?? 0),
      validated: days.map((day) => byDay.get(day)?.validated ?? 0),
      flagged: days.map((day) => byDay.get(day)?.flagged ?? 0),
    };
  }, [days, stats]);

  const distribution = useMemo(
    () =>
      Object.entries(stats?.assessments ?? {})
        .filter(([, value]) => value > 0)
        .map(([name, value]) => ({ label: classMeta(name).label, value, color: classColor(name) })),
    [stats],
  );

  const services = useMemo(() => {
    const status = inference?.status ?? 'offline';
    const latency = inference?.latencyMs;
    return [
      { name: 'Classification (EfficientNet-B0)', status, latency, icon: <Brain size={16} /> },
      { name: 'Bayesian uncertainty (Laplace)', status, latency, icon: <ShieldCheck size={16} /> },
      { name: 'Nucleus segmentation', status, latency, icon: <Cpu size={16} /> },
      { name: 'Explainability (Grad-CAM)', status, latency, icon: <Brain size={16} /> },
      { name: 'Report store', status: 'online' as const, latency: null, icon: <FileText size={16} /> },
    ];
  }, [inference]);

  return (
    <main className="min-h-screen flex flex-col bg-background">
      <Navigation />

      <section className="flex-1 py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-semibold text-foreground mb-2">Administrator dashboard</h1>
            <p className="text-foreground/60">Platform usage, service health and deployed model bundle.</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-foreground/80">
            <ShieldCheck size={16} className="text-primary" /> Administrator
          </span>
        </div>

        {loading ? (
          <p className="text-sm text-foreground/60">Loading platform statistics…</p>
        ) : !doctor ? (
          <div className="rounded-xl border border-border bg-white p-8 text-center">
            <p className="text-foreground/70 mb-4">Sign in with an administrator account to open this dashboard.</p>
            <Link href="/doctor" className="inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white">
              Go to sign in
            </Link>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-border bg-white p-8">
            <p className="flex items-center gap-2 text-foreground/80">
              <AlertTriangle size={18} className="text-status-warning" /> {error}
            </p>
            <p className="mt-2 text-sm text-foreground/60">
              This dashboard is restricted to administrator accounts. Create one from the sign-up form by selecting the
              administrator role.
            </p>
          </div>
        ) : stats ? (
          <div className="space-y-8">
            {/* KPI row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-4">
              <StatTile label="Practitioners" value={stats.totals.doctors} deltaLabel={`${stats.totals.admins} administrator(s)`} icon={<Users size={18} />} />
              <StatTile label="Active sessions" value={stats.totals.activeSessions} deltaLabel="accounts with a live token" icon={<ShieldCheck size={18} />} />
              <StatTile label="Reports" value={stats.totals.reports} deltaLabel="stored on the platform" icon={<FileText size={18} />} trend={trend.reports} />
              <StatTile label="Validated" value={stats.totals.validated} deltaLabel={`${stats.totals.pending} pending`} icon={<CheckCircle2 size={18} />} />
              <StatTile label="High priority" value={stats.totals.highPriority} deltaLabel="flagged by triage" icon={<Hourglass size={18} />} />
              <StatTile label="Mean quality" value={stats.totals.averageQuality ?? '—'} deltaLabel="score / 100" icon={<Cpu size={18} />} />
            </div>

            {/* Activity + services */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2 rounded-lg border border-border bg-white p-6">
                <h2 className="text-lg font-semibold text-foreground mb-1">Platform activity — last {DAYS} days</h2>
                <p className="text-sm text-foreground/60 mb-4">Reports created, validated and flagged as high priority across all practitioners.</p>
                <TrendChart
                  labels={days.map((day) => day.slice(5))}
                  series={[
                    { label: 'Reports', color: '#C62828', values: trend.reports },
                    { label: 'Validated', color: '#2E7D32', values: trend.validated },
                    { label: 'High priority', color: '#E3A008', values: trend.flagged },
                  ]}
                />
              </div>

              <div className="rounded-lg border border-border bg-white p-6">
                <h2 className="text-lg font-semibold text-foreground mb-1">AI service status</h2>
                <p className="text-sm text-foreground/60 mb-4">
                  Live probe of {inference?.endpoint ?? 'the inference service'}.
                </p>
                <ul className="space-y-3">
                  {services.map((service) => (
                    <li key={service.name} className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 text-sm text-foreground/80 min-w-0">
                        <span className="text-primary flex-shrink-0">{service.icon}</span>
                        <span className="truncate">{service.name}</span>
                      </span>
                      <span className="flex items-center gap-2 flex-shrink-0">
                        {service.latency !== null && service.latency !== undefined ? (
                          <span className="text-xs text-foreground/60 tabular-nums">{service.latency} ms</span>
                        ) : null}
                        <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${SERVICE_TONE[service.status]}`}>
                          {service.status === 'online' ? 'Online' : service.status === 'degraded' ? 'Degraded' : 'Offline'}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
                {inference?.status === 'offline' ? (
                  <p className="mt-4 rounded-lg bg-status-critical/5 border border-status-critical/20 p-3 text-xs text-foreground/70">
                    The inference service is unreachable. Start it with <code>uvicorn main:app --port 8000</code> for new
                    analyses to run.
                  </p>
                ) : null}
              </div>
            </div>

            {/* Distribution + model bundle */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="rounded-lg border border-border bg-white p-6">
                <h2 className="text-lg font-semibold text-foreground mb-1">Result distribution</h2>
                <p className="text-sm text-foreground/60 mb-4">Across every stored report.</p>
                {distribution.length ? (
                  <DonutChart segments={distribution} centerValue={stats.totals.reports} centerLabel="reports" size={160} />
                ) : (
                  <p className="text-sm text-foreground/60">No report stored yet.</p>
                )}
              </div>

              <div className="xl:col-span-2 rounded-lg border border-border bg-white p-6">
                <h2 className="text-lg font-semibold text-foreground mb-1">Deployed model bundle</h2>
                <p className="text-sm text-foreground/60 mb-4">Weights and inference configuration currently served.</p>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[420px] text-sm">
                    <thead>
                      <tr className="border-b border-border text-left">
                        <th className="py-2 pr-4 font-semibold text-foreground/70">Artifact</th>
                        <th className="py-2 pr-4 font-semibold text-foreground/70">Size</th>
                        <th className="py-2 font-semibold text-foreground/70">Last updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bundle?.artifacts.length ? (
                        bundle.artifacts.map((artifact) => (
                          <tr key={artifact.name} className="border-b border-border last:border-0">
                            <td className="py-2 pr-4 font-medium text-foreground">{artifact.name}</td>
                            <td className="py-2 pr-4 tabular-nums text-foreground/70">{artifact.sizeMb} MB</td>
                            <td className="py-2 text-foreground/70">{new Date(artifact.updatedAt).toLocaleDateString()}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3} className="py-3 text-foreground/60">
                            No model artifact found in <code>model_bundle/</code>.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {bundle?.config ? (
                  <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-4 text-xs text-foreground/60">
                    <span>Classes: {(bundle.config.classes as string[] | undefined)?.join(', ') ?? '—'}</span>
                    <span>Input size: {(bundle.config.image_size as number | undefined) ?? '—'} px</span>
                    <span>Grad-CAM layer: {(bundle.config.gradcam_target_layer as string | undefined) ?? '—'}</span>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Practitioners + audit */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="rounded-lg border border-border bg-white p-6">
                <h2 className="text-lg font-semibold text-foreground mb-4">Accounts ({stats.doctors.length})</h2>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[460px] text-sm">
                    <thead>
                      <tr className="border-b border-border text-left">
                        <th className="py-2 pr-4 font-semibold text-foreground/70">Name</th>
                        <th className="py-2 pr-4 font-semibold text-foreground/70">Site</th>
                        <th className="py-2 pr-4 font-semibold text-foreground/70">Role</th>
                        <th className="py-2 font-semibold text-foreground/70">Reports</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.doctors.map((entry) => (
                        <tr key={entry.id} className="border-b border-border last:border-0">
                          <td className="py-2 pr-4">
                            <p className="font-medium text-foreground">{entry.fullName}</p>
                            <p className="text-xs text-foreground/60">{entry.email}</p>
                          </td>
                          <td className="py-2 pr-4 text-foreground/70">{entry.hospital || '—'}</td>
                          <td className="py-2 pr-4">
                            <span className="rounded-md border border-border px-2 py-0.5 text-xs text-foreground/70">
                              {entry.role === 'admin' ? 'Administrator' : 'Practitioner'}
                            </span>
                          </td>
                          <td className="py-2 tabular-nums text-foreground/80">{entry.reportCount}</td>
                        </tr>
                      ))}
                      {!stats.doctors.length ? (
                        <tr>
                          <td colSpan={4} className="py-3 text-foreground/60">
                            No account registered yet.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-white p-6">
                <h2 className="text-lg font-semibold text-foreground mb-4">Audit log</h2>
                {stats.events.length ? (
                  <ul className="space-y-3">
                    {stats.events.map((event) => (
                      <li key={event.id} className="flex items-start justify-between gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
                        <div className="min-w-0">
                          <p className="text-sm text-foreground">{event.message}</p>
                          <p className="text-xs text-foreground/60">
                            {event.doctorName} · {event.type}
                          </p>
                        </div>
                        <span className="text-xs text-foreground/60 flex-shrink-0">{new Date(event.createdAt).toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-foreground/60">No activity recorded yet.</p>
                )}
              </div>
            </div>

            {/* Recent reports */}
            <div className="rounded-lg border border-border bg-white p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">Recent reports</h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="py-2 pr-4 font-semibold text-foreground/70">Patient</th>
                      <th className="py-2 pr-4 font-semibold text-foreground/70">Practitioner</th>
                      <th className="py-2 pr-4 font-semibold text-foreground/70">Assessment</th>
                      <th className="py-2 pr-4 font-semibold text-foreground/70">Confidence</th>
                      <th className="py-2 pr-4 font-semibold text-foreground/70">Quality</th>
                      <th className="py-2 pr-4 font-semibold text-foreground/70">Priority</th>
                      <th className="py-2 pr-4 font-semibold text-foreground/70">Status</th>
                      <th className="py-2 font-semibold text-foreground/70">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentReports.map((report) => (
                      <tr key={report.id} className="border-b border-border last:border-0">
                        <td className="py-2 pr-4">
                          <p className="font-medium text-foreground">{report.patientName || 'Unnamed patient'}</p>
                          <p className="text-xs text-foreground/60">{report.patientId || '—'}</p>
                        </td>
                        <td className="py-2 pr-4 text-foreground/70">{report.doctorName}</td>
                        <td className="py-2 pr-4">
                          <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold ${TONE_BADGE[classMeta(report.assessment).tone]}`}>
                            {classMeta(report.assessment).label}
                          </span>
                        </td>
                        <td className="py-2 pr-4 tabular-nums">{report.confidence}%</td>
                        <td className="py-2 pr-4 tabular-nums">{report.qualityScore ?? '—'}</td>
                        <td className="py-2 pr-4">
                          <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium ${TONE_BADGE[priorityTone(report.priority as never)]}`}>
                            {priorityLabel(report.priority as never)}
                          </span>
                        </td>
                        <td className="py-2 pr-4">
                          <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium ${TONE_BADGE[reportStatusTone(report.reportStatus)]}`}>
                            {reportStatusLabel(report.reportStatus)}
                          </span>
                        </td>
                        <td className="py-2 text-foreground/70">{new Date(report.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                    {!stats.recentReports.length ? (
                      <tr>
                        <td colSpan={8} className="py-3 text-foreground/60">
                          No report stored yet.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <Footer />
    </main>
  );
}
