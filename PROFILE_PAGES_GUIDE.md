# Profile Pages — Implementation Guide for Junior Developers

> Last updated: 2026-06-15  
> Covers: Patient, Doctor, and Staff profile pages with full update functionality.

---

## 1. Architecture Decision

We use **3 separate profile pages**, not one shared page.

| Role | Page Path | Why separate? |
|---|---|---|
| Patient | `/pages/patient/Profile.tsx` | Already exists. Personal + family focus. |
| Doctor | `/pages/doctor/Profile.tsx` | Professional identity, public preview, availability link. Fundamentally different. |
| Staff | `/pages/staff/Profile.tsx` | Same base as patient but no family section. Thin variant. |

However, two UI sections are **identical across all three roles** and must be extracted as shared components to avoid duplication:

```
/src/core/components/shared/
  AppSettingsCard.tsx      ← notifications, language, help, accessibility, logout
  PersonalInfoForm.tsx     ← name, email, dob, address, city, state, zip
```

---

## 2. Current Data Model — Read This First

### What lives in the `users` table (all roles share this)
These fields are updated via `PATCH /api/users/me`:

| Field | Editable? | Note |
|---|---|---|
| `name` | ✅ Yes | |
| `email` | ✅ Yes | |
| `address` | ✅ Yes | |
| `date_of_birth` | ✅ Yes | |
| `city` | ✅ Yes | |
| `state` | ✅ Yes | |
| `zip_code` | ✅ Yes | |
| `mobile_number` | ❌ Read-only | Cannot change via profile update |
| `avatar_url` | ❌ Read-only | Upload not implemented yet — display only |
| `role` | ❌ Never | |

### What lives in the `doctor_profiles` table (doctor only)
These need a **new backend endpoint** `PATCH /api/doctor/profile`:

| Field | Type | Editable? |
|---|---|---|
| `speciality` | text | ✅ Yes |
| `qualification` | text | ✅ Yes |
| `registration_number` | text | ✅ Yes |
| `bio` | text | ✅ Yes |
| `consultation_fee` | numeric | ✅ Yes |
| `title` | text (Dr./Prof.) | ✅ Yes |
| `experience_years` | int | ✅ Yes |
| `patient_count` | int | ❌ System-managed |
| `awards_count` | int | ❌ System-managed |
| `publications_count` | int | ❌ System-managed |

---

## 3. Backend Changes Required

Two new endpoints are needed. Everything else already exists.

### 3a. GET /api/doctor/profile
Returns the **logged-in doctor's own** combined profile (users JOIN doctor_profiles).

This is different from `GET /api/doctors/:id/profile` which is patient-facing and read-only.

**Response shape:**
```typescript
{
  // from users table
  id: string
  name: string
  email: string | null
  mobile_number: string | null
  address: string | null
  date_of_birth: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  avatar_url: string | null
  is_verified: boolean
  // from doctor_profiles table
  title: string | null
  speciality: string | null
  qualification: string | null
  registration_number: string | null
  bio: string | null
  consultation_fee: string | null
  experience_years: number | null
}
```

### 3b. PATCH /api/doctor/profile
Updates only the `doctor_profiles` table fields. User table fields (name, email, address) are still updated via the existing `PATCH /api/users/me`.

**Request body:**
```typescript
{
  title?: string
  speciality?: string
  qualification?: string
  registration_number?: string
  bio?: string
  consultation_fee?: number
  experience_years?: number
}
```

> **Note for backend dev:** The handler must extract `doctorId` from the authenticated user's token, not from a URL param. A patient must never be able to call this endpoint — add a role check middleware.

---

## 4. Frontend API Changes

### 4a. Add types in `/features/doctors/types.ts`
```typescript
export interface DoctorOwnProfile {
  // user fields
  id: string
  name: string
  email: string | null
  mobile_number: string | null
  address: string | null
  date_of_birth: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  avatar_url: string | null
  is_verified: boolean
  // doctor_profiles fields
  title: string | null
  speciality: string | null
  qualification: string | null
  registration_number: string | null
  bio: string | null
  consultation_fee: string | null
  experience_years: number | null
}

export interface UpdateDoctorProfileInput {
  title?: string
  speciality?: string
  qualification?: string
  registration_number?: string
  bio?: string
  consultation_fee?: number
  experience_years?: number
}
```

