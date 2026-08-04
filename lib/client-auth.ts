export const DOCTOR_TOKEN_STORAGE_KEY = 'cervitrust-doctor-token';

export function getStoredDoctorToken() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(DOCTOR_TOKEN_STORAGE_KEY);
}

export function setStoredDoctorToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (!token) {
    window.localStorage.removeItem(DOCTOR_TOKEN_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(DOCTOR_TOKEN_STORAGE_KEY, token);
}
