'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Loader2, Search, UserPlus, X } from 'lucide-react';
import { getStoredDoctorToken } from '@/lib/client-auth';
import { EMPTY_PATIENT, PatientInfo } from '@/lib/report-utils';
import { personName } from '@/lib/analysis-types';

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  phone: string;
}

const FIELD = 'w-full rounded-lg border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:border-primary focus:ring-primary/20';

function patientToInfo(patient: Patient, notes: string): PatientInfo {
  return {
    ...EMPTY_PATIENT,
    patientRecordId: patient.id,
    patientFirstName: patient.firstName,
    patientLastName: patient.lastName,
    patientId: patient.id,
    dateOfBirth: patient.dateOfBirth,
    phone: patient.phone,
    notes,
  };
}

/**
 * Ties a report to a real, unique 8-character patient ID: either pick an
 * existing patient from the doctor's roster, or register a new one right
 * here (auto-generating the ID) — this is what keeps "fill in patient
 * information" available without free-text, unvalidated patient IDs.
 */
export function PatientPicker({ value, onChange }: { value: PatientInfo; onChange: (patient: PatientInfo) => void }) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [query, setQuery] = useState('');
  const [registering, setRegistering] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', dateOfBirth: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = getStoredDoctorToken();
    if (!token) return;
    void fetch('/api/patients', { headers: { 'x-doctor-token': token } })
      .then((res) => res.json())
      .then((data) => setPatients(Array.isArray(data.patients) ? data.patients : []))
      .catch(() => setPatients([]));
  }, []);

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];
    return patients
      .filter((patient) => `${personName(patient)} ${patient.id} ${patient.dateOfBirth}`.toLowerCase().includes(normalized))
      .slice(0, 6);
  }, [patients, query]);

  async function handleRegister(event: FormEvent) {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      const token = getStoredDoctorToken();
      const res = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-doctor-token': token ?? '' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to register patient');
      setPatients((current) => [data.patient, ...current]);
      onChange(patientToInfo(data.patient, value.notes));
      setRegistering(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to register patient');
    } finally {
      setSaving(false);
    }
  }

  // A patient is already attached — show a compact summary with a way to change it.
  if (value.patientRecordId) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/30 p-4">
        <div>
          <p className="font-medium text-foreground">{personName({ firstName: value.patientFirstName, lastName: value.patientLastName }, 'Unnamed patient')}</p>
          <p className="text-sm text-foreground/60">
            ID: {value.patientId} {value.dateOfBirth ? `• DOB: ${value.dateOfBirth}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onChange({ ...EMPTY_PATIENT, notes: value.notes, collectionDate: value.collectionDate, sampleId: value.sampleId })}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground/80 hover:bg-secondary"
        >
          Change patient
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
        <input
          className={`${FIELD} pl-8`}
          placeholder="Search an existing patient by name, DOB or ID"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {results.length > 0 ? (
        <ul className="divide-y divide-border rounded-lg border border-border bg-white">
          {results.map((patient) => (
            <li key={patient.id}>
              <button
                type="button"
                onClick={() => onChange(patientToInfo(patient, value.notes))}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-secondary"
              >
                <span className="font-medium text-foreground">{personName(patient)}</span>
                <span className="text-xs text-foreground/60">
                  {patient.id} {patient.dateOfBirth ? `• ${patient.dateOfBirth}` : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {!registering ? (
        <button
          type="button"
          onClick={() => setRegistering(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-sm font-medium text-foreground/70 hover:bg-secondary"
        >
          <UserPlus size={15} /> Register a new patient
        </button>
      ) : (
        <form onSubmit={handleRegister} className="space-y-3 rounded-lg border border-border bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">New patient</p>
            <button type="button" onClick={() => setRegistering(false)} className="text-foreground/50 hover:text-foreground" aria-label="Cancel">
              <X size={16} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input className={FIELD} placeholder="First name" maxLength={100} value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} required />
            <input className={FIELD} placeholder="Last name" maxLength={100} value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input className={FIELD} type="date" value={form.dateOfBirth} onChange={(event) => setForm({ ...form, dateOfBirth: event.target.value })} required />
            <div className="flex items-stretch overflow-hidden rounded-lg border border-border bg-white focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
              <span className="flex items-center bg-secondary px-2 text-xs text-foreground/50">+216</span>
              <input
                className="w-full min-w-0 flex-1 px-2 py-2 text-sm text-foreground focus:outline-none"
                placeholder="Phone"
                inputMode="numeric"
                maxLength={8}
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value.replace(/\D/g, '').slice(0, 8) })}
              />
            </div>
          </div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-60">
            {saving ? <Loader2 size={14} className="animate-spin" /> : null} Register &amp; use this patient
          </button>
        </form>
      )}
    </div>
  );
}
