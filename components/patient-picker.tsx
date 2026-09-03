'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Loader2, Pencil, Search, UserPlus, X } from 'lucide-react';
import { getStoredDoctorToken } from '@/lib/client-auth';
import { EMPTY_PATIENT, PatientInfo } from '@/lib/report-utils';
import { translateError, useTranslation } from '@/lib/i18n';
import { personName } from '@/lib/analysis-types';

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
}

const FIELD = 'w-full rounded-lg border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:border-primary focus:ring-primary/20';
const TODAY = new Date().toISOString().slice(0, 10);

function patientToInfo(patient: Patient, notes: string): PatientInfo {
  return {
    ...EMPTY_PATIENT,
    patientRecordId: patient.id,
    patientFirstName: patient.firstName,
    patientLastName: patient.lastName,
    patientId: patient.id,
    dateOfBirth: patient.dateOfBirth,
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
  const { t } = useTranslation();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [query, setQuery] = useState('');
  const [registering, setRegistering] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', dateOfBirth: '' });
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', dateOfBirth: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editError, setEditError] = useState('');

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
      if (!res.ok) throw new Error(translateError(data.error, t) || t('picker.unableToRegister'));
      setPatients((current) => [data.patient, ...current]);
      onChange(patientToInfo(data.patient, value.notes));
      setRegistering(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('picker.unableToRegister'));
    } finally {
      setSaving(false);
    }
  }

  async function handleEditSave(event: FormEvent) {
    event.preventDefault();
    setEditError('');
    setSaving(true);
    try {
      const token = getStoredDoctorToken();
      const res = await fetch(`/api/patients/${value.patientRecordId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-doctor-token': token ?? '' },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(translateError(data.error, t) || t('picker.unableToUpdate'));
      setPatients((current) => current.map((entry) => (entry.id === data.patient.id ? data.patient : entry)));
      onChange({ ...value, patientFirstName: data.patient.firstName, patientLastName: data.patient.lastName, dateOfBirth: data.patient.dateOfBirth });
      setEditing(false);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : t('picker.unableToUpdate'));
    } finally {
      setSaving(false);
    }
  }

  // A patient is already attached — show a compact summary with a way to edit it or change it.
  if (value.patientRecordId) {
    if (editing) {
      return (
        <form onSubmit={handleEditSave} className="space-y-3 rounded-lg border border-border bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">{t('roster.editPatient')}</p>
            <button type="button" onClick={() => setEditing(false)} className="text-foreground/50 hover:text-foreground" aria-label={t('common.cancel')}>
              <X size={16} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input className={FIELD} placeholder={t('auth.firstName')} maxLength={100} value={editForm.firstName} onChange={(event) => setEditForm({ ...editForm, firstName: event.target.value })} required />
            <input className={FIELD} placeholder={t('auth.lastName')} maxLength={100} value={editForm.lastName} onChange={(event) => setEditForm({ ...editForm, lastName: event.target.value })} required />
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-foreground/60">{t('roster.dateOfBirth')}</span>
            <input className={FIELD} type="date" max={TODAY} value={editForm.dateOfBirth} onChange={(event) => setEditForm({ ...editForm, dateOfBirth: event.target.value })} required />
          </label>
          {editError ? <p className="text-xs text-destructive">{editError}</p> : null}
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-60">
            {saving ? <Loader2 size={14} className="animate-spin" /> : null} {t('roster.saveChanges')}
          </button>
        </form>
      );
    }

    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/30 p-4">
        <div>
          <p className="font-medium text-foreground">{personName({ firstName: value.patientFirstName, lastName: value.patientLastName }, t('common.unnamedPatient'))}</p>
          <p className="text-sm text-foreground/60">
            ID: {value.patientId} {value.dateOfBirth ? `• DOB: ${value.dateOfBirth}` : ''}
          </p>
        </div>
        <div className="flex flex-shrink-0 gap-2">
          <button
            type="button"
            onClick={() => {
              setEditForm({ firstName: value.patientFirstName, lastName: value.patientLastName, dateOfBirth: value.dateOfBirth });
              setEditError('');
              setEditing(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground/80 hover:bg-secondary"
          >
            <Pencil size={13} /> {t('roster.edit')}
          </button>
          <button
            type="button"
            onClick={() =>
              onChange({
                ...EMPTY_PATIENT,
                notes: value.notes,
                sampleId: value.sampleId,
                slideId: value.slideId,
                sampleType: value.sampleType,
                stainingMethod: value.stainingMethod,
                imageStudyId: value.imageStudyId,
              })
            }
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground/80 hover:bg-secondary"
          >
            {t('picker.changePatient')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
        <input
          className={`${FIELD} pl-8`}
          placeholder={t('picker.searchExisting')}
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
          <UserPlus size={15} /> {t('picker.registerNew')}
        </button>
      ) : (
        <form onSubmit={handleRegister} className="space-y-3 rounded-lg border border-border bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">{t('picker.newPatientTitle')}</p>
            <button type="button" onClick={() => setRegistering(false)} className="text-foreground/50 hover:text-foreground" aria-label={t('common.cancel')}>
              <X size={16} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input className={FIELD} placeholder={t('auth.firstName')} maxLength={100} value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} required />
            <input className={FIELD} placeholder={t('auth.lastName')} maxLength={100} value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-foreground/60">{t('roster.dateOfBirth')}</span>
              <input className={FIELD} type="date" max={TODAY} value={form.dateOfBirth} onChange={(event) => setForm({ ...form, dateOfBirth: event.target.value })} required />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-foreground/60">{t('roster.sex')}</span>
              <input className={`${FIELD} bg-secondary text-foreground/60`} value={t('common.female')} disabled />
            </label>
          </div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-60">
            {saving ? <Loader2 size={14} className="animate-spin" /> : null} {t('picker.registerAndUse')}
          </button>
        </form>
      )}
    </div>
  );
}
