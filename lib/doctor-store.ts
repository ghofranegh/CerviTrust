import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface DoctorRecord {
  id: string;
  fullName: string;
  email: string;
  passwordHash: string;
  hospital: string;
  specialty: string;
  phone: string;
  createdAt: string;
  updatedAt: string;
}

export interface DoctorSession {
  id: string;
  doctorId: string;
  token: string;
  createdAt: string;
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
  createdAt: string;
  updatedAt: string;
}

interface DoctorStoreData {
  doctors: DoctorRecord[];
  sessions: DoctorSession[];
  analyses: SavedAnalysis[];
}

const STORE_DIR = path.join(process.cwd(), 'data');
const STORE_PATH = path.join(STORE_DIR, 'doctor-store.json');

const defaultData: DoctorStoreData = {
  doctors: [],
  sessions: [],
  analyses: [],
};

async function readStore(): Promise<DoctorStoreData> {
  await fs.mkdir(STORE_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as DoctorStoreData;
    return {
      doctors: Array.isArray(parsed.doctors) ? parsed.doctors : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      analyses: Array.isArray(parsed.analyses) ? parsed.analyses : [],
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

export async function registerDoctor(input: {
  fullName: string;
  email: string;
  password: string;
  hospital: string;
  specialty: string;
  phone: string;
}) {
  const fullName = sanitizeString(input.fullName);
  const email = sanitizeString(input.email).toLowerCase();
  const password = sanitizeString(input.password);
  const hospital = sanitizeString(input.hospital);
  const specialty = sanitizeString(input.specialty);
  const phone = sanitizeString(input.phone);

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
    createdAt: now,
    updatedAt: now,
  };

  const token = crypto.randomUUID();
  store.doctors.push(doctor);
  store.sessions.push({ id: crypto.randomUUID(), doctorId: doctor.id, token, createdAt: now });
  await writeStore(store);

  return { doctor, token };
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
  await writeStore(store);

  return { doctor, token };
}

export async function getDoctorFromToken(token: string) {
  const store = await readStore();
  const session = store.sessions.find((entry) => entry.token === token);
  if (!session) {
    return null;
  }
  const doctor = store.doctors.find((entry) => entry.id === session.doctorId);
  return doctor ?? null;
}

export async function updateDoctor(doctorId: string, updates: Partial<DoctorRecord> & { password?: string }) {
  const store = await readStore();
  const doctor = store.doctors.find((entry) => entry.id === doctorId);
  if (!doctor) {
    throw new Error('Doctor profile not found.');
  }

  const nextDoctor: DoctorRecord = {
    ...doctor,
    ...updates,
    id: doctor.id,
    email: (updates.email ?? doctor.email).toLowerCase(),
    passwordHash: updates.password ? hashPassword(updates.password) : doctor.passwordHash,
    updatedAt: new Date().toISOString(),
  };

  store.doctors = store.doctors.map((entry) => (entry.id === doctorId ? nextDoctor : entry));
  await writeStore(store);
  return nextDoctor;
}

export async function deleteDoctor(doctorId: string) {
  const store = await readStore();
  store.doctors = store.doctors.filter((doctor) => doctor.id !== doctorId);
  store.sessions = store.sessions.filter((session) => session.doctorId !== doctorId);
  store.analyses = store.analyses.filter((analysis) => analysis.doctorId !== doctorId);
  await writeStore(store);
}

export async function saveDoctorAnalysis(doctorId: string, payload: Omit<SavedAnalysis, 'id' | 'doctorId' | 'createdAt' | 'updatedAt'>) {
  const store = await readStore();
  const now = new Date().toISOString();
  const analysis: SavedAnalysis = {
    id: crypto.randomUUID(),
    doctorId,
    ...payload,
    createdAt: now,
    updatedAt: now,
  };

  store.analyses.push(analysis);
  await writeStore(store);
  return analysis;
}

export async function listDoctorAnalyses(doctorId: string) {
  const store = await readStore();
  return store.analyses.filter((analysis) => analysis.doctorId === doctorId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
