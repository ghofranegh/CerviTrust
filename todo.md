# CerviTrust — Project Notes & Change Log

A complete reference for this codebase: what CerviTrust is, how it's built, where every
feature lives, and everything that's been changed in it so far. Written as one document
so it can be handed to anyone (including future-you) without re-reading the whole repo.

---

## 1. What CerviTrust is

CerviTrust is an AI-assisted cervical cytology (Pap smear) screening platform for
pathology practitioners. A doctor uploads a microscope image of a cervical cytology
sample; a machine-learning backend segments the individual cells, classifies each one on
the Bethesda System scale (NILM, ASC-US, LSIL, ASC-H, AGC, HSIL, SCC), scores image
quality, and produces an explainability heatmap (Grad-CAM). The doctor reviews the
flagged cells, writes findings/recommendations, and saves a report tied to a patient. An
administrator role oversees the platform: managing accounts, watching service health, and
validating reports before they're considered final.

It is explicitly a **clinical decision-support tool**, not an autonomous diagnostic
system — every screen says so, and a human practitioner always has the final word.

---

## 2. Architecture, in one picture

```
┌─────────────────────────────┐         ┌──────────────────────────────┐
│   Next.js 16 (App Router)    │  HTTP   │   FastAPI (Python) backend    │
│   React 19 + TypeScript      │ ──────▶ │   main.py + utils/api.py      │
│   Tailwind v4, red/white     │  JSON   │   PyTorch model + OpenCV      │
│   theme                      │ ◀────── │   classification, segmentation,│
└──────────────┬───────────────┘         │   quality scoring, Grad-CAM   │
               │                          └──────────────────────────────┘
               │ reads/writes
               ▼
   data/doctor-store.json   (single JSON file — the entire "database")
   data/backups/            (automatic rotating backups, last 30)
```

- **Frontend**: Next.js 16 App Router, React 19, TypeScript, Tailwind v4, shadcn
  components. All pages are Client Components (`'use client'`) because the app is
  session- and language-driven throughout.
- **Backend**: a separate FastAPI Python process (`main.py`, run with `uvicorn`) that
  does the actual image inference. The Next.js app never talks to the model directly —
  it proxies through `app/api/analyze/route.ts`.
- **Database**: there is no SQL database. Everything (doctor/admin accounts, patients,
  saved reports, audit log) lives in one JSON file, `data/doctor-store.json`, read and
  written by `lib/doctor-store.ts`. This was a deliberate simplicity choice for the
  project's scale; see §7 for the hardening that was added around it after a data-loss
  incident.
- **Email**: outbound mail (password resets, account-created notices, report-validated
  notices) goes through a generic SMTP transport (`lib/mailer.ts`) so it works with
  Gmail, Outlook, SendGrid, Resend, or Mailtrap — no vendor lock-in. If SMTP env vars
  aren't set, it just logs a warning and no-ops, so mail is never a hard dependency.

---

## 3. Folder map — what each file is for

### `app/` — pages (Next.js App Router, one folder per route)

| Path | What it renders |
|---|---|
| `app/layout.tsx` | Root HTML shell, fonts, page `<title>`/`<meta>` (site-wide, English-only — see §9 for why) |
| `app/page.tsx` | Home route `/`. For a signed-in doctor: the **patient roster**. For a signed-in admin: redirects to `/admin`. For a signed-out visitor: the sign-in landing. |
| `app/analysis/page.tsx` | `/analysis` — the image-upload + AI screening workspace. Doctor-only. |
| `app/dashboard/page.tsx` | `/dashboard` — a practitioner's personal analytics (report counts, class distribution, activity trend). Doctor-only. |
| `app/saved-reports/page.tsx` | `/saved-reports` — the practitioner's saved report list. Doctor-only. |
| `app/doctor/page.tsx` | `/doctor` — "my account" page, wraps `DoctorProfilePanel`. |
| `app/admin/page.tsx` | `/admin` — the administration console (platform stats, account management, report validation, service health). Admin-only. Biggest single page in the app. |
| `app/forgot-password/page.tsx` | Request a password-reset email. |
| `app/reset-password/page.tsx` | Set a new password from the emailed link (`?token=`). |
| `app/about/page.tsx` | Static "About CerviTrust" marketing/info page. |
| `app/system/page.tsx` | Static "System Overview" page — explains the Bethesda classes, the screening pipeline, and the clinical disclaimer. |

