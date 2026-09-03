'use client';

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { Camera, Check, KeyRound, Loader2, LogOut, Pencil, X } from 'lucide-react';
import { Avatar } from '@/components/avatar';
import { getStoredDoctorToken } from '@/lib/client-auth';
import { translateError, useTranslation, type TranslationKey } from '@/lib/i18n';
import { personName, professionalTitleLabel, specialtyLabel, specialtyOptions, type DoctorProfile, type Specialty } from '@/lib/analysis-types';


const FIELD =
  'w-full rounded-lg border border-border bg-white px-3 py-2.5 text-foreground placeholder:text-foreground/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/**
 * Squares and shrinks the picked image before upload — the profile store is a
 * JSON file, so a 4 MB camera photo would never fit as a data URL.
 */
function resizeToDataUrl(file: File, t: (key: TranslationKey) => string, size = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(t('profile.imageUnreadable')));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error(t('profile.invalidImage')));
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error(t('profile.canvasError')));
          return;
        }
        // Cover-crop: take the largest centred square, then scale it down.
        const edge = Math.min(image.naturalWidth, image.naturalHeight);
        const sx = (image.naturalWidth - edge) / 2;
        const sy = (image.naturalHeight - edge) / 2;
        context.drawImage(image, sx, sy, edge, edge, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      image.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function Toast({ tone, children }: { tone: 'success' | 'error'; children: React.ReactNode }) {
  return (
    <p
      role="status"
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
        tone === 'success'
          ? 'border-status-success/30 bg-status-success/10 text-status-success'
          : 'border-destructive/30 bg-destructive/5 text-destructive'
      }`}
    >
      {tone === 'success' ? <Check size={16} /> : <X size={16} />}
      {children}
    </p>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const { t } = useTranslation();
  const closeLabel = t('common.close');
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/50 p-4">
      <div className="my-8 w-full max-w-lg rounded-xl border border-border bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-foreground/60 hover:bg-secondary hover:text-foreground" aria-label={closeLabel}>
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

export function DoctorProfilePanel({
  doctor,
  onLogout,
  onUpdated,
}: {
  doctor: DoctorProfile;
  onLogout?: () => void;
  onUpdated?: (doctor: DoctorProfile) => void;
}) {
  const { t, language } = useTranslation();
  const [profile, setProfile] = useState(doctor);
  const [editing, setEditing] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    firstName: doctor.firstName,
    lastName: doctor.lastName,
    email: doctor.email,
    hospital: doctor.hospital,
    specialty: doctor.specialty,
    department: doctor.department,
    phone: doctor.phone,
  });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });

  useEffect(() => {
    setProfile(doctor);
    setForm({
      firstName: doctor.firstName,
      lastName: doctor.lastName,
      email: doctor.email,
      hospital: doctor.hospital,
      specialty: doctor.specialty,
      department: doctor.department,
      phone: doctor.phone,
    });
  }, [doctor]);

  /** Single place that talks to PATCH /api/doctor. */
  async function patchProfile(body: Record<string, unknown>): Promise<DoctorProfile> {
    const token = getStoredDoctorToken();
    const res = await fetch('/api/doctor', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-doctor-token': token ?? '' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(translateError(data.error, t) || t('profile.updateFailed'));
    setProfile(data.doctor);
    onUpdated?.(data.doctor);
    return data.doctor;
  }

  async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;

    setFeedback(null);
    setAvatarBusy(true);
    try {
      if (!file.type.startsWith('image/')) throw new Error(t('profile.imageOnly'));
      if (file.size > MAX_UPLOAD_BYTES) throw new Error(t('profile.imageTooLarge'));

      const avatar = await resizeToDataUrl(file, t);
      await patchProfile({ avatar });
      setFeedback({ tone: 'success', text: t('profile.pictureUpdated') });
    } catch (error) {
      setFeedback({ tone: 'error', text: error instanceof Error ? error.message : t('profile.uploadFailed') });
    } finally {
      setAvatarBusy(false);
    }
  }

  async function removeAvatar() {
    setAvatarBusy(true);
    setFeedback(null);
    try {
      await patchProfile({ avatar: '' });
      setFeedback({ tone: 'success', text: t('profile.pictureRemoved') });
    } catch (error) {
      setFeedback({ tone: 'error', text: error instanceof Error ? error.message : t('profile.updateFailed') });
    } finally {
      setAvatarBusy(false);
    }
  }

  async function saveDetails(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setFeedback(null);
    try {
      await patchProfile(form);
      setEditing(false);
      setFeedback({ tone: 'success', text: t('profile.profileUpdated') });
    } catch (error) {
      setFeedback({ tone: 'error', text: error instanceof Error ? error.message : t('profile.updateFailed') });
    } finally {
      setLoading(false);
    }
  }

  async function savePassword(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setFeedback(null);
    try {
      if (passwordForm.newPassword !== passwordForm.confirmPassword) {
        throw new Error(t('profile.passwordMismatch'));
      }
      await patchProfile({ currentPassword: passwordForm.currentPassword, password: passwordForm.newPassword });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setChangingPassword(false);
      setFeedback({ tone: 'success', text: t('profile.passwordChanged') });
    } catch (error) {
      setFeedback({ tone: 'error', text: error instanceof Error ? error.message : t('profile.updateFailed') });
    } finally {
      setLoading(false);
    }
  }

  const details = [
    { label: t('profile.email'), value: profile.email },
    { label: t('auth.organization'), value: profile.hospital || t('common.notProvided') },
    ...(profile.role === 'doctor'
      ? [
          { label: t('profile.professionalTitle'), value: professionalTitleLabel(profile.professionalTitle, language) },
          { label: t('profile.specialty'), value: profile.specialty ? specialtyLabel(profile.specialty, language) : t('common.notProvided') },
          { label: t('profile.department'), value: profile.department || t('common.notProvided') },
        ]
      : []),
    { label: t('profile.phone'), value: profile.phone || t('common.notProvided') },
    { label: t('profile.memberSince'), value: new Date(profile.createdAt).toLocaleDateString() },
    { label: t('profile.lastUpdated'), value: new Date(profile.updatedAt).toLocaleDateString() },
  ];

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        <div className="h-28 bg-gradient-to-r from-primary to-accent" />

        <div className="px-6 pb-6">
          <div className="-mt-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-4">
              <div className="relative">
                <span className="block rounded-full border-4 border-white bg-white shadow-sm">
                  <Avatar doctor={profile} size={96} />
                </span>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={avatarBusy}
                  className="absolute bottom-1 right-1 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-white text-foreground/80 shadow-sm transition-colors hover:bg-secondary disabled:opacity-60"
                  aria-label={t('profile.changePicture')}
                  title={t('profile.changePicture')}
                >
                  {avatarBusy ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />}
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              </div>

              <div className="pb-1">
                <h2 className="text-2xl font-semibold text-foreground">{personName(profile)}</h2>
                <p className="text-sm text-foreground/60">
                  {profile.role === 'admin' ? t('profile.administrator') : professionalTitleLabel(profile.professionalTitle, language)}
                  {profile.hospital ? ` · ${profile.hospital}` : ''}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
              >
                <Pencil size={15} /> {t('profile.editProfile')}
              </button>
              <button
                type="button"
                onClick={onLogout}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground/80 hover:bg-secondary"
              >
                <LogOut size={15} /> {t('nav.signOut')}
              </button>
            </div>
          </div>

          {profile.avatar ? (
            <button type="button" onClick={removeAvatar} disabled={avatarBusy} className="mt-3 text-xs text-foreground/60 hover:text-destructive disabled:opacity-60">
              {t('profile.removePicture')}
            </button>
          ) : (
            <p className="mt-3 text-xs text-foreground/60">{t('profile.addPicture')}</p>
          )}

          {feedback ? <div className="mt-4">
            <Toast tone={feedback.tone}>{feedback.text}</Toast>
          </div> : null}
        </div>
      </div>

      {/* Details */}
      <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-foreground">{t('profile.accountDetails')}</h3>
        <p className="text-sm text-foreground/60">{t('profile.accountDetailsSubtitle')}</p>

        <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
          {details.map((item) => (
            <div key={item.label} className="border-b border-border pb-3 last:border-0 sm:last:border-b">
              <dt className="text-xs font-semibold uppercase tracking-wide text-foreground/60">{item.label}</dt>
              <dd className="mt-0.5 font-medium text-foreground break-words">{item.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Security */}
      <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-foreground">{t('profile.passwordSecurity')}</h3>
            <p className="text-sm text-foreground/60">{t('profile.passwordSecuritySubtitle')}</p>
          </div>
          <button
            type="button"
            onClick={() => setChangingPassword(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground/80 hover:bg-secondary"
          >
            <KeyRound size={15} /> {t('profile.changePassword')}
          </button>
        </div>
        <p className="mt-4 border-t border-border pt-4 text-xs text-foreground/50">{t('profile.deleteNote')}</p>
      </div>

      {/* Edit modal */}
      {editing ? (
        <Modal title={t('profile.editProfile')} onClose={() => setEditing(false)}>
          <form onSubmit={saveDetails} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-foreground">{t('auth.firstName')}</span>
                <input
                  className={FIELD}
                  type="text"
                  required
                  maxLength={100}
                  value={form.firstName}
                  onChange={(event) => setForm({ ...form, firstName: event.target.value })}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-foreground">{t('auth.lastName')}</span>
                <input
                  className={FIELD}
                  type="text"
                  required
                  maxLength={100}
                  value={form.lastName}
                  onChange={(event) => setForm({ ...form, lastName: event.target.value })}
                />
              </label>
            </div>
            {[
              { key: 'email' as const, label: t('auth.email'), type: 'email', required: true },
              { key: 'hospital' as const, label: t('auth.organization'), type: 'text', required: false },
            ].map((field) => (
              <label key={field.key} className="block">
                <span className="mb-1 block text-sm font-medium text-foreground">{field.label}</span>
                <input
                  className={FIELD}
                  type={field.type}
                  required={field.required}
                  value={form[field.key]}
                  onChange={(event) => setForm({ ...form, [field.key]: event.target.value })}
                />
              </label>
            ))}
            {profile.role === 'doctor' ? (
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-foreground">{t('profile.specialty')}</span>
                  <select
                    className={FIELD}
                    required
                    value={form.specialty}
                    onChange={(event) => setForm({ ...form, specialty: event.target.value as Specialty })}
                  >
                    <option value="" disabled>
                      {t('admin.chooseSpecialty')}
                    </option>
                    {specialtyOptions(language).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-foreground">{t('profile.department')}</span>
                  <input className={FIELD} type="text" value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} />
                </label>
              </div>
            ) : null}
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-foreground">{t('profile.phone')}</span>
              <div className="flex items-stretch overflow-hidden rounded-lg border border-border bg-white focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
                <span className="flex items-center bg-secondary px-3 text-sm text-foreground/50">+216</span>
                <input
                  className="w-full min-w-0 flex-1 px-3 py-2.5 text-foreground focus:outline-none"
                  type="tel"
                  inputMode="numeric"
                  maxLength={8}
                  value={form.phone}
                  onChange={(event) => setForm({ ...form, phone: event.target.value.replace(/\D/g, '').slice(0, 8) })}
                />
              </div>
            </label>

            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground/80 hover:bg-secondary">
                {t('common.cancel')}
              </button>
              <button type="submit" disabled={loading} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-60">
                {loading ? <Loader2 size={15} className="animate-spin" /> : null} {t('profile.saveChanges')}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {/* Password modal */}
      {changingPassword ? (
        <Modal title={t('profile.changePassword')} onClose={() => setChangingPassword(false)}>
          <form onSubmit={savePassword} className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-foreground">{t('profile.currentPassword')}</span>
              <input className={FIELD} type="password" autoComplete="current-password" required value={passwordForm.currentPassword} onChange={(event) => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-foreground">{t('reset.newPassword')}</span>
              <input className={FIELD} type="password" autoComplete="new-password" required minLength={8} value={passwordForm.newPassword} onChange={(event) => setPasswordForm({ ...passwordForm, newPassword: event.target.value })} />
              <span className="mt-1 block text-xs text-foreground/60">{t('profile.atLeast8')}</span>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-foreground">{t('reset.confirmNewPassword')}</span>
              <input className={FIELD} type="password" autoComplete="new-password" required value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm({ ...passwordForm, confirmPassword: event.target.value })} />
            </label>

            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <button type="button" onClick={() => setChangingPassword(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground/80 hover:bg-secondary">
                {t('common.cancel')}
              </button>
              <button type="submit" disabled={loading} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-60">
                {loading ? <Loader2 size={15} className="animate-spin" /> : null} {t('profile.updatePassword')}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
