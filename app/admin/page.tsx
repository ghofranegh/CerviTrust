'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  Cpu,
  FileText,
  Hourglass,
  Loader2,
  Plus,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { Navigation } from '@/components/navigation';
import { Footer } from '@/components/footer';
import { AuthGate } from '@/components/auth-gate';
import { DonutChart, StatTile, TrendChart, classColor } from '@/components/charts';
import { getStoredDoctorToken } from '@/lib/client-auth';
import {
  Analysis,
  CellReviewMap,
  DoctorProfile,
  ProfessionalTitle,
  ROLE_SELECT_OPTIONS,
  SPECIALTY_LABELS,
  Specialty,
  TONE_BADGE,
  classMeta,
  personName,
  qualityLabel,
  qualityTone,
  reportStatusLabel,
  reportStatusTone,
  priorityLabel,
  priorityTone,
} from '@/lib/analysis-types';

interface ReportRow {
  id: string;
  patientFirstName: string;
  patientLastName: string;
  patientId: string;
  assessment: string;
  confidence: number;
  priority: string;
  reportStatus: 'draft' | 'in_review' | 'validated';
  qualityScore: number | null;
  createdAt: string;
  doctorName: string;
}

interface PreviewReport {
  id: string;
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
  reportStatus: 'draft' | 'in_review' | 'validated';
  qualityScore: number | null;
  cellsDetected: number;
  cellsReviewed: number;
  createdAt: string;
}

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
  recentReports: ReportRow[];
  awaitingValidation: ReportRow[];
}

const FIELD =
  'w-full rounded-lg border border-border bg-white px-3 py-2.5 text-foreground placeholder:text-foreground/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';

const EMPTY_ACCOUNT_FORM = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  confirmPassword: '',
  hospital: '',
  department: '',
  specialty: '' as Specialty | '',
  phone: '',
  roleSelection: 'pathologist' as ProfessionalTitle | 'administrator',
};

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
  return (
    <AuthGate
      adminOnly
      headline="Sign in to the administration console"
      message="Platform supervision, service health and audit trail require an administrator account."
    >
      {(doctor) => <AdminContent selfId={doctor.id} />}
    </AuthGate>
  );
}

