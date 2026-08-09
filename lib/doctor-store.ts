import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

export type DoctorRole = 'doctor' | 'admin';

export interface DoctorRecord {
  id: string;
  fullName: string;
  email: string;
  passwordHash: string;
  hospital: string;
  specialty: string;
  phone: string;
  role: DoctorRole;
  /** Profile picture as a data URL, resized client-side before upload. */
  avatar: string;
  createdAt: string;
  updatedAt: string;
}

/** Upper bound for a stored avatar: the store is a JSON file, not a blob store. */
export const MAX_AVATAR_BYTES = 400_000;

/** Doctor record without the credential material — this is what leaves the API. */
export type PublicDoctor = Omit<DoctorRecord, 'passwordHash'>;

export interface DoctorSession {
  id: string;
  doctorId: string;
  token: string;
  createdAt: string;
}

export interface CellReviewRecord {
  decision: 'pending' | 'confirmed' | 'corrected' | 'flagged';
  correctedClass?: string;
  note?: string;
  reviewedAt?: string;
}

export interface SavedAnalysis {
  id: string;
  doctorId: string;
  patientName: string;
  patientId: string;
  dateOfBirth: string;
  notes: string;
  assessment: string;
  confidence: number;
  findings: string;
  recommendation: string;
  analysisData: Record<string, unknown>;
  /** Doctor decision per detected cell, keyed by ROI id. */
  cellReviews: Record<string, CellReviewRecord>;
  reviewerObservations: string;
  reportStatus: 'draft' | 'in_review' | 'validated';
  priority: string;
  qualityScore: number | null;
  cellsDetected: number;
  cellsReviewed: number;
  validatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuditEvent {
  id: string;
  doctorId: string | null;
  doctorName: string;
  type: string;
  message: string;
  createdAt: string;
}

interface DoctorStoreData {
  doctors: DoctorRecord[];
  sessions: DoctorSession[];
  analyses: SavedAnalysis[];
  events: AuditEvent[];
}

const STORE_DIR = path.join(process.cwd(), 'data');
const STORE_PATH = path.join(STORE_DIR, 'doctor-store.json');
const MAX_EVENTS = 500;

const defaultData: DoctorStoreData = {
  doctors: [],
  sessions: [],
  analyses: [],
  events: [],
};

/** Fills in fields added after a store file was first written. */
function migrateAnalysis(analysis: SavedAnalysis): SavedAnalysis {
  const cellReviews = analysis.cellReviews ?? {};
  const reviewed = Object.values(cellReviews).filter((review) => review.decision !== 'pending').length;
  return {
    ...analysis,
    cellReviews,
    reviewerObservations: analysis.reviewerObservations ?? '',
    reportStatus: analysis.reportStatus ?? 'draft',
    priority: analysis.priority ?? 'medium',
    qualityScore: analysis.qualityScore ?? null,
    cellsDetected: analysis.cellsDetected ?? 0,
    cellsReviewed: analysis.cellsReviewed ?? reviewed,
    validatedAt: analysis.validatedAt ?? null,
  };
}

async function readStore(): Promise<DoctorStoreData> {
  await fs.mkdir(STORE_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as DoctorStoreData;
    return {
      doctors: (Array.isArray(parsed.doctors) ? parsed.doctors : []).map((doctor) => ({
        ...doctor,
        role: doctor.role ?? 'doctor',
        avatar: doctor.avatar ?? '',
      })),
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      analyses: (Array.isArray(parsed.analyses) ? parsed.analyses : []).map(migrateAnalysis),
      events: Array.isArray(parsed.events) ? parsed.events : [],
    };
  } catch {
    await writeStore(defaultData);
    return defaultData;
  }
}

async function writeStore(data: DoctorStoreData): Promise<void> {
  await fs.mkdir(STORE_DIR, { recursive: true });
  await fs.writeFile(STORE_PATH, JSON.stringify(data, null, 2), 'utf8');
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100_000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;
  const derived = crypto.pbkdf2Sync(password, salt, 100_000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(derived, 'hex'));
}

function sanitizeString(value: string | undefined): string {
  return (value ?? '').trim();
}

/** Strips the password hash before a record is sent to a client. */
export function publicDoctor<T extends DoctorRecord>(doctor: T): PublicDoctor {
  const { passwordHash: _passwordHash, ...rest } = doctor;
  return rest;
}

function pushEvent(store: DoctorStoreData, event: Omit<AuditEvent, 'id' | 'createdAt'>): void {
  store.events.unshift({ ...event, id: crypto.randomUUID(), createdAt: new Date().toISOString() });
  store.events = store.events.slice(0, MAX_EVENTS);
}

export async function registerDoctor(input: {
  fullName: string;
  email: string;
  password: string;
  hospital: string;
  specialty: string;
  phone: string;
  role?: DoctorRole;
}) {
  const fullName = sanitizeString(input.fullName);
  const email = sanitizeString(input.email).toLowerCase();
  const password = sanitizeString(input.password);
  const hospital = sanitizeString(input.hospital);
  const specialty = sanitizeString(input.specialty);
  const phone = sanitizeString(input.phone);
  const role: DoctorRole = input.role === 'admin' ? 'admin' : 'doctor';

  if (!fullName || !email || !password || !hospital) {
    throw new Error('Full name, email, password, and hospital are required.');
  }

  const store = await readStore();
  const existing = store.doctors.find((doctor) => doctor.email === email);
  if (existing) {
    throw new Error('A doctor account already exists with this email.');
  }

  const now = new Date().toISOString();
  const doctor: DoctorRecord = {
    id: crypto.randomUUID(),
    fullName,
    email,
    passwordHash: hashPassword(password),
    hospital,
    specialty,
    phone,
    role,
    avatar: '',
    createdAt: now,
    updatedAt: now,
  };

  const token = crypto.randomUUID();
  store.doctors.push(doctor);
  store.sessions.push({ id: crypto.randomUUID(), doctorId: doctor.id, token, createdAt: now });
  pushEvent(store, {
    doctorId: doctor.id,
    doctorName: doctor.fullName,
    type: 'account.created',
    message: `${role === 'admin' ? 'Administrator' : 'Practitioner'} account created (${email})`,
  });
  await writeStore(store);

  return { doctor: publicDoctor(doctor), token };
}

export async function loginDoctor(email: string, password: string) {
  const normalizedEmail = sanitizeString(email).toLowerCase();
  const store = await readStore();
  const doctor = store.doctors.find((item) => item.email === normalizedEmail);
  if (!doctor) {
    throw new Error('No account found for this email.');
  }

  if (!verifyPassword(password, doctor.passwordHash)) {
    throw new Error('Incorrect password.');
  }

  const token = crypto.randomUUID();
  const now = new Date().toISOString();
  store.sessions.push({ id: crypto.randomUUID(), doctorId: doctor.id, token, createdAt: now });
  pushEvent(store, {
    doctorId: doctor.id,
    doctorName: doctor.fullName,
    type: 'session.signin',
    message: `Signed in from ${doctor.hospital || 'unknown site'}`,
  });
  await writeStore(store);

  return { doctor: publicDoctor(doctor), token };
}

export async function getDoctorFromToken(token: string): Promise<DoctorRecord | null> {
  const store = await readStore();
  const session = store.sessions.find((entry) => entry.token === token);
  if (!session) {
    return null;
  }
  const doctor = store.doctors.find((entry) => entry.id === session.doctorId);
  return doctor ?? null;
}

export interface DoctorUpdate {
  fullName?: string;
  email?: string;
  hospital?: string;
  specialty?: string;
  phone?: string;
  avatar?: string;
  role?: DoctorRole;
  /** Required by the store whenever `password` is set. */
  currentPassword?: string;
  password?: string;
}

export async function updateDoctor(doctorId: string, updates: DoctorUpdate) {
  const store = await readStore();
  const doctor = store.doctors.find((entry) => entry.id === doctorId);
  if (!doctor) {
    throw new Error('Doctor profile not found.');
  }

  // A new password is only accepted once the current one has been verified.
  if (updates.password) {
    if (!updates.currentPassword) {
      throw new Error('Enter your current password before setting a new one.');
    }
    if (!verifyPassword(updates.currentPassword, doctor.passwordHash)) {
      throw new Error('Your current password is incorrect.');
    }
    if (updates.password.length < 8) {
      throw new Error('The new password must be at least 8 characters long.');
    }
  }

  const email = sanitizeString(updates.email) ? sanitizeString(updates.email).toLowerCase() : doctor.email;
  if (email !== doctor.email && store.doctors.some((entry) => entry.email === email)) {
    throw new Error('Another account already uses this email.');
  }

  if (updates.avatar && updates.avatar.length > MAX_AVATAR_BYTES) {
    throw new Error('The profile picture is too large. Please choose a smaller image.');
  }

  const nextDoctor: DoctorRecord = {
    ...doctor,
    fullName: sanitizeString(updates.fullName) || doctor.fullName,
    hospital: updates.hospital !== undefined ? sanitizeString(updates.hospital) : doctor.hospital,
    specialty: updates.specialty !== undefined ? sanitizeString(updates.specialty) : doctor.specialty,
    phone: updates.phone !== undefined ? sanitizeString(updates.phone) : doctor.phone,
    avatar: updates.avatar !== undefined ? updates.avatar : doctor.avatar,
    id: doctor.id,
    role: updates.role ?? doctor.role,
    email,
    passwordHash: updates.password ? hashPassword(updates.password) : doctor.passwordHash,
    updatedAt: new Date().toISOString(),
  };

  store.doctors = store.doctors.map((entry) => (entry.id === doctorId ? nextDoctor : entry));
  pushEvent(store, {
    doctorId: nextDoctor.id,
    doctorName: nextDoctor.fullName,
    type: updates.password ? 'account.password' : 'account.updated',
    message: updates.password ? 'Password changed' : 'Profile details updated',
  });
  await writeStore(store);
  return publicDoctor(nextDoctor);
}

export async function deleteDoctor(doctorId: string) {
  const store = await readStore();
  const doctor = store.doctors.find((entry) => entry.id === doctorId);
  store.doctors = store.doctors.filter((entry) => entry.id !== doctorId);
  store.sessions = store.sessions.filter((session) => session.doctorId !== doctorId);
  store.analyses = store.analyses.filter((analysis) => analysis.doctorId !== doctorId);
  if (doctor) {
    pushEvent(store, {
      doctorId: null,
      doctorName: doctor.fullName,
      type: 'account.deleted',
      message: `Account and related reports removed (${doctor.email})`,
    });
  }
  await writeStore(store);
}

/** Patient identification required before any report can be stored. */
export const REQUIRED_PATIENT_FIELDS = ['patientName', 'patientId', 'dateOfBirth'] as const;

const PATIENT_FIELD_LABELS: Record<(typeof REQUIRED_PATIENT_FIELDS)[number], string> = {
  patientName: 'patient name',
  patientId: 'patient ID',
  dateOfBirth: 'date of birth',
};

export function missingPatientFields(payload: Record<string, unknown>): string[] {
  return REQUIRED_PATIENT_FIELDS.filter((field) => !sanitizeString(payload[field] as string | undefined)).map(
    (field) => PATIENT_FIELD_LABELS[field],
  );
}

export async function saveDoctorAnalysis(
  doctorId: string,
  payload: Partial<Omit<SavedAnalysis, 'id' | 'doctorId' | 'createdAt' | 'updatedAt'>>,
) {
  const missing = missingPatientFields(payload as Record<string, unknown>);
  if (missing.length) {
    throw new Error(`A report cannot be saved without patient information: add the ${missing.join(', ')}.`);
  }

  const store = await readStore();
  const doctor = store.doctors.find((entry) => entry.id === doctorId);
  const now = new Date().toISOString();
  const cellReviews = payload.cellReviews ?? {};

  const analysis: SavedAnalysis = {
    id: crypto.randomUUID(),
    doctorId,
    patientName: sanitizeString(payload.patientName),
    patientId: sanitizeString(payload.patientId),
    dateOfBirth: sanitizeString(payload.dateOfBirth),
    notes: payload.notes ?? '',
    assessment: payload.assessment ?? '',
    confidence: payload.confidence ?? 0,
    findings: payload.findings ?? '',
    recommendation: payload.recommendation ?? '',
    analysisData: payload.analysisData ?? {},
    cellReviews,
    reviewerObservations: payload.reviewerObservations ?? '',
    // A report is never born validated: validation is a decision taken on a
    // report that already exists in the store.
    reportStatus: payload.reportStatus === 'validated' ? 'in_review' : payload.reportStatus ?? 'draft',
    priority: payload.priority ?? 'medium',
    qualityScore: payload.qualityScore ?? null,
    cellsDetected: payload.cellsDetected ?? 0,
    cellsReviewed:
      payload.cellsReviewed ?? Object.values(cellReviews).filter((review) => review.decision !== 'pending').length,
    validatedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  store.analyses.push(analysis);
  pushEvent(store, {
    doctorId,
    doctorName: doctor?.fullName ?? 'Unknown practitioner',
    type: 'report.saved',
    message: `Report saved for ${analysis.patientName || 'unnamed patient'} — ${analysis.assessment.toUpperCase()} (${analysis.confidence}% confidence)`,
  });
  await writeStore(store);
  return analysis;
}

export async function updateDoctorAnalysis(
  doctorId: string,
  analysisId: string,
  updates: Partial<Pick<SavedAnalysis, 'cellReviews' | 'reviewerObservations' | 'reportStatus' | 'notes'>>,
) {
  const store = await readStore();
  const doctor = store.doctors.find((entry) => entry.id === doctorId);
  const existing = store.analyses.find((entry) => entry.id === analysisId);
  if (!existing) {
    throw new Error('Report not found.');
  }
  if (existing.doctorId !== doctorId && doctor?.role !== 'admin') {
    throw new Error('This report belongs to another practitioner.');
  }

  const now = new Date().toISOString();
  const cellReviews = updates.cellReviews ?? existing.cellReviews;
  const reportStatus = updates.reportStatus ?? existing.reportStatus;
  const next: SavedAnalysis = {
    ...existing,
    ...updates,
    cellReviews,
    reportStatus,
    cellsReviewed: Object.values(cellReviews).filter((review) => review.decision !== 'pending').length,
    validatedAt: reportStatus === 'validated' ? existing.validatedAt ?? now : null,
    updatedAt: now,
  };

  store.analyses = store.analyses.map((entry) => (entry.id === analysisId ? next : entry));
  if (updates.reportStatus && updates.reportStatus !== existing.reportStatus) {
    pushEvent(store, {
      doctorId,
      doctorName: doctor?.fullName ?? 'Unknown practitioner',
      type: 'report.status',
      message: `Report for ${next.patientName || 'unnamed patient'} moved to "${next.reportStatus.replace('_', ' ')}"`,
    });
  }
  await writeStore(store);
  return next;
}

export async function listDoctorAnalyses(doctorId: string) {
  const store = await readStore();
  return store.analyses
    .filter((analysis) => analysis.doctorId === doctorId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listAuditEvents(limit = 25) {
  const store = await readStore();
  return store.events.slice(0, limit);
}

/** Aggregates the whole store for the administrator dashboard. */
export async function getPlatformStats() {
  const store = await readStore();
  const analyses = store.analyses;

  const doctors = store.doctors.map((doctor) => {
    const own = analyses.filter((analysis) => analysis.doctorId === doctor.id);
    return {
      ...publicDoctor(doctor),
      reportCount: own.length,
      lastActivity: own[0]?.createdAt ?? doctor.updatedAt,
    };
  });

  const byDay = new Map<string, { reports: number; validated: number; flagged: number }>();
  for (const analysis of analyses) {
    const day = analysis.createdAt.slice(0, 10);
    const bucket = byDay.get(day) ?? { reports: 0, validated: 0, flagged: 0 };
    bucket.reports += 1;
    if (analysis.reportStatus === 'validated') bucket.validated += 1;
    if (analysis.priority === 'high') bucket.flagged += 1;
    byDay.set(day, bucket);
  }

  const assessments: Record<string, number> = {};
  let qualitySum = 0;
  let qualityCount = 0;
  let cellsDetected = 0;
  let cellsReviewed = 0;

  for (const analysis of analyses) {
    const key = (analysis.assessment || 'unknown').toUpperCase();
    assessments[key] = (assessments[key] ?? 0) + 1;
    if (typeof analysis.qualityScore === 'number') {
      qualitySum += analysis.qualityScore;
      qualityCount += 1;
    }
    cellsDetected += analysis.cellsDetected ?? 0;
    cellsReviewed += analysis.cellsReviewed ?? 0;
  }

  return {
    totals: {
      doctors: store.doctors.filter((doctor) => doctor.role === 'doctor').length,
      admins: store.doctors.filter((doctor) => doctor.role === 'admin').length,
      activeSessions: new Set(store.sessions.map((session) => session.doctorId)).size,
      reports: analyses.length,
      validated: analyses.filter((analysis) => analysis.reportStatus === 'validated').length,
      pending: analyses.filter((analysis) => analysis.reportStatus !== 'validated').length,
      highPriority: analyses.filter((analysis) => analysis.priority === 'high').length,
      cellsDetected,
      cellsReviewed,
      averageQuality: qualityCount ? Math.round(qualitySum / qualityCount) : null,
    },
    assessments,
    activity: [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([day, value]) => ({ day, ...value })),
    doctors: doctors.sort((a, b) => (b.lastActivity ?? '').localeCompare(a.lastActivity ?? '')),
    events: store.events.slice(0, 20),
    recentReports: [...analyses]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 10)
      .map((analysis) => ({
        id: analysis.id,
        patientName: analysis.patientName,
        patientId: analysis.patientId,
        assessment: analysis.assessment,
        confidence: analysis.confidence,
        priority: analysis.priority,
        reportStatus: analysis.reportStatus,
        qualityScore: analysis.qualityScore,
        createdAt: analysis.createdAt,
        doctorName: store.doctors.find((doctor) => doctor.id === analysis.doctorId)?.fullName ?? 'Unknown',
      })),
  };
}
