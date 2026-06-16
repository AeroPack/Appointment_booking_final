# API Endpoint Inventory

**Generated:** 2026-06-10T08:47:02.988Z  |  **Total:** 30 endpoints

## Drift Report — Missing Frontend Coverage

| Module | Missing |
|---|---|
| auth | features/auth/authApi.ts (empty)<br>features/auth/types.ts (empty) |
| users | features/users/usersApi.ts (empty)<br>features/users/types.ts (empty) |
| doctors | features/doctors/doctorsApi.ts (empty)<br>features/doctors/types.ts (empty) |
| settings | features/settings/settingsApi.ts (empty)<br>features/settings/types.ts (empty) |
| appointments | features/appointments/appointmentsApi.ts (empty)<br>features/appointments/types.ts (empty) |
| tags | features/tags/tagsApi.ts (empty)<br>features/tags/types.ts (empty) |

## auth (`/api/auth`)

| Method | Path | Auth | Roles | Middleware | Handler | Schemas |
|---|---|---|---|---|---|---|
| POST | `/api/auth/request-otp` | — | — | rateLimit | sendOtp | requestOtpSchema |
| POST | `/api/auth/verify-otp` | — | — | rateLimit | verifyOtp | verifyOtpSchema |
| POST | `/api/auth/refresh` | — | — | — | refresh | refreshSchema |
| POST | `/api/auth/logout` | ✓ | — | — | logout | logoutSchema |
| GET | `/api/auth/me` | ✓ | — | — | me | — |

## users (`/api`)

| Method | Path | Auth | Roles | Middleware | Handler | Schemas |
|---|---|---|---|---|---|---|
| GET | `/api/users/me` | ✓ | — | — | getMe | — |
| PATCH | `/api/users/me` | ✓ | — | — | updateMe | updateProfileSchema |
| POST | `/api/users/dependents` | ✓ | — | — | createDependent | createDependentSchema |
| GET | `/api/users/dependents` | ✓ | — | — | getDependents | — |

## doctors (`/api`)

| Method | Path | Auth | Roles | Middleware | Handler | Schemas |
|---|---|---|---|---|---|---|
| GET | `/api/doctors/:doctorId/profile` | ✓ | — | — | getDoctorProfile | — |
| POST | `/api/venues` | ✓ | doctor, staff | requireRole | createVenue | createVenueSchema |
| GET | `/api/venues` | ✓ | — | — | getVenues | — |
| PATCH | `/api/venues/:id` | ✓ | doctor, staff | requireRole | patchVenue | updateVenueSchema |

## settings (`/api`)

| Method | Path | Auth | Roles | Middleware | Handler | Schemas |
|---|---|---|---|---|---|---|
| GET | `/api/appointment-setting` | ✓ | — | — | getSettings | — |
| PUT | `/api/appointment-setting` | ✓ | doctor, staff | requireRole | putSettings | putSettingsSchema |
| GET | `/api/message-templates` | ✓ | — | — | listTemplates | — |
| POST | `/api/message-templates` | ✓ | doctor, staff | requireRole | createTemplate | createTemplateSchema |
| PATCH | `/api/message-templates/:id` | ✓ | doctor, staff | requireRole | updateTemplate | updateTemplateSchema |
| DELETE | `/api/message-templates/:id` | ✓ | doctor, staff | requireRole | deleteTemplate | — |

## appointments (`/api`)

| Method | Path | Auth | Roles | Middleware | Handler | Schemas |
|---|---|---|---|---|---|---|
| GET | `/api/patient/find-slots` | ✓ | — | — | findSlots | findSlotsSchema |
| POST | `/api/patient/book-slot` | ✓ | patient | requireRole | bookSlot | bookSlotSchema |

## messages (`/api`)

| Method | Path | Auth | Roles | Middleware | Handler | Schemas |
|---|---|---|---|---|---|---|
| POST | `/api/send-message` | ✓ | staff | requireRole | sendMessage | sendMessageSchema |

## tags (`/api`)

| Method | Path | Auth | Roles | Middleware | Handler | Schemas |
|---|---|---|---|---|---|---|
| POST | `/api/tags` | ✓ | staff, doctor | requireRole | createTag | createTagSchema |
| GET | `/api/tags` | ✓ | — | — | listTags | — |
| GET | `/api/tags/:id` | ✓ | — | — | getTag | — |
| PATCH | `/api/tags/:id` | ✓ | staff, doctor | requireRole | updateTag | updateTagSchema |
| DELETE | `/api/tags/:id` | ✓ | staff, doctor | requireRole | deleteTag | — |
| POST | `/api/users/:userId/tags` | ✓ | staff, doctor | requireRole | assignTag | assignTagSchema |
| DELETE | `/api/users/:userId/tags/:tagId` | ✓ | staff, doctor | requireRole | unassignTag | — |
| GET | `/api/users/:userId/tags` | ✓ | — | — | listUserTags | — |