### `app/api/` — backend-for-frontend routes (Next.js Route Handlers)

| Route | Methods | Purpose |
|---|---|---|
| `api/auth/bootstrap-status` | GET | Tells the client whether the platform has zero accounts yet (first-run signup allowed). |
| `api/auth/signup` | POST | Creates the **very first** admin account. Refuses once any account exists. |
| `api/auth/login` | POST | Signs in; tries every account sharing that email until a password matches (see §6). |
| `api/auth/me` | GET | Resolves the current session token to a doctor profile. |
| `api/auth/forgot-password` | POST | Triggers a password-reset email (always a generic response — no account enumeration). |
| `api/auth/reset-password` | POST | Consumes a reset token, sets a new password. |
| `api/doctor` | GET, PATCH | Read/update the signed-in user's own profile (name, avatar, password, etc.). |
| `api/patients` | GET, POST | List/create the signed-in doctor's patients. |
| `api/patients/[id]` | GET, PATCH | Read/update one patient. |
| `api/analyze` | POST | Proxies an uploaded image to the FastAPI `/predict` endpoint and returns the AI result. |
| `api/analyses` | GET, POST | List / save the signed-in doctor's reports. |
| `api/analyses/[id]` | GET, PATCH, DELETE | Read/update/delete one report (owner or admin). |
| `api/admin/stats` | GET | Platform-wide statistics for the admin dashboard. |
| `api/admin/accounts` | POST | Admin creates a new doctor or admin account. |
| `api/admin/accounts/[id]` | PATCH, DELETE | Admin activates/deactivates/changes role, or deletes an account. |

### `components/` — UI building blocks

| File | Role |
|---|---|
| `navigation.tsx` | Top navbar: logo, links (role-aware), avatar menu, language toggle, mobile menu. |
| `footer.tsx` | Site footer. |
| `auth-landing.tsx` | The sign-in card shown to signed-out visitors. |
| `auth-gate.tsx` | Wraps any page that needs a session; shows the landing page if signed out, an "access denied" screen if the wrong role, otherwise renders its children. Used by every protected page. |
| `doctor-auth-panel.tsx` | The actual sign-in form (and first-run bootstrap-signup form). |
| `doctor-profile-panel.tsx` | "My account" — avatar upload, edit details, change password. |
| `avatar.tsx` | Small avatar image/initials component. |
| `patient-roster.tsx` | Doctor's home page: searchable/sortable patient list + "Add patient" form. |
| `patient-picker.tsx` | Attach-existing-or-register-new-patient widget used inside the analysis Report tab. |
| `patient-overview-modal.tsx` | Per-patient mini dashboard popup (report count, class distribution, report list). |
| `image-analyzer.tsx` | **The core screening workspace.** Upload, tabs (Overview/Quality/Segmentation/Review/Report), save/update report. The biggest component in the app. |
| `analysis-results.tsx` | "Overview" tab — headline classification, confidence, calibrated uncertainty. |
| `quality-control-panel.tsx` | "Quality" tab — sharpness/contrast/exposure/staining/cellularity sub-scores. |
| `segmentation-viewer.tsx` | "Segmentation" tab — image with detected-cell overlay, instance strip, per-instance detail. |
| `cell-review-table.tsx` | "Targeted review" tab — table of flagged cells the doctor confirms/corrects/flags. |
| `cell-zoom-modal.tsx` | Popup that zooms a single cell crop in place (used instead of jumping tabs). |
| `report-preview.tsx` | "Report" tab — on-screen editable report builder (findings, recommendation, status). |
| `report-document.tsx` | Print-only formatted clinical document — what "Export as PDF" actually renders. |
| `saved-analyses-list.tsx` | The saved-reports table/list, grouped by patient, with a report-detail modal (edit/delete/status). |
| `charts.tsx` | Reusable chart primitives: `DonutChart`, `StatTile`, `TrendChart`, `BarDistribution`. |
| `status-badge.tsx`, `feature-card.tsx`, `medical-card.tsx` | Small presentational pieces used on marketing/status pages. |
| `language-toggle.tsx` | The EN | FR switch in the navbar. |
| `ui/button.tsx` | shadcn base button primitive. |

### `lib/` — logic, not UI

