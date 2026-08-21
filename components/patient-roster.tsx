'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Search, X } from 'lucide-react';
import { getStoredDoctorToken } from '@/lib/client-auth';
import { PatientOverviewModal, PatientReportSummary } from '@/components/patient-overview-modal';
import { personName } from '@/lib/analysis-types';

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  notes: string;
  createdAt: string;
}

interface ReportRow extends PatientReportSummary {
  patientId: string;
}

type SortBy = 'recent' | 'name' | 'dateOfBirth' | 'id';

const FIELD =
  'w-full rounded-lg border border-border bg-white px-3 py-2.5 text-foreground placeholder:text-foreground/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';

const EMPTY_FORM = { firstName: '', lastName: '', dateOfBirth: '', notes: '' };
const TODAY = new Date().toISOString().slice(0, 10);

export function PatientRoster() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('recent');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [overviewPatient, setOverviewPatient] = useState<Patient | null>(null);

  async function load() {
    const token = getStoredDoctorToken();
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const [patientsRes, reportsRes] = await Promise.all([
        fetch('/api/patients', { headers: { 'x-doctor-token': token } }),
        fetch('/api/analyses', { headers: { 'x-doctor-token': token } }),
      ]);
      const patientsData = await patientsRes.json();
      const reportsData = await reportsRes.json();
      setPatients(Array.isArray(patientsData.patients) ? patientsData.patients : []);
      setReports(Array.isArray(reportsData.analyses) ? reportsData.analyses : []);
    } catch {
      setPatients([]);
      setReports([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const reportsByPatient = useMemo(() => {
    const map = new Map<string, ReportRow[]>();
    for (const report of reports) {
      const list = map.get(report.patientId) ?? [];
      list.push(report);
      map.set(report.patientId, list);
    }
    return map;
  }, [reports]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = patients.filter((patient) => {
      if (!query) return true;
      const haystack = `${personName(patient)} ${patient.id} ${patient.dateOfBirth}`.toLowerCase();
      return haystack.includes(query);
    });

    return list.sort((a, b) => {
      if (sortBy === 'name') return personName(a).localeCompare(personName(b));
      if (sortBy === 'dateOfBirth') return a.dateOfBirth.localeCompare(b.dateOfBirth);
      if (sortBy === 'id') return a.id.localeCompare(b.id);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [patients, search, sortBy]);

  async function handleAddPatient(event: FormEvent) {
    event.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      const token = getStoredDoctorToken();
      const res = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-doctor-token': token ?? '' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to add patient');
      setPatients((current) => [data.patient, ...current]);
      setForm(EMPTY_FORM);
      setAdding(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to add patient');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-foreground/70">Loading your patients…</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full max-w-sm">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
          <input
            className={`${FIELD} pl-9`}
            placeholder="Search by name, date of birth or ID"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="flex gap-3">
          <select className="rounded-lg border border-border px-3 py-2 text-sm" value={sortBy} onChange={(event) => setSortBy(event.target.value as SortBy)}>
            <option value="recent">Sort by most recent</option>
            <option value="name">Sort by name</option>
            <option value="dateOfBirth">Sort by date of birth</option>
            <option value="id">Sort by patient ID</option>
          </select>
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
          >
            <Plus size={16} /> Add patient
          </button>
        </div>
      </div>

      {!filtered.length ? (
        <p className="rounded-lg border border-border bg-secondary/30 p-6 text-sm text-foreground/70">
          {patients.length ? 'No patient matches this search.' : 'No patient yet — add one to start analysing samples.'}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-white">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/40 text-left">
                <th className="px-4 py-3 font-semibold text-foreground/70">Patient</th>
                <th className="px-4 py-3 font-semibold text-foreground/70">Date of birth</th>
                <th className="px-4 py-3 font-semibold text-foreground/70">ID</th>
                <th className="px-4 py-3 font-semibold text-foreground/70">Reports</th>
                <th className="px-4 py-3 font-semibold text-foreground/70">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((patient) => (
                <tr key={patient.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium text-foreground">{personName(patient)}</td>
                  <td className="px-4 py-3 text-foreground/70">{patient.dateOfBirth || '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-foreground/70">{patient.id}</td>
                  <td className="px-4 py-3 tabular-nums text-foreground/70">{reportsByPatient.get(patient.id)?.length ?? 0}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setOverviewPatient(patient)}
                        className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground/80 hover:bg-secondary"
                      >
                        Overview
                      </button>
                      <Link
                        href={`/analysis?patientId=${patient.id}`}
                        className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90"
                      >
                        Analyse
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {adding ? (
        <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/50 p-4" onClick={() => setAdding(false)}>
          <div className="my-8 w-full max-w-lg rounded-xl border border-border bg-white shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h3 className="text-lg font-semibold text-foreground">Add patient</h3>
              <button type="button" onClick={() => setAdding(false)} className="rounded-md p-1 text-foreground/60 hover:bg-secondary hover:text-foreground" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddPatient} className="space-y-4 px-6 py-5">
              <div className="grid grid-cols-2 gap-3">
                <input className={FIELD} placeholder="First name" maxLength={100} value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} required />
                <input className={FIELD} placeholder="Last name" maxLength={100} value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-foreground">Date of birth</span>
                  <input className={FIELD} type="date" max={TODAY} value={form.dateOfBirth} onChange={(event) => setForm({ ...form, dateOfBirth: event.target.value })} required />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-foreground">Sex</span>
                  <input className={`${FIELD} bg-secondary text-foreground/60`} value="Female" disabled />
                </label>
              </div>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-foreground">Notes (optional)</span>
                <textarea className="min-h-20 w-full rounded-lg border border-border px-3 py-2 text-sm" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
              </label>

              {formError ? <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{formError}</p> : null}

              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <button type="button" onClick={() => setAdding(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground/80 hover:bg-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-60">
                  {saving ? <Loader2 size={15} className="animate-spin" /> : null} Add patient
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {overviewPatient ? (
        <PatientOverviewModal
          patient={overviewPatient}
          reports={reportsByPatient.get(overviewPatient.id) ?? []}
          onClose={() => setOverviewPatient(null)}
        />
      ) : null}
    </div>
  );
}
