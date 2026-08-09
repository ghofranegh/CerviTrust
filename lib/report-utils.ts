import { CellReviewMap, RegionOfInterest, effectiveClass } from '@/lib/analysis-types';

export interface PatientInfo {
  patientName: string;
  patientId: string;
  dateOfBirth: string;
  collectionDate: string;
  sampleId: string;
  notes: string;
}

export const EMPTY_PATIENT: PatientInfo = {
  patientName: '',
  patientId: '',
  dateOfBirth: '',
  collectionDate: '',
  sampleId: '',
  notes: '',
};

/** Fields a report cannot be saved without — mirrored server-side. */
export const REQUIRED_PATIENT_FIELDS: Array<{ key: keyof PatientInfo; label: string }> = [
  { key: 'patientName', label: 'Patient name' },
  { key: 'patientId', label: 'Patient ID' },
  { key: 'dateOfBirth', label: 'Date of birth' },
];

export function missingPatientFields(patient: PatientInfo): Array<keyof PatientInfo> {
  return REQUIRED_PATIENT_FIELDS.filter(({ key }) => !patient[key]?.trim()).map(({ key }) => key);
}

function hashString(value: string, multiplier: number): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * multiplier + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/** Stable, non-identifying study reference derived from the sample identifiers. */
export function studyReference(patient: PatientInfo, analyzedAt?: string): string {
  const date = (analyzedAt ?? new Date().toISOString()).slice(0, 10).replace(/-/g, '');
  const seed = patient.patientId || patient.patientName || 'ANON';
  return `CT-${date}-${hashString(seed, 31).toString(36).toUpperCase().padStart(5, '0').slice(0, 5)}`;
}

export function pseudonymise(value: string): string {
  if (!value) return '—';
  return `PSEU-${hashString(value, 33).toString(16).toUpperCase().padStart(8, '0').slice(0, 8)}`;
}

export function ageFrom(dateOfBirth: string): string {
  if (!dateOfBirth) return '—';
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return '—';
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDelta = now.getMonth() - dob.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < dob.getDate())) age -= 1;
  return `${age} years`;
}

/** Per-class counts once the practitioner's corrections are applied. */
export function reviewedDistribution(regions: RegionOfInterest[], reviews: CellReviewMap): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const roi of regions) {
    const name = effectiveClass(roi, reviews[String(roi.id)]).toUpperCase();
    counts[name] = (counts[name] ?? 0) + 1;
  }
  return counts;
}