function AdminContent({ selfId }: { selfId: string }) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [inference, setInference] = useState<InferenceHealth | null>(null);
  const [bundle, setBundle] = useState<ModelBundle | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [accountForm, setAccountForm] = useState(EMPTY_ACCOUNT_FORM);
  const [accountError, setAccountError] = useState('');
  const [accountSaving, setAccountSaving] = useState(false);
  const [busyAccountId, setBusyAccountId] = useState<string | null>(null);
  const [busyReportId, setBusyReportId] = useState<string | null>(null);
  const [previewReportId, setPreviewReportId] = useState<string | null>(null);
  const [previewReport, setPreviewReport] = useState<PreviewReport | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  async function loadStats() {
    const token = getStoredDoctorToken();
    if (!token) {
      setLoading(false);
      return;
    }
    try {
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
  }

  useEffect(() => {
    void loadStats();
  }, []);

  async function handleCreateAccount(event: FormEvent) {
    event.preventDefault();
    setAccountError('');
    if (accountForm.password !== accountForm.confirmPassword) {
      setAccountError('Password and confirmation do not match.');
      return;
    }
    setAccountSaving(true);
    try {
      const token = getStoredDoctorToken();
      const res = await fetch('/api/admin/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-doctor-token': token ?? '' },
        body: JSON.stringify(accountForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to create account');
      setAccountForm(EMPTY_ACCOUNT_FORM);
      setCreating(false);
      await loadStats();
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : 'Unable to create account');
    } finally {
      setAccountSaving(false);
    }
  }

  async function handleSetStatus(id: string, status: 'active' | 'inactive') {
    setBusyAccountId(id);
    try {
      const token = getStoredDoctorToken();
      await fetch(`/api/admin/accounts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-doctor-token': token ?? '' },
        body: JSON.stringify({ status }),
      });
      await loadStats();
    } finally {
      setBusyAccountId(null);
    }
  }

  async function handleDeleteAccount(id: string) {
    if (!window.confirm('Delete this account? This also removes its saved reports and patients.')) return;
    setBusyAccountId(id);
    try {
      const token = getStoredDoctorToken();
      const res = await fetch(`/api/admin/accounts/${id}`, {
        method: 'DELETE',
        headers: { 'x-doctor-token': token ?? '' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to delete account');
      await loadStats();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Unable to delete account');
    } finally {
      setBusyAccountId(null);
    }
  }

  async function handleValidateReport(id: string) {
    setBusyReportId(id);
    try {
      const token = getStoredDoctorToken();
      await fetch(`/api/analyses/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-doctor-token': token ?? '' },
        body: JSON.stringify({ reportStatus: 'validated' }),
      });
      setPreviewReportId(null);
      setPreviewReport(null);
      await loadStats();
    } finally {
      setBusyReportId(null);
    }
  }

  async function openPreview(id: string) {
    setPreviewReportId(id);
    setPreviewReport(null);
    setPreviewLoading(true);
    try {
      const token = getStoredDoctorToken();
      const res = await fetch(`/api/analyses/${id}`, { headers: { 'x-doctor-token': token ?? '' } });
      const data = await res.json();
      if (res.ok) setPreviewReport(data.analysis);
    } finally {
      setPreviewLoading(false);
    }
  }

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
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-foreground/80">
              <ShieldCheck size={16} className="text-primary" /> Administrator
            </span>
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
            >
              <Plus size={16} /> Create account
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-foreground/60">Loading platform statistics…</p>
        ) : error ? (
          <div className="rounded-xl border border-border bg-white p-8">
            <p className="flex items-center gap-2 text-foreground/80">
              <AlertTriangle size={18} className="text-status-warning" /> {error}
            </p>
            <p className="mt-2 text-sm text-foreground/60">This dashboard is restricted to administrator accounts.</p>
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
                  <table className="w-full min-w-[560px] text-sm">
                    <thead>
                      <tr className="border-b border-border text-left">
                        <th className="py-2 pr-4 font-semibold text-foreground/70">Name</th>
                        <th className="py-2 pr-4 font-semibold text-foreground/70">Role</th>
                        <th className="py-2 pr-4 font-semibold text-foreground/70">Status</th>
                        <th className="py-2 pr-4 font-semibold text-foreground/70">Reports</th>
                        <th className="py-2 font-semibold text-foreground/70">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.doctors.map((entry) => {
                        const isSelf = entry.id === selfId;
                        const canDelete = entry.role === 'doctor' || isSelf;
                        return (
                          <tr key={entry.id} className="border-b border-border last:border-0">
                            <td className="py-2 pr-4">
                              <p className="font-medium text-foreground">
                                {personName(entry)}
                                {isSelf ? <span className="ml-1 text-xs text-foreground/50">(you)</span> : null}
                              </p>
                              <p className="text-xs text-foreground/60">{entry.email}</p>
                            </td>
                            <td className="py-2 pr-4">
                              <span className="rounded-md border border-border px-2 py-0.5 text-xs text-foreground/70">
                                {entry.role === 'admin' ? 'Administrator' : 'Practitioner'}
                              </span>
                            </td>
                            <td className="py-2 pr-4">
                              <span
                                className={`rounded-md border px-2 py-0.5 text-xs font-medium ${
                                  entry.status === 'inactive'
                                    ? 'border-status-critical/30 bg-status-critical/10 text-status-critical'
                                    : 'border-status-success/30 bg-status-success/10 text-status-success'
                                }`}
                              >
                                {entry.status === 'inactive' ? 'Deactivated' : 'Active'}
                              </span>
                            </td>
                            <td className="py-2 pr-4 tabular-nums text-foreground/80">{entry.reportCount}</td>
                            <td className="py-2">
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  disabled={busyAccountId === entry.id}
                                  onClick={() => handleSetStatus(entry.id, entry.status === 'inactive' ? 'active' : 'inactive')}
                                  className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground/80 hover:bg-secondary disabled:opacity-50"
                                >
                                  {entry.status === 'inactive' ? 'Activate' : 'Deactivate'}
                                </button>
                                <button
                                  type="button"
                                  disabled={busyAccountId === entry.id || !canDelete}
                                  title={!canDelete ? "An administrator can't delete another administrator's account" : undefined}
                                  onClick={() => handleDeleteAccount(entry.id)}
                                  className="rounded-md border border-destructive/40 px-2.5 py-1 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-40"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {!stats.doctors.length ? (
                        <tr>
                          <td colSpan={5} className="py-3 text-foreground/60">
                            No account registered yet.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-white p-6">
                <h2 className="text-lg font-semibold text-foreground mb-1">Audit log</h2>
                <p className="text-sm text-foreground/60 mb-4">Showing 5 at a time — scroll for more.</p>
                {stats.events.length ? (
                  <ul className="max-h-[320px] space-y-3 overflow-y-auto pr-1">
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

            {/* Reports awaiting validation */}
            <div className="rounded-lg border border-border bg-white p-6">
              <h2 className="text-lg font-semibold text-foreground mb-1">Reports awaiting validation ({stats.awaitingValidation.length})</h2>
              <p className="text-sm text-foreground/60 mb-4">
                Reports a practitioner marked "In review". Validating notifies them by email.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="py-2 pr-4 font-semibold text-foreground/70">Patient</th>
                      <th className="py-2 pr-4 font-semibold text-foreground/70">Practitioner</th>
                      <th className="py-2 pr-4 font-semibold text-foreground/70">Assessment</th>
                      <th className="py-2 pr-4 font-semibold text-foreground/70">Saved</th>
                      <th className="py-2 font-semibold text-foreground/70">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.awaitingValidation.map((report) => (
                      <tr
                        key={report.id}
                        onClick={() => openPreview(report.id)}
                        className="cursor-pointer border-b border-border last:border-0 hover:bg-secondary/40"
                        title="Preview this report before validating"
                      >
                        <td className="py-2 pr-4">
                          <p className="font-medium text-foreground">{personName({ firstName: report.patientFirstName, lastName: report.patientLastName }, 'Unnamed patient')}</p>
                          <p className="text-xs text-foreground/60">{report.patientId || '—'}</p>
                        </td>
                        <td className="py-2 pr-4 text-foreground/70">{report.doctorName}</td>
                        <td className="py-2 pr-4">
                          <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold ${TONE_BADGE[classMeta(report.assessment).tone]}`}>
                            {classMeta(report.assessment).label}
                          </span>
                        </td>
                        <td className="py-2 pr-4 text-foreground/70">{new Date(report.createdAt).toLocaleDateString()}</td>
                        <td className="py-2">
                          <button
                            type="button"
                            disabled={busyReportId === report.id}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleValidateReport(report.id);
                            }}
                            className="inline-flex items-center gap-1.5 rounded-md bg-status-success px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                          >
                            {busyReportId === report.id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} Validate
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!stats.awaitingValidation.length ? (
                      <tr>
                        <td colSpan={5} className="py-3 text-foreground/60">
                          Nothing awaiting validation.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent reports */}
            <div className="rounded-lg border border-border bg-white p-6">
              <h2 className="text-lg font-semibold text-foreground mb-1">Recent reports</h2>
              <p className="text-sm text-foreground/60 mb-4">Showing 5 at a time — scroll for more. Click a row to preview.</p>
              <div className="max-h-[360px] overflow-y-auto overflow-x-auto">
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
                      <tr key={report.id} onClick={() => openPreview(report.id)} className="cursor-pointer border-b border-border last:border-0 hover:bg-secondary/40">
                        <td className="py-2 pr-4">
                          <p className="font-medium text-foreground">{personName({ firstName: report.patientFirstName, lastName: report.patientLastName }, 'Unnamed patient')}</p>
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

      {creating ? (
        <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/50 p-4" onClick={() => setCreating(false)}>
          <div className="my-8 w-full max-w-lg rounded-xl border border-border bg-white shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h3 className="text-lg font-semibold text-foreground">Create account</h3>
              <button type="button" onClick={() => setCreating(false)} className="rounded-md p-1 text-foreground/60 hover:bg-secondary hover:text-foreground" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateAccount} className="space-y-4 px-6 py-5">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-foreground">Role</span>
                <select
                  className={FIELD}
                  value={accountForm.roleSelection}
                  onChange={(event) =>
                    setAccountForm({
                      ...accountForm,
                      roleSelection: event.target.value as ProfessionalTitle | 'administrator',
                      specialty: event.target.value === 'administrator' ? '' : accountForm.specialty,
                    })
                  }
                >
                  {ROLE_SELECT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <input className={FIELD} placeholder="First name" maxLength={100} value={accountForm.firstName} onChange={(event) => setAccountForm({ ...accountForm, firstName: event.target.value })} required />
                <input className={FIELD} placeholder="Last name" maxLength={100} value={accountForm.lastName} onChange={(event) => setAccountForm({ ...accountForm, lastName: event.target.value })} required />
              </div>
              <input className={FIELD} type="email" placeholder="Professional email address" maxLength={320} value={accountForm.email} onChange={(event) => setAccountForm({ ...accountForm, email: event.target.value })} required />
              <div className="grid grid-cols-2 gap-3">
                <input className={FIELD} type="password" placeholder="Temporary password" minLength={8} value={accountForm.password} onChange={(event) => setAccountForm({ ...accountForm, password: event.target.value })} required />
                <input className={FIELD} type="password" placeholder="Confirm password" minLength={8} value={accountForm.confirmPassword} onChange={(event) => setAccountForm({ ...accountForm, confirmPassword: event.target.value })} required />
              </div>
              <input className={FIELD} placeholder="Organization / Hospital / Laboratory" value={accountForm.hospital} onChange={(event) => setAccountForm({ ...accountForm, hospital: event.target.value })} />
              {accountForm.roleSelection !== 'administrator' ? (
                <div className="grid grid-cols-2 gap-3">
                  <select
                    className={FIELD}
                    value={accountForm.specialty}
                    onChange={(event) => setAccountForm({ ...accountForm, specialty: event.target.value as Specialty })}
                    required
                  >
                    <option value="" disabled>
                      Choose a specialty
                    </option>
                    {Object.entries(SPECIALTY_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <input className={FIELD} placeholder="Department / Service" value={accountForm.department} onChange={(event) => setAccountForm({ ...accountForm, department: event.target.value })} />
                </div>
              ) : null}
              <div className="flex items-stretch overflow-hidden rounded-lg border border-border bg-white focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
                <span className="flex items-center bg-secondary px-3 text-sm text-foreground/50">+216</span>
                <input
                  className="w-full min-w-0 flex-1 px-3 py-2.5 text-foreground focus:outline-none"
                  type="tel"
                  inputMode="numeric"
                  maxLength={8}
                  placeholder="Phone (optional)"
                  value={accountForm.phone}
                  onChange={(event) => setAccountForm({ ...accountForm, phone: event.target.value.replace(/\D/g, '').slice(0, 8) })}
                />
              </div>

              {accountError ? <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{accountError}</p> : null}

              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <button type="button" onClick={() => setCreating(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground/80 hover:bg-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={accountSaving} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-60">
                  {accountSaving ? <Loader2 size={15} className="animate-spin" /> : null} Create account
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {previewReportId ? (
        <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/50 p-4" onClick={() => setPreviewReportId(null)}>
          <div className="my-8 w-full max-w-3xl rounded-xl border border-border bg-white p-6 shadow-xl" onClick={(event) => event.stopPropagation()}>
            {previewLoading || !previewReport ? (
              <div className="flex items-center justify-center py-16 text-foreground/60">
                <Loader2 size={20} className="animate-spin" />
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3 border-b border-border pb-4">
                  <div>
                    <h3 className="text-xl font-semibold text-foreground">
                      {personName({ firstName: previewReport.patientFirstName, lastName: previewReport.patientLastName }, 'Unnamed patient')}
                    </h3>
                    <p className="text-sm text-foreground/60">
                      Patient ID: {previewReport.patientId || '—'} • DOB: {previewReport.dateOfBirth || '—'} • Saved{' '}
                      {new Date(previewReport.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <button type="button" className="text-sm text-foreground/70 hover:text-foreground" onClick={() => setPreviewReportId(null)}>
                    Close
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${TONE_BADGE[classMeta(previewReport.assessment).tone]}`}>
                    {classMeta(previewReport.assessment).label}
                  </span>
                  <span className={`rounded-md border px-2 py-1 text-xs font-medium ${TONE_BADGE[reportStatusTone(previewReport.reportStatus)]}`}>
                    {reportStatusLabel(previewReport.reportStatus)}
                  </span>
                  <span className={`rounded-md border px-2 py-1 text-xs font-medium ${TONE_BADGE[qualityTone(previewReport.analysisData?.quality?.label)]}`}>
                    {qualityLabel(previewReport.analysisData?.quality?.label)}
                  </span>
                  <span className="text-sm text-foreground/70 tabular-nums">{previewReport.confidence}% confidence</span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                  <div className="rounded-lg border border-border bg-secondary/30 p-3">
                    <p className="text-xs text-foreground/60">Quality score</p>
                    <p className="text-lg font-semibold text-foreground tabular-nums">{previewReport.qualityScore ?? '—'}/100</p>
                  </div>
                  <div className="rounded-lg border border-border bg-secondary/30 p-3">
                    <p className="text-xs text-foreground/60">Cells detected</p>
                    <p className="text-lg font-semibold text-foreground tabular-nums">{previewReport.cellsDetected}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-secondary/30 p-3">
                    <p className="text-xs text-foreground/60">Cells reviewed</p>
                    <p className="text-lg font-semibold text-foreground tabular-nums">{previewReport.cellsReviewed}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-secondary/30 p-3">
                    <p className="text-xs text-foreground/60">Reviewed cells</p>
                    <p className="text-lg font-semibold text-foreground tabular-nums">
                      {Object.values(previewReport.cellReviews ?? {}).filter((review) => review.decision !== 'pending').length} / {Object.keys(previewReport.cellReviews ?? {}).length}
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-2 text-sm text-foreground/70">
                  <p>
                    <span className="font-semibold text-foreground">Findings:</span> {previewReport.findings}
                  </p>
                  <p>
                    <span className="font-semibold text-foreground">Recommendation:</span> {previewReport.recommendation}
                  </p>
                  {previewReport.reviewerObservations ? (
                    <p>
                      <span className="font-semibold text-foreground">Reviewer observations:</span> {previewReport.reviewerObservations}
                    </p>
                  ) : null}
                  {previewReport.notes ? (
                    <p>
                      <span className="font-semibold text-foreground">Clinical notes:</span> {previewReport.notes}
                    </p>
                  ) : null}
                </div>

                <div className="mt-6 flex justify-end gap-2 border-t border-border pt-4">
                  <button type="button" onClick={() => setPreviewReportId(null)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground/80 hover:bg-secondary">
                    Close
                  </button>
                  <button
                    type="button"
                    disabled={previewReport.reportStatus === 'validated' || busyReportId === previewReport.id}
                    onClick={() => handleValidateReport(previewReport.id)}
                    className="inline-flex items-center gap-2 rounded-lg bg-status-success px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {busyReportId === previewReport.id ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                    {previewReport.reportStatus === 'validated' ? 'Already validated' : 'Validate report'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      <Footer />
    </main>
  );
}