| File | Role |
|---|---|
| `doctor-store.ts` | **The entire backend data layer.** Reads/writes `data/doctor-store.json`, and exposes every server-side operation (accounts, patients, reports, sessions, audit log). See §8 for the full function list. |
| `analysis-types.ts` | Shared TypeScript types for the AI result shape, plus every "turn this enum into a human label" function (priority, quality, severity, Bethesda class, specialty, etc.) — each accepts a `lang` argument so the same function serves both languages. |
| `report-utils.ts` | Small helpers for the `PatientInfo` shape used while building a report client-side (display name, missing-fields check, age calculation). |
| `validators.ts` | Field validation: email, person name, Tunisian phone (8 digits), date of birth, patient-ID generator. Used both server-side (authoritative) and client-side (fast feedback). |
| `client-auth.ts` | Reads/writes the doctor session token in `localStorage`. |
| `use-doctor-session.ts` | Module-singleton hook exposing "who's signed in" to every component, kept in sync across tabs/navigation via a custom `window` event. |
| `use-analysis-session.ts` | Same module-singleton pattern, but for an **in-progress analysis** — so uploading an image, then navigating to the patient roster and back, doesn't lose your work. |
| `use-language.ts` | Same pattern again, for the EN/FR language preference (persisted to `localStorage`). |
| `i18n.ts` | The translation dictionary and `useTranslation()` hook. See §9. |
| `mailer.ts` | Generic SMTP mail sender (Nodemailer), no-ops safely if unconfigured. |
| `email-templates.ts` | HTML email bodies: password reset, account created, report validated. Edit this file to change email wording/branding. |
| `utils.ts` | Misc small helpers (className merge, etc.) — shadcn boilerplate. |

### Python backend

| File | Role |
|---|---|
| `main.py` | FastAPI app. One route, `POST /predict`, takes an uploaded image and returns the full AI analysis JSON. |
| `utils/api.py` | All the actual computer-vision/ML logic: nucleus segmentation, per-cell classification, quality scoring, Grad-CAM, cropping. See §10. |
| `model_bundle/` | The trained model weights + `inference_config.json` (image size, class list, thresholds). |
| `requirements.txt` | Python dependencies. |

---

## 4. Website parts → exact files

