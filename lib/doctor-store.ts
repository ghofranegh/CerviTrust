import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { generatePatientId, isValidEmail, isValidPersonName, isValidTunisianPhone } from '@/lib/validators';
import { sendMail } from '@/lib/mailer';
import { accountCreatedEmail, passwordResetEmail, reportValidatedEmail } from '@/lib/email-templates';

export type DoctorRole = 'doctor' | 'admin';
export type AccountStatus = 'active' | 'inactive';

export interface DoctorRecord {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  passwordHash: string;
  hospital: string;
  specialty: string;
  phone: string;
  role: DoctorRole;
  status: AccountStatus;
  /** Profile picture as a data URL, resized client-side before upload. */
  avatar: string;
  resetToken: string | null;
  resetTokenExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Upper bound for a stored avatar: the store is a JSON file, not a blob store. */
export const MAX_AVATAR_BYTES = 400_000;

/** Doctor record without credential/reset material — this is what leaves the API. */
export type PublicDoctor = Omit<DoctorRecord, 'passwordHash' | 'resetToken' | 'resetTokenExpiresAt'>;

export interface DoctorSession {
  id: string;
  doctorId: string;
  token: string;
  createdAt: string;
}

export interface PatientRecord {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  phone: string;
  notes: string;
  doctorId: string;
  createdAt: string;
  updatedAt: string;
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
  validatedBy: string | null;
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
  patients: PatientRecord[];
  analyses: SavedAnalysis[];
  events: AuditEvent[];
}

const STORE_DIR = path.join(process.cwd(), 'data');
const STORE_PATH = path.join(STORE_DIR, 'doctor-store.json');
const MAX_EVENTS = 500;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

const defaultData: DoctorStoreData = {
  doctors: [],
  sessions: [],
  patients: [],
  analyses: [],
  events: [],
};

export function displayName(person: { firstName?: string; lastName?: string } | null | undefined): string {
  if (!person) return 'Unknown';
  return `${person.firstName ?? ''} ${person.lastName ?? ''}`.trim() || 'Unnamed';
}

export function patientFullName(person: { patientFirstName?: string; patientLastName?: string } | null | undefined): string {
  if (!person) return 'Unnamed patient';
  return `${person.patientFirstName ?? ''} ${person.patientLastName ?? ''}`.trim() || 'Unnamed patient';
}

/** Splits a legacy "fullName"/"patientName" string into best-effort first/last parts. */
function splitLegacyName(value: string | undefined): { first: string; last: string } {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return { first: '', last: '' };
  const [first, ...rest] = trimmed.split(/\s+/);
  return { first, last: rest.join(' ') };
}

/** Fills in fields added after a store file was first written. */
function migrateDoctor(doctor: (DoctorRecord & { fullName?: string }) | Record<string, unknown>): DoctorRecord {
  const record = doctor as DoctorRecord & { fullName?: string };
  const hasSplitName = typeof record.firstName === 'string' && record.firstName.length > 0;
  const { first, last } = hasSplitName ? { first: record.firstName, last: record.lastName ?? '' } : splitLegacyName(record.fullName);
  return {
    ...record,
    firstName: first,
    lastName: last,
    role: record.role ?? 'doctor',
    status: record.status ?? 'active',
    avatar: record.avatar ?? '',
    resetToken: record.resetToken ?? null,
    resetTokenExpiresAt: record.resetTokenExpiresAt ?? null,
  };
}

function migrateAnalysis(analysis: (SavedAnalysis & { patientName?: string }) | Record<string, unknown>): SavedAnalysis {
  const record = analysis as SavedAnalysis & { patientName?: string };
  const hasSplitName = typeof record.patientFirstName === 'string' && record.patientFirstName.length > 0;
  const { first, last } = hasSplitName
    ? { first: record.patientFirstName, last: record.patientLastName ?? '' }
    : splitLegacyName(record.patientName);
  const cellReviews = record.cellReviews ?? {};
  const reviewed = Object.values(cellReviews).filter((review) => review.decision !== 'pending').length;
  return {
    ...record,
    patientFirstName: first,
    patientLastName: last,
    patientRecordId: record.patientRecordId ?? record.patientId ?? '',
    cellReviews,
    reviewerObservations: record.reviewerObservations ?? '',
    reportStatus: record.reportStatus ?? 'draft',
    priority: record.priority ?? 'medium',
    qualityScore: record.qualityScore ?? null,
    cellsDetected: record.cellsDetected ?? 0,
    cellsReviewed: record.cellsReviewed ?? reviewed,
    validatedAt: record.validatedAt ?? null,
    validatedBy: record.validatedBy ?? null,
  };
}

async function readStore(): Promise<DoctorStoreData> {
  await fs.mkdir(STORE_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as DoctorStoreData;
    return {
      doctors: (Array.isArray(parsed.doctors) ? parsed.doctors : []).map(migrateDoctor),
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      patients: Array.isArray(parsed.patients) ? parsed.patients : [],
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

/** Strips credential/reset material before a record is sent to a client. */
export function publicDoctor<T extends DoctorRecord>(doctor: T): PublicDoctor {
  const { passwordHash: _passwordHash, resetToken: _resetToken, resetTokenExpiresAt: _resetTokenExpiresAt, ...rest } = doctor;
  return rest;
}

function pushEvent(store: DoctorStoreData, event: Omit<AuditEvent, 'id' | 'createdAt'>): void {
  store.events.unshift({ ...event, id: crypto.randomUUID(), createdAt: new Date().toISOString() });
  store.events = store.events.slice(0, MAX_EVENTS);
}

/**
 * Creates the very first account on a fresh install. Once any account exists,
 * this always fails — every later account must be created by an administrator
 * through `createAccount`. The bootstrap account is always an administrator.
 */
export async function registerDoctor(input: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  hospital: string;
  specialty: string;
  phone: string;
}) {
  const store = await readStore();
  if (store.doctors.length > 0) {
    throw new Error('An account already exists. Ask an administrator to create yours.');
  }

  const firstName = sanitizeString(input.firstName);
  const lastName = sanitizeString(input.lastName);
  const email = sanitizeString(input.email).toLowerCase();
  const password = sanitizeString(input.password);
  const hospital = sanitizeString(input.hospital);
  const specialty = sanitizeString(input.specialty);
  const phone = sanitizeString(input.phone);

  if (!isValidPersonName(firstName) || !isValidPersonName(lastName)) {
    throw new Error('First and last name must contain letters only (max 100 characters).');
  }
  if (!isValidEmail(email)) {
    throw new Error('Enter a valid email address.');
  }
  if (!password || password.length < 8) {
    throw new Error('Choose a password of at least 8 characters.');
  }
  if (!hospital) {
    throw new Error('Hospital or laboratory is required.');
  }
  if (!isValidTunisianPhone(phone)) {
    throw new Error('Phone number must be exactly 8 digits.');
  }

  const now = new Date().toISOString();
  const doctor: DoctorRecord = {
    id: crypto.randomUUID(),
    firstName,
    lastName,
    email,
    passwordHash: hashPassword(password),
    hospital,
    specialty,
    phone,
    role: 'admin',
    status: 'active',
    avatar: '',
    resetToken: null,
    resetTokenExpiresAt: null,
    createdAt: now,
    updatedAt: now,
  };

  const token = crypto.randomUUID();
  store.doctors.push(doctor);
  store.sessions.push({ id: crypto.randomUUID(), doctorId: doctor.id, token, createdAt: now });
  pushEvent(store, {
    doctorId: doctor.id,
    doctorName: displayName(doctor),
    type: 'account.created',
    message: `Administrator account created (${email}) — platform bootstrap`,
  });
  await writeStore(store);

  return { doctor: publicDoctor(doctor), token };
}

/** Admin-only account creation. The created account is never logged in here. */
export async function createAccount(
  callerId: string,
  input: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    hospital: string;
    specialty: string;
    phone: string;
    role: DoctorRole;
  },
) {
  const store = await readStore();
  const caller = store.doctors.find((entry) => entry.id === callerId);
  if (!caller || caller.role !== 'admin') {
    throw new Error('Only an administrator can create accounts.');
  }

  const firstName = sanitizeString(input.firstName);
  const lastName = sanitizeString(input.lastName);
  const email = sanitizeString(input.email).toLowerCase();
  const password = sanitizeString(input.password);
  const hospital = sanitizeString(input.hospital);
  const specialty = sanitizeString(input.specialty);
  const phone = sanitizeString(input.phone);
  const role: DoctorRole = input.role === 'admin' ? 'admin' : 'doctor';

  if (!isValidPersonName(firstName) || !isValidPersonName(lastName)) {
    throw new Error('First and last name must contain letters only (max 100 characters).');
  }
  if (!isValidEmail(email)) {
    throw new Error('Enter a valid email address.');
  }
  if (!password || password.length < 8) {
    throw new Error('Choose a temporary password of at least 8 characters.');
  }
  if (!isValidTunisianPhone(phone)) {
    throw new Error('Phone number must be exactly 8 digits.');
  }
  if (store.doctors.some((entry) => entry.email === email)) {
    throw new Error('An account already exists with this email.');
  }

  const now = new Date().toISOString();
  const account: DoctorRecord = {
    id: crypto.randomUUID(),
    firstName,
    lastName,
    email,
    passwordHash: hashPassword(password),
    hospital,
    specialty,
    phone,
    role,
    status: 'active',
    avatar: '',
    resetToken: null,
    resetTokenExpiresAt: null,
    createdAt: now,
    updatedAt: now,
  };

  store.doctors.push(account);
  pushEvent(store, {
    doctorId: caller.id,
    doctorName: displayName(caller),
    type: 'account.created',
    message: `${role === 'admin' ? 'Administrator' : 'Practitioner'} account created for ${displayName(account)} (${email})`,
  });
  await writeStore(store);

  void sendMail({ to: email, ...accountCreatedEmail({ firstName, email, role }) });

  return publicDoctor(account);
}

/** Activates/deactivates an account, or changes its role. Admin-only. */
export async function adminUpdateAccount(
  callerId: string,
  targetId: string,
  updates: { status?: AccountStatus; role?: DoctorRole },
) {
  const store = await readStore();
  const caller = store.doctors.find((entry) => entry.id === callerId);
  if (!caller || caller.role !== 'admin') {
    throw new Error('Only an administrator can manage accounts.');
  }
  const target = store.doctors.find((entry) => entry.id === targetId);
  if (!target) {
    throw new Error('Account not found.');
  }

  const next: DoctorRecord = {
    ...target,
    status: updates.status ?? target.status,
    role: updates.role ?? target.role,
    updatedAt: new Date().toISOString(),
  };
  store.doctors = store.doctors.map((entry) => (entry.id === targetId ? next : entry));

  // A deactivated account's open tabs stop working immediately.
  if (updates.status === 'inactive') {
    store.sessions = store.sessions.filter((session) => session.doctorId !== targetId);
  }

  pushEvent(store, {
    doctorId: caller.id,
    doctorName: displayName(caller),
    type: 'account.updated',
    message: `${displayName(target)}'s account ${updates.status ? `set to ${updates.status}` : ''}${
      updates.role ? ` (role: ${updates.role})` : ''
    }`.trim(),
  });
  await writeStore(store);
  return publicDoctor(next);
}

/** Admin-only account deletion. An admin may delete any doctor, but only their own admin account. */
export async function adminDeleteAccount(callerId: string, targetId: string) {
  const store = await readStore();
  const caller = store.doctors.find((entry) => entry.id === callerId);
  if (!caller || caller.role !== 'admin') {
    throw new Error('Only an administrator can delete accounts.');
  }
  const target = store.doctors.find((entry) => entry.id === targetId);
  if (!target) {
    throw new Error('Account not found.');
  }
  if (target.role === 'admin' && target.id !== caller.id) {
    throw new Error('An administrator can only delete their own account, not another administrator.');
  }

  await deleteDoctor(targetId);
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

  if (doctor.status === 'inactive') {
    throw new Error('This account has been deactivated. Contact an administrator.');
  }

  const token = crypto.randomUUID();
  const now = new Date().toISOString();
  store.sessions.push({ id: crypto.randomUUID(), doctorId: doctor.id, token, createdAt: now });
  pushEvent(store, {
    doctorId: doctor.id,
    doctorName: displayName(doctor),
    type: 'session.signin',
    message: `Signed in from ${doctor.hospital || 'unknown site'}`,
  });
  await writeStore(store);

  return { doctor: publicDoctor(doctor), token };
}

/** True while no account exists yet — the sign-in screen offers bootstrap setup instead. */
export async function needsBootstrap(): Promise<boolean> {
  const store = await readStore();
  return store.doctors.length === 0;
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
  firstName?: string;
  lastName?: string;
  email?: string;
  hospital?: string;
  specialty?: string;
  phone?: string;
  avatar?: string;
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

  if (updates.firstName !== undefined && !isValidPersonName(updates.firstName)) {
    throw new Error('First name must contain letters only (max 100 characters).');
  }
  if (updates.lastName !== undefined && !isValidPersonName(updates.lastName)) {
    throw new Error('Last name must contain letters only (max 100 characters).');
  }
  if (updates.phone !== undefined && !isValidTunisianPhone(updates.phone)) {
    throw new Error('Phone number must be exactly 8 digits.');
  }

  const email = sanitizeString(updates.email) ? sanitizeString(updates.email).toLowerCase() : doctor.email;
  if (updates.email !== undefined && !isValidEmail(email)) {
    throw new Error('Enter a valid email address.');
  }
  if (email !== doctor.email && store.doctors.some((entry) => entry.email === email)) {
    throw new Error('Another account already uses this email.');
  }

  if (updates.avatar && updates.avatar.length > MAX_AVATAR_BYTES) {
    throw new Error('The profile picture is too large. Please choose a smaller image.');
  }

  const nextDoctor: DoctorRecord = {
    ...doctor,
    firstName: sanitizeString(updates.firstName) || doctor.firstName,
    lastName: updates.lastName !== undefined ? sanitizeString(updates.lastName) : doctor.lastName,
    hospital: updates.hospital !== undefined ? sanitizeString(updates.hospital) : doctor.hospital,
    specialty: updates.specialty !== undefined ? sanitizeString(updates.specialty) : doctor.specialty,
    phone: updates.phone !== undefined ? sanitizeString(updates.phone) : doctor.phone,
    avatar: updates.avatar !== undefined ? updates.avatar : doctor.avatar,
    id: doctor.id,
    email,
    passwordHash: updates.password ? hashPassword(updates.password) : doctor.passwordHash,
    updatedAt: new Date().toISOString(),
  };

  store.doctors = store.doctors.map((entry) => (entry.id === doctorId ? nextDoctor : entry));
  pushEvent(store, {
    doctorId: nextDoctor.id,
    doctorName: displayName(nextDoctor),
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
  store.patients = store.patients.filter((patient) => patient.doctorId !== doctorId);
  if (doctor) {
    pushEvent(store, {
      doctorId: null,
      doctorName: displayName(doctor),
      type: 'account.deleted',
      message: `Account and related reports removed (${doctor.email})`,
    });
  }
  await writeStore(store);
}

/** Always responds the same way regardless of whether the email exists, to avoid account enumeration. */
export async function requestPasswordReset(email: string): Promise<void> {
  const normalizedEmail = sanitizeString(email).toLowerCase();
  const store = await readStore();
  const doctor = store.doctors.find((entry) => entry.email === normalizedEmail);
  if (!doctor) return;

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString();
  store.doctors = store.doctors.map((entry) =>
    entry.id === doctor.id ? { ...entry, resetToken: token, resetTokenExpiresAt: expiresAt } : entry,
  );
  await writeStore(store);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const resetUrl = `${appUrl}/reset-password?token=${token}`;
  void sendMail({ to: doctor.email, ...passwordResetEmail({ firstName: doctor.firstName, resetUrl }) });
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  if (!token) throw new Error('This reset link is invalid.');
  if (!newPassword || newPassword.length < 8) {
    throw new Error('Choose a password of at least 8 characters.');
  }

  const store = await readStore();
  const doctor = store.doctors.find((entry) => entry.resetToken === token);
  if (!doctor || !doctor.resetTokenExpiresAt || new Date(doctor.resetTokenExpiresAt).getTime() < Date.now()) {
    throw new Error('This reset link is invalid or has expired. Request a new one.');
  }

  store.doctors = store.doctors.map((entry) =>
    entry.id === doctor.id
      ? { ...entry, passwordHash: hashPassword(newPassword), resetToken: null, resetTokenExpiresAt: null, updatedAt: new Date().toISOString() }
      : entry,
  );
  pushEvent(store, {
    doctorId: doctor.id,
    doctorName: displayName(doctor),
    type: 'account.password',
    message: 'Password reset via email link',
  });
  await writeStore(store);
}

/* ------------------------------------------------------------------ */
/* Patients                                                            */
/* ------------------------------------------------------------------ */

export async function listDoctorPatients(doctorId: string): Promise<PatientRecord[]> {
  const store = await readStore();
  return store.patients
    .filter((patient) => patient.doctorId === doctorId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getPatientForDoctor(doctorId: string, patientId: string): Promise<PatientRecord | null> {
  const store = await readStore();
  return store.patients.find((patient) => patient.doctorId === doctorId && patient.id === patientId) ?? null;
}

export async function createPatient(
  doctorId: string,
  input: { firstName: string; lastName: string; dateOfBirth: string; phone: string; notes: string },
): Promise<PatientRecord> {
  const firstName = sanitizeString(input.firstName);
  const lastName = sanitizeString(input.lastName);
  const dateOfBirth = sanitizeString(input.dateOfBirth);
  const phone = sanitizeString(input.phone);

  if (!isValidPersonName(firstName) || !isValidPersonName(lastName)) {
    throw new Error('First and last name must contain letters only (max 100 characters).');
  }
  if (!dateOfBirth) {
    throw new Error('Date of birth is required.');
  }
  if (!isValidTunisianPhone(phone)) {
    throw new Error('Phone number must be exactly 8 digits.');
  }

  const store = await readStore();
  const patient: PatientRecord = {
    id: generatePatientId(store.patients.map((entry) => entry.id)),
    firstName,
    lastName,
    dateOfBirth,
    phone,
    notes: sanitizeString(input.notes),
    doctorId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  store.patients.push(patient);
  await writeStore(store);
  return patient;
}

/* ------------------------------------------------------------------ */
/* Reports                                                             */
/* ------------------------------------------------------------------ */

/** Patient identification required before any report can be stored. */
export const REQUIRED_PATIENT_FIELDS = ['patientFirstName', 'patientLastName', 'patientId', 'dateOfBirth'] as const;

const PATIENT_FIELD_LABELS: Record<(typeof REQUIRED_PATIENT_FIELDS)[number], string> = {
  patientFirstName: 'patient first name',
  patientLastName: 'patient last name',
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
    patientRecordId: sanitizeString(payload.patientRecordId) || sanitizeString(payload.patientId),
    patientFirstName: sanitizeString(payload.patientFirstName),
    patientLastName: sanitizeString(payload.patientLastName),
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
    validatedBy: null,
    createdAt: now,
    updatedAt: now,
  };

  store.analyses.push(analysis);
  pushEvent(store, {
    doctorId,
    doctorName: displayName(doctor),
    type: 'report.saved',
    message: `Report saved for ${patientFullName(analysis)} — ${analysis.assessment.toUpperCase()} (${analysis.confidence}% confidence)`,
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
  const justValidated = reportStatus === 'validated' && existing.reportStatus !== 'validated';
  const next: SavedAnalysis = {
    ...existing,
    ...updates,
    cellReviews,
    reportStatus,
    cellsReviewed: Object.values(cellReviews).filter((review) => review.decision !== 'pending').length,
    validatedAt: reportStatus === 'validated' ? existing.validatedAt ?? now : null,
    validatedBy: reportStatus === 'validated' ? existing.validatedBy ?? displayName(doctor) : null,
    updatedAt: now,
  };

  store.analyses = store.analyses.map((entry) => (entry.id === analysisId ? next : entry));
  if (updates.reportStatus && updates.reportStatus !== existing.reportStatus) {
    pushEvent(store, {
      doctorId,
      doctorName: displayName(doctor),
      type: 'report.status',
      message: `Report for ${patientFullName(next)} moved to "${next.reportStatus.replace('_', ' ')}"`,
    });
  }
  await writeStore(store);

  if (justValidated) {
    const owner = store.doctors.find((entry) => entry.id === next.doctorId);
    if (owner) {
      void sendMail({
        to: owner.email,
        ...reportValidatedEmail({
          doctorFirstName: owner.firstName,
          patientFullName: patientFullName(next),
          patientId: next.patientId,
          validatedByName: displayName(doctor),
          validatedAt: next.validatedAt ?? now,
        }),
      });
    }
  }

  return next;
}

export async function getDoctorAnalysis(doctorId: string, analysisId: string) {
  const store = await readStore();
  const doctor = store.doctors.find((entry) => entry.id === doctorId);
  const analysis = store.analyses.find((entry) => entry.id === analysisId);
  if (!analysis) {
    throw new Error('Report not found.');
  }
  if (analysis.doctorId !== doctorId && doctor?.role !== 'admin') {
    throw new Error('This report belongs to another practitioner.');
  }
  return analysis;
}

export async function deleteDoctorAnalysis(doctorId: string, analysisId: string) {
  const store = await readStore();
  const doctor = store.doctors.find((entry) => entry.id === doctorId);
  const existing = store.analyses.find((entry) => entry.id === analysisId);
  if (!existing) {
    throw new Error('Report not found.');
  }
  if (existing.doctorId !== doctorId && doctor?.role !== 'admin') {
    throw new Error('This report belongs to another practitioner.');
  }

  store.analyses = store.analyses.filter((entry) => entry.id !== analysisId);
  pushEvent(store, {
    doctorId,
    doctorName: displayName(doctor),
    type: 'report.deleted',
    message: `Report for ${patientFullName(existing)} deleted`,
  });
  await writeStore(store);
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

  const reportRow = (analysis: SavedAnalysis) => ({
    id: analysis.id,
    patientFirstName: analysis.patientFirstName,
    patientLastName: analysis.patientLastName,
    patientId: analysis.patientId,
    assessment: analysis.assessment,
    confidence: analysis.confidence,
    priority: analysis.priority,
    reportStatus: analysis.reportStatus,
    qualityScore: analysis.qualityScore,
    createdAt: analysis.createdAt,
    doctorName: displayName(store.doctors.find((doctor) => doctor.id === analysis.doctorId)),
  });

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
      .map(reportRow),
    awaitingValidation: analyses
      .filter((analysis) => analysis.reportStatus === 'in_review')
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map(reportRow),
  };
}
