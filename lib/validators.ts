/**
 * Field validation shared by client forms and the server-side store. The
 * server-side calls are authoritative — client-side use is just fast feedback.
 */

const NAME_PATTERN = /^[A-Za-zÀ-ÖØ-öø-ÿ]+(?:[ '-][A-Za-zÀ-ÖØ-öø-ÿ]+)*$/;
const LOCAL_PART_PATTERN = /^[A-Za-z0-9._-]+$/;
const DOMAIN_PATTERN = /^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
const PATIENT_ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I — easy to misread on paper charts

export const MAX_PERSON_NAME_LENGTH = 100;
export const PATIENT_ID_LENGTH = 8;

/**
 * Local part ≤ 64 chars, total ≤ 320, single "@", no whitespace, no leading/
 * trailing/consecutive dots in the local part, domain has a valid TLD.
 */
export function isValidEmail(email: string): boolean {
  const value = (email ?? '').trim();
  if (!value || value.length > 320 || /\s/.test(value)) return false;

  const atIndex = value.indexOf('@');
  if (atIndex === -1 || value.indexOf('@', atIndex + 1) !== -1) return false;

  const local = value.slice(0, atIndex);
  const domain = value.slice(atIndex + 1);

  if (!local || local.length > 64) return false;
  if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false;
  if (!LOCAL_PART_PATTERN.test(local)) return false;

  if (!domain || domain.startsWith('.') || domain.endsWith('.') || domain.includes('..')) return false;
  if (!DOMAIN_PATTERN.test(domain)) return false;

  return true;
}

/** Letters only (spaces/hyphens/apostrophes allowed for compound names), ≤ 100 chars. */
export function isValidPersonName(name: string): boolean {
  const value = (name ?? '').trim();
  if (!value || value.length > MAX_PERSON_NAME_LENGTH) return false;
  return NAME_PATTERN.test(value);
}

/** Phone is optional; when present it must be exactly 8 digits (the Tunisian local number, without +216). */
export function isValidTunisianPhone(phone: string): boolean {
  const value = (phone ?? '').trim();
  if (!value) return true;
  return /^\d{8}$/.test(value);
}

/** A date of birth must be a real calendar date and cannot be in the future. */
export function isValidDateOfBirth(value: string): boolean {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return false;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() <= Date.now();
}

/** 8-character, unambiguous, collision-checked patient identifier. */
export function generatePatientId(existingIds: Iterable<string>): string {
  const existing = new Set(existingIds);
  let id = '';
  do {
    id = Array.from({ length: PATIENT_ID_LENGTH }, () => PATIENT_ID_CHARS[Math.floor(Math.random() * PATIENT_ID_CHARS.length)]).join('');
  } while (existing.has(id));
  return id;
}
