# Plan: Keyword-based Automation Triggers

## Goal
Update the system flow so that automations trigger based on keywords (e.g., "Hi" starts appointment booking automation) instead of every patient message. This allows multiple automations linked with their keywords, and patients can send other messages without triggering automation.

## Changes

### 1. Database Migration
- Add `keywords` column (TEXT[], default '{}') to `flows` table.
- Add GIN index on `keywords` for efficient lookup.
- File: `backend/migrations/20260822000001_add_keywords_to_flows.sql`

### 2. Backend - Flow Repository
- Update `FlowRepository.createFlow` to accept optional `keywords` array.
- Update `listFlowsByDoctor` and `findFlowForDoctor` to include `keywords` in returned fields.
- File: `backend/src/modules/flows/flow.repository.ts`

### 3. Backend - Flow Service
- Update `FlowService.createFlow` to pass keywords to repository.
- File: `backend/src/modules/flows/flow.service.ts`

### 4. Backend - Flow Routes & Controller
- Update `createFlowSchema` to accept optional `keywords` array (strings).
- Add 'custom' to allowed `trigger_type` enum.
- Update `createFlow` controller to pass keywords.
- Files: `backend/src/modules/flows/flow.routes.ts`, `backend/src/modules/flows/flow.controller.ts`

### 5. Backend - Webhook Handler (Keyword Matching)
- Add `findFlowByKeyword(doctorId, keyword)` method to `FlowSessionRepository`.
  - Query: find flow where `keywords` contains lowercased trimmed keyword AND (`doctor_id = doctorId` OR `doctor_id IS NULL`).
  - Return flow's `trigger_type` (or flow ID).
- Update `handleSessionFlow` in both webhook controllers:
  - If no active session, attempt to match keyword.
  - If match found, start session with that trigger_type.
  - If no match, do nothing (log and return).
- Files: `backend/src/modules/flows/flow.session-repository.ts`, `backend/src/modules/flows/flow.webhook-controller.ts`, `backend/src/modules/flows/flow.webhook-evolution-controller.ts`

### 6. Frontend - Flow Creation
- Add 'custom' option to `TRIGGER_OPTIONS` in `FlowList.tsx`.
- Add optional keywords input (comma-separated) in the "New Flow" modal.
- Pass keywords to `createFlow` mutation.
- File: `frontend/src/pages/doctor/FlowList.tsx`

### 7. Frontend - Flow List Display (Optional)
- Show keywords as tags under flow name in the list.
- File: `frontend/src/pages/doctor/FlowList.tsx`

## Testing
- Run migration locally.
- Create a flow with trigger type 'custom' and keywords "Hi, Hello".
- Send "Hi" via WhatsApp (or模拟 webhook) and verify flow starts.
- Send "Hello" and verify same flow starts.
- Send "Something else" and verify no flow starts.
- Ensure existing flows without keywords are not triggered by messages.
- Ensure event-triggered flows (booking_confirmed, reminder) still work.

## Assumptions
- Keywords are case-insensitive and trimmed.
- Multiple keywords per flow allowed.
- If multiple flows match a keyword, the doctor-specific flow takes priority (existing logic).
- System flows (booking_confirmed, reminder) are not affected (they have no keywords and are event-triggered).
- The 'custom' trigger type is added to the allowed list; doctors can create multiple custom flows with different keywords.

## Out of Scope
- Editing keywords after flow creation (can be added later).
- Keyword management UI for system admin.
- Help message when no keyword matches (user chose "Do nothing").

## Files to Modify
1. `backend/migrations/20260822000001_add_keywords_to_flows.sql` (new)
2. `backend/src/modules/flows/flow.repository.ts`
3. `backend/src/modules/flows/flow.service.ts`
4. `backend/src/modules/flows/flow.routes.ts`
5. `backend/src/modules/flows/flow.controller.ts`
6. `backend/src/modules/flows/flow.session-repository.ts`
7. `backend/src/modules/flows/flow.webhook-controller.ts`
8. `backend/src/modules/flows/flow.webhook-evolution-controller.ts`
9. `frontend/src/pages/doctor/FlowList.tsx`

## Verification
- Run existing tests (if any) to ensure no regressions.
- Manually test via WhatsApp or simulated webhook.
- Check database for keywords column.