# Plan: Fix Booking Update + Quick Status Dropdown

## Issue 1: Appointment Booking Update (Reschedule) Fails

**Root Cause:** `findBookedCountForSlot` (`appointments.repository.ts:55-66`) counts ALL appointments in the slot including the one being rescheduled. When rescheduling to the same slot, the count includes the existing appointment, causing a false `SLOT_FULL` error.

**Files to modify:**
1. `backend/src/modules/appointments/appointments.repository.ts` - Add `excludeAppointmentId` param to `findBookedCountForSlot`
2. `backend/src/modules/appointments/appointments.service.ts:327` - Pass appointmentId to `findBookedCountForSlot` in `rescheduleAppointment()`

## Issue 2: Quick Status Dropdown in Patient Queue

**Current:** Click pill -> full-screen modal with 3 buttons + notes + cancel template.

**New design:** Native `<select>` dropdown directly in the status column cell.

- Options: Waiting (booked), Finished, No-show, Cancelled
- Finished/No-show: update immediately on selection
- Cancelled: show a warning modal (compact, not full-screen) with optional template selector and confirm button
- Per-row loading spinner while API call is in progress
- Remove the existing full-screen status modal

**File to modify:** `frontend/src/pages/doctor/PatientQueue.tsx`