### 4b. Add endpoints in `/features/doctors/doctorsApi.ts`
```typescript
// Add these two endpoints alongside the existing ones:

getOwnDoctorProfile: builder.query<DoctorOwnProfile, void>({
  query: () => '/api/doctor/profile',
  providesTags: ['Doctor'],
}),

updateDoctorProfile: builder.mutation<DoctorOwnProfile, UpdateDoctorProfileInput>({
  query: (body) => ({ url: '/api/doctor/profile', method: 'PATCH', body }),
  invalidatesTags: ['Doctor'],
}),
```

Export the hooks: `useGetOwnDoctorProfileQuery`, `useUpdateDoctorProfileMutation`.

---

## 5. Shared Components to Build First

Build these before any of the three profile pages.

### 5a. AppSettingsCard
**File:** `/src/core/components/shared/AppSettingsCard.tsx`

Renders: Notifications toggle, Language, Help & Support, Accessibility, Logout button.

Props:
```typescript
interface AppSettingsCardProps {
  onLogout: () => void
}
```

Extract this from the existing patient Profile.tsx — the exact JSX is already there.

### 5b. PersonalInfoForm
**File:** `/src/core/components/shared/PersonalInfoForm.tsx`

Renders: Email, Date of Birth, Address, City, State, Zip Code inputs. Both desktop (form card) and mobile (list) layouts.

Props:
```typescript
interface PersonalInfoFormProps {
  formData: {
    email: string
    dob: string
    address: string
    city: string
    state: string
    zipCode: string
  }
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onSave: () => void
}
```

---

## 6. Patient Profile Page (Existing — Fix and Refactor)

**File:** `/pages/patient/Profile.tsx`  
**Route:** `/patient/profile` — already wired in router and nav.

### Changes needed
1. Replace the inline App Settings section with `<AppSettingsCard onLogout={handleLogout} />`
2. Replace the inline personal info form with `<PersonalInfoForm ... />`
3. Fix the `isPremium` field — it does not exist on `UserProfile`. Either remove the premium badge or add `is_premium: boolean` to the `UserProfile` type in `/features/users/types.ts` and the backend.
4. The "Verified Patient" badge should read `me.is_verified`, which already exists.

### What stays patient-specific
- The mobile avatar/name header
- "Verified Patient" and "Premium Member" badges
- The Family Members quick-link (only patients have dependents)

---

## 7. Doctor Profile Page (New)

**File:** `/pages/doctor/Profile.tsx`  
**Route:** `/doctor/profile`

### Section layout

```
┌─────────────────────────────────────────────────────┐
│  PROFESSIONAL IDENTITY                              │
│  Title · Full Name · Speciality · Qualification     │
│  Bio (textarea) · Registration No. · Exp. Years    │
│  Consultation Fee                                   │
├─────────────────────────────────────────────────────┤
│  CONTACT & PERSONAL                                 │
│  Email · Address · City · State · Zip               │
│  Mobile (read-only, cannot change)                  │
├─────────────────────────────────────────────────────┤
│  PUBLIC PROFILE PREVIEW                             │
│  Button → opens patient-facing view in new tab      │
├─────────────────────────────────────────────────────┤
│  AVAILABILITY QUICK LINK                            │
│  Card → navigates to /doctor/availability           │
├─────────────────────────────────────────────────────┤
│  APP SETTINGS CARD (shared component)               │
└─────────────────────────────────────────────────────┘
```

### Save strategy — two separate PATCH calls

Doctor profile spans two backend endpoints. Fire both on save:

```typescript
// These can run in parallel
await Promise.all([
  updateMe({ name, email, address, city, state, zip_code, date_of_birth }),
  updateDoctorProfile({ title, speciality, qualification, registration_number, bio, consultation_fee, experience_years }),
])
```

### Data loading
```typescript
const { data: me } = useGetMeQuery()                       // user fields
const { data: doctorProfile } = useGetOwnDoctorProfileQuery()  // doctor_profiles fields
```

### Public profile preview
The patient-facing doctor detail page is at `/patient/doctor/:id`.  
The doctor's own user id is in `me.id`.

```typescript
<button onClick={() => window.open(`/patient/doctor/${me?.id}`, '_blank')}>
  Preview public profile
</button>
```

### Field-by-field spec

**Professional Identity section:**

| UI Label | Field | Input type | Notes |
|---|---|---|---|
| Title | `title` | select | Options: Dr. / Prof. / Mr. / Ms. |
| Full Name | `name` (users) | text | |
| Speciality | `speciality` | text | e.g. Cardiology |
| Qualification | `qualification` | text | e.g. MBBS, MD |
| Registration No. | `registration_number` | text | e.g. MCI-12345 |
| Years of Experience | `experience_years` | number | |
| Consultation Fee (₹) | `consultation_fee` | number | |
| About / Bio | `bio` | textarea | Use `<textarea>` not `<Input>` |