- **Navbar**: `components/navigation.tsx` (rendered at the top of every page's `<main>`).
- **Footer**: `components/footer.tsx`.
- **Home page** (`/`): `app/page.tsx`, which renders `components/patient-roster.tsx` for a
  signed-in doctor, or `components/auth-landing.tsx` for a signed-out visitor.
- **Sign-in form**: `components/doctor-auth-panel.tsx`, shown inside
  `components/auth-landing.tsx`.
- **Logo**: `public/logo.png`, referenced from `navigation.tsx` and `auth-landing.tsx`.
- **Language switch (EN|FR)**: `components/language-toggle.tsx`, rendered inside the navbar.
- **The screening workspace** (`/analysis`): `app/analysis/page.tsx` →
  `components/image-analyzer.tsx`, which composes `analysis-results.tsx`,
  `quality-control-panel.tsx`, `segmentation-viewer.tsx`, `cell-review-table.tsx`, and
  `report-preview.tsx` as its five tabs.
- **Admin console** (`/admin`): entirely `app/admin/page.tsx` (one large file — stats
  cards, account table, report-validation table, service-health panel, "create account"
  modal all live here).
- **Saved reports** (`/saved-reports`): `app/saved-reports/page.tsx` →
  `components/saved-analyses-list.tsx`.
- **My account** (`/doctor`): `app/doctor/page.tsx` →
  `components/doctor-profile-panel.tsx`.

---

## 5. How the main workflows actually run

**Sign-in and routing by role**
`doctor-auth-panel.tsx` posts to `/api/auth/login` → `loginDoctor()` in
`lib/doctor-store.ts` → on success the app redirects admins to `/admin`, doctors to `/`.
Every protected page is wrapped in `<AuthGate>` (`components/auth-gate.tsx`), which
reads the session via `useDoctorSession()` and either shows the sign-in landing, an
"access denied" screen (wrong role), or the real page.

**Patient → analysis → report**
A doctor either clicks a patient row on the roster (`patient-roster.tsx`, which routes to
`/analysis?patientId=...`) or starts a blank analysis and uses `patient-picker.tsx` inside
the Report tab to attach/register a patient. Uploading an image posts to `/api/analyze`,
which proxies to the FastAPI `/predict` endpoint. The result populates all five tabs of
`image-analyzer.tsx`. Saving calls `saveDoctorAnalysis()` / `updateDoctorAnalysis()` in
`lib/doctor-store.ts`.

**Report lifecycle**: `draft` → `in_review` → `validated`. Only an admin can move a report
to `validated`, and only from `in_review` (enforced server-side in
`updateDoctorAnalysis()`). Validating stamps `validatedBy`/`validatedAt` and sends a
`reportValidatedEmail` to the report's owning doctor.

**Admin account management**: the "Create account" modal in `app/admin/page.tsx` posts to
`/api/admin/accounts` → `createAccount()`. Activate/deactivate and delete use
`/api/admin/accounts/[id]` → `adminUpdateAccount()` / `adminDeleteAccount()`.

**Password reset**: `forgot-password/page.tsx` → `requestPasswordReset()` (always a
generic success response, no account enumeration) → emails a link with a 1-hour token →
`reset-password/page.tsx` → `resetPassword()`.

**Where quality-control scores come from**: `_assess_quality()` in `utils/api.py`. It's a
**classical computer-vision heuristic** (sharpness via Laplacian variance, contrast,
exposure histogram, staining-color balance, cellularity from the segmentation count) —
**not a trained model**. Worth knowing if anyone asks how to improve it.

---

## 6. The multi-account-per-email design

The same email address can back **two** accounts — one `doctor`, one `admin` — because a
pathologist might also be the platform administrator. Since there's one login form,
**the password is what disambiguates which account they mean**: `loginDoctor()` tries the
password against every account matching that email. This is why account creation,
profile updates, and password resets all run a `passwordCollidesWithSibling()` check — if
two sibling accounts on the same email ever had the same password, login couldn't tell
them apart. (This was a real bug, since fixed — see §11.)

---

## 7. Data-store hardening

`data/doctor-store.json` is the entire database, so it's treated carefully:

- **Atomic writes**: every save writes to a temp file then renames it over the real file,
  so a crash mid-write can't corrupt it.
- **Rotating backups**: `data/backups/`, last 30 kept, written before every save.
- **Fail loud, not silent**: `readStore()` only treats a missing file (`ENOENT`) as
  "fresh install." Any other read/parse failure throws instead of silently resetting to
  empty data.
- Both `data/doctor-store.json` and `data/backups/` are gitignored.

This exists because of a real incident: a git merge conflict once left literal
`<<<<<<<` markers inside the JSON file, and the old code treated that parse failure as
"fresh install" and wiped all accounts/reports. Data was recovered from git history; the
hardening above is what stops it happening again.

---

## 8. `lib/doctor-store.ts` — every exported function

`displayName`, `patientFullName`, `publicDoctor`, `registerDoctor` (bootstrap signup),
`createAccount` (admin-created accounts), `adminUpdateAccount` (activate/deactivate/role),
`adminDeleteAccount`, `loginDoctor`, `needsBootstrap`, `getDoctorFromToken`,
`updateDoctor` (self-service profile edits), `deleteDoctor`, `requestPasswordReset`,
`resetPassword`, `listDoctorPatients`, `getPatientForDoctor`, `createPatient`,
`updatePatient`, `missingPatientFields`, `saveDoctorAnalysis`, `updateDoctorAnalysis`,
`getDoctorAnalysis`, `deleteDoctorAnalysis`, `listDoctorAnalyses`, `listAuditEvents`,
`getPlatformStats`.

## Python backend — every function in `utils/api.py`

`crop_nucleus` (extract a cell patch), `read_tiatoolbox_zarr`, `_classify` (run the
PyTorch model), `_normalized_entropy`, `_margin`, `_triage` (priority/review-reason
logic), **`_assess_quality`** (the quality-control heuristic, §5), `_contours_to_instances`,
`_classical_segmentation`, `_run_segmentation`, `_morphometrics` (per-nucleus shape
measurements), `_severity`, `_localized_anomalies`, `_gradcam_stats`, and the top-level
`predict()` that ties it all together. `main.py` just exposes `predict()` over HTTP.

---

## 9. Internationalization (EN | FR)

Built because the client demanded either full translation or the removal of the language
toggle — full translation was the direction taken.

- **`lib/use-language.ts`**: a plain module-scope variable + `window` custom event
  (`cervitrust:language`), persisted to `localStorage`. Same pattern as the doctor-session
  hook, so every mounted component re-renders instantly when the language changes,
  without prop-drilling or context providers.
- **`lib/i18n.ts`**: one flat dictionary, `'namespace.key': 'text'`, ~690 keys, with a
  parallel `en` and `fr` object. TypeScript enforces that `fr` has every key `en` has (a
  missing translation is a compile error, not a silent gap). `useTranslation()` returns
  `{ t, language, setLanguage }`; `t(key, params)` looks up the current language (falling
  back to English) and interpolates `{placeholders}`.
- **Label functions carry language too**: `lib/analysis-types.ts` functions like
  `priorityLabel`, `qualityLabel`, `reportStatusLabel`, `professionalTitleLabel`,
  `specialtyLabel`, `classMeta`, etc. all take a trailing `lang` argument, so the same
  clinical vocabulary translates consistently everywhere it's used instead of every
  component keeping its own copy. Bethesda acronyms (NILM, LSIL, HSIL, …) are
  deliberately **not** translated — they're standardized international nomenclature; only
  their descriptive full-text labels are.
- **Backend error messages**: the FastAPI/Node backend has no language awareness, so API
  error strings always come back in English. `translateError(message, t)` in `lib/i18n.ts`
  exact-matches those ~41 known backend strings against an `error.*` set of dictionary
  keys (auto-derived from the dictionary itself) and translates them; anything unmapped
  passes through unchanged rather than disappearing. Wired into every place the UI shows
  a raw API error.
- **Known, deliberate gap**: `app/layout.tsx`'s browser-tab `<title>`/`<meta description>`
  stay English-only. Next.js renders that server-side per request; the language toggle is
  a client-only preference with no locale routing, so there's no way for the server to
  know which language to render metadata in without a bigger architecture change
  (URL-based locales). Everything a user actually sees on the page is translated.

---

## 10. Everything changed, in order

**Accounts & roles**
- Replaced open self-signup with bootstrap-only signup (first admin only); all later
  accounts are admin-created.
- Split `fullName` into `firstName`/`lastName` across doctors and patients.
- Added `status: active | inactive` to accounts, with session invalidation on deactivate.
- Added the unified "role selector" (clinical title ⇒ doctor account, "Administrator" ⇒
  admin account) for account creation.
- Made login redirect by role (admin → `/admin`, doctor → `/`).
- Allowed the same email to back a doctor **and** an admin account, disambiguated by
  password; later fixed a bug where two sibling accounts sharing a password made the
  second one unreachable (`passwordCollidesWithSibling` guard).
- Admins can delete any doctor account and any admin can create more admins, but an admin
  can only delete **their own** admin account, never another admin's.
- **Latest**: an admin can no longer deactivate their own account under any
  circumstance, and can no longer delete their own account if they're the only active
  admin left (prevents an accidental total-lockout of the admin console). Enforced both
  server-side in `adminUpdateAccount`/`adminDeleteAccount` and client-side (buttons
  disabled with an explanatory tooltip) in `app/admin/page.tsx`.

**Patients**
- Introduced a real `PatientRecord` entity (8-character unique ID, first/last name, DOB,
  phone, notes) instead of free-text patient fields on each report.
- Built the patient roster as the doctor's home page (search, sort, add).
- Built `patient-picker.tsx` for attach-existing-or-register-new inside the Report tab.
- Added a per-patient mini dashboard popup (`patient-overview-modal.tsx`).
- Added a `SampleDetails` schema on reports (sample ID, slide ID, sample type, anatomical
  site fixed to "Cervix", staining method, image/study ID).

**Analysis workflow**
- Made an in-progress analysis survive page navigation (`use-analysis-session.ts`
  module-singleton), so leaving `/analysis` for the roster or dashboard and coming back
  restores exactly where you left off.
- Replaced "click a cell thumbnail → jump to Segmentation tab" with a proper zoom popup
  (`cell-zoom-modal.tsx`), wired into the review table, the segmentation viewer, and the
  saved-report detail modal.
- Fixed genuinely blurry cell-crop images: the stored crop was a raw 64×64 px tensor
  patch. The backend now takes a separate, larger crop (`cell_patch_size: 160` in
  `inference_config.json`) purely for display and upscales it with cubic interpolation;
  the 64px tensor fed to the model for classification is untouched.

**Reports**
- Added edit/delete for saved reports, and a `draft → in_review → validated` status
  workflow.
- Admin validation is now only possible from `in_review` (previously a UI bug let admins
  "validate" a report still sitting in draft).
- Validating a report stamps `validatedBy`/`validatedAt` and emails the owning doctor.

**Email**
- Added `lib/mailer.ts` (generic SMTP transport) and `lib/email-templates.ts`
  (password-reset, account-created, report-validated templates, styled to match the
  app's red/white theme).
- Added the forgot-password / reset-password flow end to end.

**Validation**
- Added `lib/validators.ts`: email format, person-name pattern, Tunisian 8-digit phone,
  date-of-birth sanity (not empty, not in the future), patient-ID generation.

**Data integrity**
- Root-caused and recovered from a data-loss incident (a git merge conflict silently
  wiped the store because any JSON parse error was treated as "fresh install").
- Added atomic writes, rotating backups, and fail-loud error handling; gitignored the
  data files.

**Branding**
- Fixed the app logo: `public/logo.png` had contained the wrong image (a Tunisian
  Ministry of Health seal); replaced with the correct CerviTrust mark and consolidated
  under the single filename `logo.png` (a duplicate `cervitrustlogo.png` was removed).

**Full English/French translation** (the largest single piece of work)
- Built the i18n architecture from scratch (§9): `use-language.ts`, `i18n.ts` dictionary
  and `useTranslation()` hook, language-aware label functions in `analysis-types.ts`.
- Translated the entire application component by component: navigation, footer,
  authentication, patient roster and picker, the full analysis workspace (all five tabs),
  saved reports, the report preview and printable document, the admin console (stats,
  tables, modals, service health), the account/profile panel, the about/system marketing
  pages, and the shared auth-gate screens.
- Swept the app repeatedly for stragglers beyond visible body text: tooltips
  (`title=`), `aria-label`s, `placeholder`s, image `alt` text, `<select>` options that
  were still using raw untranslated label maps, and client-thrown validation/toast error
  strings.
- Added `translateError()` so the ~41 distinct error messages the backend can return
  (wrong password, validation failures, permission errors, etc.) are translated too,
  instead of always showing in English regardless of the selected UI language.
- Verified throughout with `npx tsc --noEmit` (catches any dictionary key typo or missing
  French translation, since it's structurally type-checked) and `npm run build`.

---

## 11. Bugs found and fixed along the way

- **Data loss**: see §7.
- **Login disambiguation broken by duplicate passwords**: two sibling accounts (one
  admin, one doctor) sharing both an email and a password made the second one
  unreachable at login. Fixed with a password-collision guard on account
  creation/editing/reset.
- **Date-of-birth had no real validation**: only checked "not empty." Added proper
  `isValidDateOfBirth`.
- **Admin could "validate" a draft report**: the Validate button only checked
  `status !== 'validated'`, not that it was actually `in_review` yet. Fixed in three
  layers: stats no longer surface drafts as "recent," the store function refuses the
  transition server-side, and the UI button is disabled with an explanation.
- **Admin self-lockout risk** (this session): nothing stopped an admin from deactivating
  themselves, or deleting their own account even as the platform's only admin. Fixed as
  described in §10.
- Various smaller translation bugs caught via TypeScript's structural checking: a
  handful of new dictionary keys initially added to the English side only, causing a
  compile error until the French counterpart was added (by design — this is the
  mechanism that guarantees no key is ever silently untranslated).

---

## 12. If you want to extend this

- **Change email wording/branding** → `lib/email-templates.ts`.
- **Add a new translated string** → add the key to *both* `en` and `fr` objects in
  `lib/i18n.ts` (TypeScript will refuse to compile if you forget French).
- **Add a new backend error message that should be translated** → add it to the `error.*`
  section of `lib/i18n.ts`; `translateError()` picks it up automatically as long as the
  string matches exactly.
- **Change what counts as a "good quality" image** → `_assess_quality()` in
  `utils/api.py` (currently a hand-tuned CV heuristic, not a trained model).
- **Add a new account field** → `DoctorRecord` in `lib/doctor-store.ts`, plus the
  corresponding form in `doctor-profile-panel.tsx` (self-service) and `app/admin/page.tsx`
  (admin-created accounts).
