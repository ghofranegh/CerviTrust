'use client';

import { ChangeEvent, useEffect, useState } from 'react';
import { Camera, Pencil, Trash2, UserCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getStoredDoctorToken, setStoredDoctorToken } from '@/lib/client-auth';

import type { DoctorProfile } from '@/lib/analysis-types';

export function DoctorProfilePanel({ doctor, onLogout }: { doctor: DoctorProfile; onLogout?: () => void }) {
  const [profile, setProfile] = useState(doctor);
  const [isEditing, setIsEditing] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [form, setForm] = useState({
    fullName: doctor.fullName,
    email: doctor.email,
    hospital: doctor.hospital,
    specialty: doctor.specialty,
    phone: doctor.phone,
    currentPassword: '',
    newPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setProfile(doctor);
    setAvatarPreview(null);
    setForm({
      fullName: doctor.fullName,
      email: doctor.email,
      hospital: doctor.hospital,
      specialty: doctor.specialty,
      phone: doctor.phone,
      currentPassword: '',
      newPassword: '',
    });
  }, [doctor]);

  function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setAvatarPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }

  async function saveProfile() {
    setLoading(true);
    setMessage('');
    try {
      if (form.newPassword && !form.currentPassword) {
        throw new Error('Enter your current password before changing it.');
      }

      const token = getStoredDoctorToken();
      const res = await fetch('/api/doctor', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-doctor-token': token ?? '',
        },
        body: JSON.stringify({
          fullName: form.fullName,
          email: form.email,
          hospital: form.hospital,
          specialty: form.specialty,
          phone: form.phone,
          currentPassword: form.currentPassword || undefined,
          password: form.newPassword || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');
      setProfile(data.doctor);
      setIsEditing(false);
      setForm((current) => ({ ...current, currentPassword: '', newPassword: '' }));
      setAvatarPreview(null);
      setMessage('Profile updated successfully.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Update failed');
    } finally {
      setLoading(false);
    }
  }

  async function deleteProfile() {
    const confirmed = window.confirm('Delete your doctor account and all saved analyses?');
    if (!confirmed) return;
    setLoading(true);
    try {
      const token = getStoredDoctorToken();
      const res = await fetch('/api/doctor', {
        method: 'DELETE',
        headers: { 'x-doctor-token': token ?? '' },
      });
      if (!res.ok) throw new Error('Unable to delete account');
      setStoredDoctorToken(null);
      onLogout?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Delete failed');
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-white p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Doctor profile</h3>
          <p className="text-sm text-foreground/60">Manage your account information, photo, and security settings.</p>
        </div>
        <Button variant="outline" onClick={() => { setStoredDoctorToken(null); onLogout?.(); }}>
          Sign out
        </Button>
      </div>

      <div className="flex flex-col gap-4 rounded-lg border border-border bg-secondary/20 p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          {avatarPreview ? (
            <img src={avatarPreview} alt="Doctor avatar preview" className="h-16 w-16 rounded-full object-cover" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-border bg-white text-foreground/70">
              <UserCircle2 size={32} />
            </div>
          )}
          <div>
            <p className="font-semibold text-foreground">{profile.fullName}</p>
            <p className="text-sm text-foreground/60">{profile.hospital || 'Hospital not provided'}</p>
            <span className="mt-1 inline-flex rounded-md border border-border bg-white px-2 py-0.5 text-xs text-foreground/70">
              {profile.role === 'admin' ? 'Administrator' : 'Doctor / Biologist'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground/80">
            <Camera size={16} />
            Add photo
            <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </label>
          <Button variant="outline" onClick={() => setIsEditing(true)}>
            <Pencil size={16} className="mr-2" /> Edit
          </Button>
          <Button variant="outline" onClick={deleteProfile} disabled={loading}>
            <Trash2 size={16} className="mr-2" /> Delete
          </Button>
        </div>
      </div>

      {message ? <p className="text-sm text-foreground/70">{message}</p> : null}

      {isEditing ? (
        <div className="space-y-4 rounded-lg border border-border p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <input className="rounded-lg border border-border px-3 py-2" value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} placeholder="Full name" />
            <input className="rounded-lg border border-border px-3 py-2" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="Email" />
            <input className="rounded-lg border border-border px-3 py-2" value={form.hospital} onChange={(event) => setForm({ ...form, hospital: event.target.value })} placeholder="Hospital" />
            <input className="rounded-lg border border-border px-3 py-2" value={form.specialty} onChange={(event) => setForm({ ...form, specialty: event.target.value })} placeholder="Specialty" />
            <input className="rounded-lg border border-border px-3 py-2" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="Phone" />
          </div>

          <div className="rounded-lg border border-border bg-secondary/20 p-3 space-y-3">
            <p className="text-sm font-medium text-foreground">Change password</p>
            <input className="w-full rounded-lg border border-border px-3 py-2" type="password" value={form.currentPassword} onChange={(event) => setForm({ ...form, currentPassword: event.target.value })} placeholder="Current password" />
            <input className="w-full rounded-lg border border-border px-3 py-2" type="password" value={form.newPassword} onChange={(event) => setForm({ ...form, newPassword: event.target.value })} placeholder="New password" />
            <p className="text-xs text-foreground/60">You must enter your current password before setting a new one.</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={saveProfile} disabled={loading}>{loading ? 'Saving…' : 'Save changes'}</Button>
            <Button variant="outline" onClick={() => setIsEditing(false)} disabled={loading}>Cancel</Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-border bg-secondary/20 p-3">
            <p className="text-sm text-foreground/60">Full name</p>
            <p className="font-medium text-foreground">{profile.fullName}</p>
          </div>
          <div className="rounded-lg border border-border bg-secondary/20 p-3">
            <p className="text-sm text-foreground/60">Email</p>
            <p className="font-medium text-foreground">{profile.email}</p>
          </div>
          <div className="rounded-lg border border-border bg-secondary/20 p-3">
            <p className="text-sm text-foreground/60">Hospital</p>
            <p className="font-medium text-foreground">{profile.hospital || 'Not provided'}</p>
          </div>
          <div className="rounded-lg border border-border bg-secondary/20 p-3">
            <p className="text-sm text-foreground/60">Specialty</p>
            <p className="font-medium text-foreground">{profile.specialty || 'Not provided'}</p>
          </div>
          <div className="rounded-lg border border-border bg-secondary/20 p-3">
            <p className="text-sm text-foreground/60">Phone</p>
            <p className="font-medium text-foreground">{profile.phone || 'Not provided'}</p>
          </div>
        </div>
      )}
    </div>
  );
}