**Contact & Personal section (use PersonalInfoForm):**

| UI Label | Field | Note |
|---|---|---|
| Email | `email` (users) | |
| Mobile | `mobile_number` (users) | Disabled, read-only |
| Address | `address` (users) | |
| City | `city` (users) | |
| State | `state` (users) | |
| Zip Code | `zip_code` (users) | |

---

## 8. Staff Profile Page (New)

**File:** `/pages/staff/Profile.tsx`  
**Route:** `/staff/profile`

### Section layout

```
┌─────────────────────────────────────────────────────┐
│  PERSONAL INFO (use PersonalInfoForm shared component) │
│  Email · DOB · Address · City · State · Zip         │
│  Mobile (read-only)                                 │
├─────────────────────────────────────────────────────┤
│  APP SETTINGS CARD (shared component)               │
└─────────────────────────────────────────────────────┘
```

Staff profile is the simplest of the three. No professional fields, no family section, no public preview.

### Data loading
```typescript
const { data: me } = useGetMeQuery()        // same endpoint as patient
const [updateMe] = useUpdateMeMutation()    // same mutation as patient
```

### Badge
Show `"Active Staff"` badge if `me.is_verified === true`. No premium badge.

---

## 9. Routing — Changes Required

### nav.config.ts — add missing profile routes

```typescript
// Doctor nav — add profile item
{ label: 'Profile', href: '/doctor/profile', icon: User }

// Staff nav — add profile item
{ label: 'Profile', href: '/staff/profile', icon: User }
```

### router.tsx — add new routes inside the AppLayout block

```typescript
<Route path="/doctor/profile" element={<DoctorProfile />} />
<Route path="/staff/profile" element={<StaffProfile />} />
```

---

## 10. Implementation Order

Follow this order. Each step unblocks the next.

```
Step 1 — Backend
  ├─ Add GET /api/doctor/profile handler + route
  ├─ Add PATCH /api/doctor/profile handler + route
  └─ Add Zod validation schema for PATCH body

Step 2 — Frontend types
  ├─ Add DoctorOwnProfile to /features/doctors/types.ts
  └─ Add UpdateDoctorProfileInput to /features/doctors/types.ts

Step 3 — Frontend API
  ├─ Add getOwnDoctorProfile query to doctorsApi.ts
  └─ Add updateDoctorProfile mutation to doctorsApi.ts

Step 4 — Shared components
  ├─ Extract AppSettingsCard from patient Profile.tsx
  └─ Extract PersonalInfoForm from patient Profile.tsx

Step 5 — Patient Profile (refactor)
  ├─ Replace inline sections with shared components
  └─ Fix isPremium type issue

Step 6 — Doctor Profile (new page)
  └─ Build /pages/doctor/Profile.tsx

Step 7 — Staff Profile (new page)
  └─ Build /pages/staff/Profile.tsx

Step 8 — Routes
  ├─ Add profile nav items to nav.config.ts for doctor and staff
  └─ Add profile routes to router.tsx
```

---

## 11. Code Quality Rules

- **Never call `PATCH /api/users/me` for doctor_profiles fields** and vice versa. They are separate tables with separate endpoints.
- **Mobile number is always read-only.** Render it as disabled input. Never include it in a PATCH body.
- **Avatar upload is not implemented.** Display the avatar. Disable the camera button with `cursor-not-allowed` and tooltip "Photo upload coming soon". Do not wire upload logic.
- **One `useGetMeQuery()` call per page.** Do not call it inside child components. Pass the data as props.
- **Both mutations can run in parallel** via `Promise.all`. Do not await one then the other sequentially.
- **Follow the existing API slice pattern** from `usersApi.ts` when adding to `doctorsApi.ts`.
- **Match the existing UI style** from the patient `Profile.tsx`. Use `Card`, `Input`, `Button`, `Avatar`, `Badge` from `/core/components/ui/`.

---

## 12. What NOT to Build Yet

These are out of scope for this task:

- Avatar / photo upload (backend endpoint not ready)
- Two-factor authentication (security tip card is placeholder text only)
- Notifications preferences persistence (the toggle is UI-only)
- Language switching (placeholder)
- Public profile URL sharing
- Doctor stats editing (patient_count, awards_count, publications_count are system-managed)
