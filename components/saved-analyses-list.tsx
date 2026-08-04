'use client';

import { useEffect, useState } from 'react';
import { getStoredDoctorToken } from '@/lib/client-auth';

interface SavedReport {
  id: string;
  patientName: string;
  patientId: string;
  dateOfBirth: string;
  notes: string;
  assessment: string;
  confidence: number;
  findings: string;
  recommendation: string;
  analysisData: Record<string, unknown>;
  createdAt: string;
}

type SortBy = 'date' | 'name' | 'id';

type GroupedReports = Array<{
  patientId: string;
  patientName: string;
  reports: SavedReport[];
}>;

export function SavedAnalysesList() {
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [filter, setFilter] = useState('');
  const [expandedPatient, setExpandedPatient] = useState<string | null>(null);
  const [modalReport, setModalReport] = useState<SavedReport | null>(null);

  useEffect(() => {
    const token = getStoredDoctorToken();
    if (!token) {
      setLoading(false);
      return;
    }

    async function loadReports() {
      try {
        const res = await fetch('/api/analyses', {
          headers: { 'x-doctor-token': token },
        });
        const data = await res.json();
        if (res.ok) setReports(data.analyses ?? []);
      } catch {
        setReports([]);
      } finally {
        setLoading(false);
      }
    }

    void loadReports();
  }, []);

  const normalizedFilter = filter.trim().toLowerCase();

  const filteredReports = reports.filter((report) => {
    if (!normalizedFilter) return true;
    const haystack = `${report.patientName} ${report.patientId} ${report.dateOfBirth} ${new Date(report.createdAt).toLocaleDateString()}`.toLowerCase();
    return haystack.includes(normalizedFilter);
  });

  const groupedReports = filteredReports.reduce<GroupedReports>((acc, report) => {
    const patientId = report.patientId || 'unknown';
    const existing = acc.find((item) => item.patientId === patientId);
    if (existing) {
      existing.reports.push(report);
    } else {
      acc.push({ patientId, patientName: report.patientName || 'Unnamed patient', reports: [report] });
    }
    return acc;
  }, []);

  groupedReports.forEach((group) => {
    group.reports.sort((a, b) => {
      if (sortBy === 'name') {
        return (a.patientName || '').localeCompare(b.patientName || '');
      }
      if (sortBy === 'id') {
        return (a.patientId || '').localeCompare(b.patientId || '');
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  });

  groupedReports.sort((a, b) => {
    if (sortBy === 'name') {
      return a.patientName.localeCompare(b.patientName);
    }
    if (sortBy === 'id') {
      return a.patientId.localeCompare(b.patientId);
    }
    return new Date(b.reports[0]?.createdAt ?? 0).getTime() - new Date(a.reports[0]?.createdAt ?? 0).getTime();
  });

  if (loading) return <p className="text-sm text-foreground/70">Loading saved analyses…</p>;
  if (!reports.length) return <p className="text-sm text-foreground/70">No saved analyses yet.</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <input
          className="rounded-lg border border-border px-3 py-2 text-sm"
          placeholder="Filter by name, ID, or date"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
        <select
          className="rounded-lg border border-border px-3 py-2 text-sm"
          value={sortBy}
          onChange={(event) => setSortBy(event.target.value as SortBy)}
        >
          <option value="date">Sort by date saved</option>
          <option value="name">Sort by patient name</option>
          <option value="id">Sort by patient ID</option>
        </select>
      </div>

      {groupedReports.length === 0 ? (
        <p className="text-sm text-foreground/70">No matches for this filter.</p>
      ) : null}

      <div className="space-y-3">
        {groupedReports.map((group) => {
          const isExpanded = expandedPatient === group.patientId;
          const latest = group.reports[0];
          return (
            <div key={group.patientId} className="rounded-lg border border-border bg-secondary/30 p-4">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 text-left"
                onClick={() => setExpandedPatient(isExpanded ? null : group.patientId)}
              >
                <div>
                  <p className="font-semibold text-foreground">{group.patientName || 'Unnamed patient'}</p>
                  <p className="text-sm text-foreground/60">ID: {group.patientId || '—'} • {group.reports.length} saved analysis{group.reports.length > 1 ? 'es' : ''}</p>
                </div>
                <div className="text-right text-sm text-foreground/70">
                  <p>{latest?.assessment}</p>
                  <p>{latest?.confidence}% confidence</p>
                </div>
              </button>

              {isExpanded ? (
                <div className="mt-4 space-y-3">
                  {group.reports.map((report) => (
                    <div key={report.id} className="rounded-lg border border-border bg-white p-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-foreground">Saved on {new Date(report.createdAt).toLocaleString()}</p>
                          <p className="text-sm text-foreground/60">DOB: {report.dateOfBirth || '—'}</p>
                        </div>
                        <button
                          type="button"
                          className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground/80"
                          onClick={() => setModalReport(report)}
                        >
                          View details
                        </button>
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-2xl rounded-xl border border-border bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold text-foreground">{modalReport.patientName || 'Unnamed patient'}</h3>
                <p className="text-sm text-foreground/60">Patient ID: {modalReport.patientId || '—'} • DOB: {modalReport.dateOfBirth || '—'}</p>
              </div>
              <button type="button" className="text-sm text-foreground/70" onClick={() => setModalReport(null)}>
                Close
              </button>
            </div>
            <div className="mt-4 space-y-3 text-sm text-foreground/70">
              <p><span className="font-semibold text-foreground">Assessment:</span> {modalReport.assessment}</p>
              <p><span className="font-semibold text-foreground">Confidence:</span> {modalReport.confidence}%</p>
              <p><span className="font-semibold text-foreground">Findings:</span> {modalReport.findings}</p>
              <p><span className="font-semibold text-foreground">Recommendation:</span> {modalReport.recommendation}</p>
              {modalReport.notes ? <p><span className="font-semibold text-foreground">Notes:</span> {modalReport.notes}</p> : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
