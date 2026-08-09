'use client';

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { Camera, Check, KeyRound, Loader2, LogOut, Pencil, Trash2, X } from 'lucide-react';
import { Avatar } from '@/components/avatar';
import { getStoredDoctorToken } from '@/lib/client-auth';
import type { DoctorProfile } from '@/lib/analysis-types';

const FIELD =
  'w-full rounded-lg border border-border bg-white px-3 py-2.5 text-foreground placeholder:text-foreground/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/**
 * Squares and shrinks the picked image before upload — the profile store is a
 * JSON file, so a 4 MB camera photo would never fit as a data URL.
 */
function resizeToDataUrl(file: File, size = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('This image could not be read.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('This file is not a valid image.'));
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('Your browser could not process this image.'));
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
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/50 p-4">
      <div className="my-8 w-full max-w-lg rounded-xl border border-border bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-foreground/60 hover:bg-secondary hover:text-foreground" aria-label="Close">
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
  const [profile, setProfile] = useState(doctor);
  const [editing, setEditing] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    fullName: doctor.fullName,
    email: doctor.email,
    hospital: doctor.hospital,
    specialty: doctor.specialty,
    phone: doctor.phone,
  });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });

  useEffect(() => {
    setProfile(doctor);
    setForm({
      fullName: doctor.fullName,
      email: doctor.email,
      hospital: doctor.hospital,
      specialty: doctor.specialty,
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
    if (!res.ok) throw new Error(data.error || 'Update failed');
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
      if (!file.type.startsWith('image/')) throw new Error('Choose an image file (PNG, JPG…).');
      if (file.size > MAX_UPLOAD_BYTES) throw new Error('That image is larger than 8 MB. Choose a smaller one.');

      const avatar = await resizeToDataUrl(file);
      await patchProfile({ avatar });
      setFeedback({ tone: 'success', text: 'Profile picture updated.' });
    } catch (error) {
      setFeedback({ tone: 'error', text: error instanceof Error ? error.message : 'Upload failed' });
    } finally {
      setAvatarBusy(false);
    }
  }

  async function removeAvatar() {
    setAvatarBusy(true);
    setFeedback(null);
    try {
      await patchProfile({ avatar: '' });
      setFeedback({ tone: 'success', text: 'Profile picture removed.' });
    } catch (error) {
      setFeedback({ tone: 'error', text: error instanceof Error ? error.message : 'Update failed' });
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
      setFeedback({ tone: 'success', text: 'Profile updated.' });
    } catch (error) {
      setFeedback({ tone: 'error', text: error instanceof Error ? error.message : 'Update failed' });
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
        throw new Error('The two new passwords do not match.');
      }
      await patchProfile({ currentPassword: passwordForm.currentPassword, password: passwordForm.newPassword });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setChangingPassword(false);
      setFeedback({ tone: 'success', text: 'Password changed.' });
    } catch (error) {
      setFeedback({ tone: 'error', text: error instanceof Error ? error.message : 'Update failed' });
    } finally {
      setLoading(false);
    }
  }

  async function deleteProfile() {
    setLoading(true);
    try {
      const token = getStoredDoctorToken();
      const res = await fetch('/api/doctor', { method: 'DELETE', headers: { 'x-doctor-token': token ?? '' } });
      if (!res.ok) throw new Error('Unable to delete account');
      onLogout?.();
    } catch (error) {
      setFeedback({ tone: 'error', text: error instanceof Error ? error.message : 'Delete failed' });
      setLoading(false);
      setConfirmingDelete(false);
    }
  }

  const details = [
    { label: 'Email', value: profile.email },
    { label: 'Hospital or laboratory', value: profile.hospital || 'Not provided' },
    { label: 'Specialty', value: profile.specialty || 'Not provided' },
    { label: 'Phone', value: profile.phone || 'Not provided' },
    { label: 'Member since', value: new Date(profile.createdAt).toLocaleDateString() },
    { label: 'Last updated', value: new Date(profile.updatedAt).toLocaleDateString() },
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
                  aria-label="Change profile picture"
                  title="Change profile picture"
                >
                  {avatarBusy ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />}
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              </div>

              <div className="pb-1">
                <h2 className="text-2xl font-semibold text-foreground">{profile.fullName}</h2>
                <p className="text-sm text-foreground/60">
                  {profile.role === 'admin' ? 'Administrator' : 'Doctor / Biologist'}
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
                <Pencil size={15} /> Edit profile
              </button>
              <button
                type="button"
                onClick={onLogout}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground/80 hover:bg-secondary"
              >
                <LogOut size={15} /> Sign out
              </button>
            </div>
          </div>

          {profile.avatar ? (
            <button type="button" onClick={removeAvatar} disabled={avatarBusy} className="mt-3 text-xs text-foreground/60 hover:text-destructive disabled:opacity-60">
              Remove profile picture
            </button>
          ) : (
            <p className="mt-3 text-xs text-foreground/60">Add a profile picture so colleagues recognise your reports.</p>
          )}

          {feedback ? <div className="mt-4">
            <Toast tone={feedback.tone}>{feedback.text}</Toast>
          </div> : null}
        </div>
      </div>

      {/* Details */}
      <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-foreground">Account details</h3>
        <p className="text-sm text-foreground/60">These details appear on the reports you sign.</p>

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
            <h3 className="text-lg font-semibold text-foreground">Password and security</h3>
            <p className="text-sm text-foreground/60">Your current password is required to set a new one.</p>
          </div>
          <button
            type="button"
            onClick={() => setChangingPassword(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground/80 hover:bg-secondary"
          >
            <KeyRound size={15} /> Change password
          </button>
        </div>
      </div>

      {/* Danger zone */}
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Delete account</h3>
            <p className="text-sm text-foreground/70">Removes your account and every report you saved. This cannot be undone.</p>
          </div>
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-destructive/40 bg-white px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
          >
            <Trash2 size={15} /> Delete account
          </button>
        </div>
      </div>

      {/* Edit modal */}
      {editing ? (
        <Modal title="Edit profile" onClose={() => setEditing(false)}>
          <form onSubmit={saveDetails} className="space-y-4">
            {[
              { key: 'fullName' as const, label: 'Full name', type: 'text', required: true },
              { key: 'email' as const, label: 'Email', type: 'email', required: true },
              { key: 'hospital' as const, label: 'Hospital or laboratory', type: 'text', required: false },
              { key: 'specialty' as const, label: 'Specialty', type: 'text', required: false },
              { key: 'phone' as const, label: 'Phone', type: 'tel', required: false },
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

            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground/80 hover:bg-secondary">
                Cancel
              </button>
              <button type="submit" disabled={loading} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-60">
                {loading ? <Loader2 size={15} className="animate-spin" /> : null} Save changes
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {/* Password modal */}
      {changingPassword ? (
        <Modal title="Change password" onClose={() => setChangingPassword(false)}>
          <form onSubmit={savePassword} className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-foreground">Current password</span>
              <input className={FIELD} type="password" autoComplete="current-password" required value={passwordForm.currentPassword} onChange={(event) => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-foreground">New password</span>
              <input className={FIELD} type="password" autoComplete="new-password" required minLength={8} value={passwordForm.newPassword} onChange={(event) => setPasswordForm({ ...passwordForm, newPassword: event.target.value })} />
              <span className="mt-1 block text-xs text-foreground/60">At least 8 characters.</span>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-foreground">Confirm new password</span>
              <input className={FIELD} type="password" autoComplete="new-password" required value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm({ ...passwordForm, confirmPassword: event.target.value })} />
            </label>

            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <button type="button" onClick={() => setChangingPassword(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground/80 hover:bg-secondary">
                Cancel
              </button>
              <button type="submit" disabled={loading} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-60">
                {loading ? <Loader2 size={15} className="animate-spin" /> : null} Update password
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {/* Delete confirmation */}
      {confirmingDelete ? (
        <Modal title="Delete your account?" onClose={() => setConfirmingDelete(false)}>
          <p className="text-sm text-foreground/80">
            This permanently removes your account, your saved reports and every review decision attached to them.
          </p>
          <div className="mt-5 flex justify-end gap-2 border-t border-border pt-4">
            <button type="button" onClick={() => setConfirmingDelete(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground/80 hover:bg-secondary">
              Keep my account
            </button>
            <button type="button" onClick={deleteProfile} disabled={loading} className="inline-flex items-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-white hover:bg-destructive/90 disabled:opacity-60">
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />} Delete permanently
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
