# WhatsApp Chatbot Integration — Complete Implementation Plan

## Overview

This plan adds WhatsApp chatbot support to the appointment booking system using **Evolution API (Baileys)**. Doctors enable the chatbot from the app dashboard by scanning a QR code. Patients then message the doctor's WhatsApp number to book appointments.

### User Experience

1. Doctor logs in → Settings → **WhatsApp Chatbot Integration** page
2. Enters phone number → clicks "Connect WhatsApp"
3. QR code appears → doctor scans with WhatsApp (Linked Devices)
4. Status changes to **"Connected"** (green indicator)
5. Patient messages doctor's number → chatbot responds with greeting → slot selection → booking

---

## Architecture

```
Doctor scans QR in appointment app
    ↓
Appointment Backend calls Evolution API
    ↓
Evolution API creates instance + returns QR
    ↓
Doctor's WhatsApp connects via Baileys
    ↓
Patient sends message to doctor's number
    ↓
Evolution API fires webhook
    ↓
POST /api/webhooks/whatsapp-evolution/:instanceName
    ↓
Controller maps instance → doctor_id
    ↓
Existing FlowEngine handles conversation
    ↓
FlowEngine sends reply via WhatsAppEvolutionChannel
    ↓
Evolution API sends message to patient
```

---

## Part 1: Database Migration

**New file:** `backend/migrations/20260811000001_add_evolution_api_support.sql`

```sql
-- Add Evolution API fields to doctor_chatbot_config
ALTER TABLE doctor_chatbot_config 
  ADD COLUMN IF NOT EXISTS evolution_instance_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS evolution_connection_status VARCHAR(20) DEFAULT 'disconnected',
  ADD COLUMN IF NOT EXISTS evolution_connected_at TIMESTAMPTZ;

-- Each Evolution instance maps to exactly one doctor
CREATE UNIQUE INDEX IF NOT EXISTS uq_doctor_chatbot_config_evolution_instance 
  ON doctor_chatbot_config(evolution_instance_name) 
  WHERE evolution_instance_name IS NOT NULL;

-- Add Evolution API URL to clinics
ALTER TABLE clinics 
  ADD COLUMN IF NOT EXISTS evolution_api_url VARCHAR(255);
```

**Schema changes summary:**

| Table | New Column | Type | Purpose |
|-------|-----------|------|---------|
| `doctor_chatbot_config` | `evolution_instance_name` | VARCHAR(100) | Instance name like `evo-a1b2c3d4` |
| `doctor_chatbot_config` | `evolution_connection_status` | VARCHAR(20) | `disconnected`, `connecting`, `connected` |
| `doctor_chatbot_config` | `evolution_connected_at` | TIMESTAMPTZ | When QR was scanned |
| `clinics` | `evolution_api_url` | VARCHAR(255) | Evolution API base URL |

---

## Part 2: Backend Files (7 new, 3 modified)

### NEW File 1: `backend/src/modules/doctors/evolution.service.ts`

Manages Evolution API instance lifecycle.

**Key methods:**
- `connectDoctor(doctorId, phoneNumber)` — Creates instance, gets QR, configures webhook
- `getQrCode(doctorId)` — Returns QR code for polling (frontend calls every 3s)
- `disconnectDoctor(doctorId)` — Deletes instance, clears DB
- `getStatus(instanceName)` — Checks Evolution API for connection state

**Instance naming convention:** `evo-{doctorId.substring(0, 8)}`

**DB updates:**
```sql
INSERT INTO doctor_chatbot_config (doctor_id, evolution_instance_name, evolution_connection_status, is_enabled)
VALUES ($1, $2, $3, true)
ON CONFLICT (doctor_id) DO UPDATE SET
  evolution_instance_name = EXCLUDED.evolution_instance_name,
  evolution_connection_status = EXCLUDED.evolution_connection_status,
  evolution_connected_at = CASE WHEN EXCLUDED.evolution_connection_status = 'connected' 
                           THEN NOW() ELSE doctor_chatbot_config.evolution_connected_at END,
  is_enabled = true
```

**Webhook configuration call to Evolution API:**
```json
POST /webhook/set/{instanceName}
{
  "enabled": true,
  "url": "https://appointment.aeropackpos.in/api/webhooks/whatsapp-evolution/{instanceName}",
  "webhook_by_events": false,
  "events": ["MESSAGES_UPSERT"]
}
```

---

### NEW File 2: `backend/src/modules/doctors/evolution.controller.ts`

API endpoints for the doctor's WhatsApp integration page.

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/doctor/whatsapp/connect` | POST | JWT + doctor role | Create instance, return QR |
| `/api/doctor/whatsapp/qr` | GET | JWT + doctor role | Poll QR/status |
| `/api/doctor/whatsapp/status` | GET | JWT + doctor role | Get connection status |
| `/api/doctor/whatsapp/disconnect` | POST | JWT + doctor role | Disconnect |

**Request/response examples:**

```
POST /api/doctor/whatsapp/connect
Body: { "phoneNumber": "919876543210" }

Response:
{
  "success": true,
  "data": {
    "instanceName": "evo-a1b2c3d4",
    "qrcode": "data:image/png;base64,iVBORw0KGgo...",
    "status": "connecting"
  }
}
```

```
GET /api/doctor/whatsapp/qr

Response (still scanning):
{
  "success": true,
  "data": { "qrcode": "data:image/png;base64,...", "status": "connecting" }
}

Response (connected):
{
  "success": true,
  "data": { "qrcode": null, "status": "connected" }
}
```

---

### NEW File 3: `backend/src/modules/doctors/evolution.routes.ts`

```typescript
import { Router } from 'express';
import { authGuard } from '../../middleware/authGuard.js';
import { requireRole } from '../../middleware/requireRole.js';
import { connectWhatsApp, getQrCode, getWhatsAppStatus, disconnectWhatsApp } from './evolution.controller.js';

const router = Router();
router.post('/doctor/whatsapp/connect', authGuard, requireRole('doctor'), connectWhatsApp);
router.get('/doctor/whatsapp/qr', authGuard, requireRole('doctor'), getQrCode);
router.get('/doctor/whatsapp/status', authGuard, requireRole('doctor'), getWhatsAppStatus);
router.post('/doctor/whatsapp/disconnect', authGuard, requireRole('doctor'), disconnectWhatsApp);
export default router;
```

---

### NEW File 4: `backend/src/utils/channels/whatsapp-evolution.ts`

Implements `MessageChannel` interface for Evolution API. This is how the flow engine sends outbound messages.

**Key differences from WhatsAppCloudChannel:**

| Aspect | Cloud API | Evolution API |
|--------|-----------|---------------|
| Auth | Bearer token | `apikey` header |
| Phone format | Same (digits + country code) | Same |
| Text send | `POST /{version}/{phoneNumberId}/messages` | `POST /message/sendText/{instanceName}` |
| List send | Meta interactive list format | `POST /message/sendList/{instanceName}` |
| Buttons | Meta reply buttons (max 3) | **Not supported** → numbered text fallback |
| Instance | Global (one Cloud API number) | Per-doctor (each has own instance) |

**Critical: Buttons fallback**

Since Baileys doesn't support interactive buttons, the `sendOutbound()` with `kind: 'buttons'` is converted to numbered text:

```typescript
if (interactive.kind === 'buttons') {
  const numbered = interactive.buttons
    .map((b, i) => `${i + 1}. ${b.title}`)
    .join('\n');
  const text = `${interactive.body}\n\n${numbered}\n\nReply with 1-${interactive.buttons.length}.`;
  return this.sendText(credentials, to, text);
}
```

**Lists work natively** — patients see a tappable dropdown with slot options.

**Doctor ID routing:** The `sendMessage()` call includes `options.doctorId` (passed by the flow executor). The Evolution channel uses this to look up the correct instance from `doctor_chatbot_config`.

---

### NEW File 5: `backend/src/modules/flows/flow.webhook-evolution-routes.ts`

```typescript
import { Router } from 'express';
import { handleEvolutionWebhook } from './flow.webhook-evolution-controller.js';
import { rateLimit } from '../../middleware/rateLimit.js';

const router = Router();
router.post(
  '/webhooks/whatsapp-evolution/:instanceName',
  rateLimit(60_000, 120),
  handleEvolutionWebhook
);
export default router;
```

---

### NEW File 6: `backend/src/modules/flows/flow.webhook-evolution-controller.ts`

Receives inbound WhatsApp messages from Evolution API and routes them to the flow engine.

**Evolution API webhook payload (MESSAGES_UPSERT):**
```json
{
  "event": "messages.upsert",
  "instance": "evo-a1b2c3d4",
  "data": {
    "key": {
      "remoteJid": "917678668630@s.whatsapp.net",
      "fromMe": false,
      "id": "3EB0..."
    },
    "message": {
      "conversation": "10:00 AM"
    },
    "messageTimestamp": 1786443212
  }
}
```

**Controller flow:**

```
1. ACK immediately (200) - prevent retries
2. Check event === "messages.upsert"
3. Ignore if fromMe === true (our own messages)
4. Extract: instanceName (URL param), phone (from remoteJid), input (from message), id
5. Deduplicate via whatsapp_inbound_messages table
6. Query doctor_chatbot_config WHERE evolution_instance_name = instanceName → get doctor_id
7. Call handleSessionFlow(doctorId, phone, input) — SAME function as Cloud API webhook
```

**The `handleSessionFlow` function is identical to `flow.webhook-controller.ts`:**
```typescript
async function handleSessionFlow(doctorId: string, phone: string, input: string) {
  const activeSession = await repo.findActiveSession(doctorId, phone);
  if (!activeSession) {
    await service.startSession({ doctorId, patientId: null, channel: 'whatsapp', channelSessionId: phone, triggerType: 'book' });
    return;
  }
  if (activeSession.status === 'completed' || activeSession.status === 'error') {
    await service.startSession({ doctorId, patientId: null, channel: 'whatsapp', channelSessionId: phone, triggerType: 'book' });
    return;
  }
  await service.resumeSession({ sessionId: activeSession.id, doctorId, channelSessionId: phone, input });
}
```

---

### MODIFY File 7: `backend/src/utils/channels/initializer.ts`

```typescript
import { WhatsAppEvolutionChannel } from './whatsapp-evolution.js';

const provider = process.env['WA_PROVIDER'] || 'bhashsms';
let whatsappChannel;
switch (provider) {
  case 'cloud':      whatsappChannel = new WhatsAppCloudChannel(); break;
  case 'evolution':  whatsappChannel = new WhatsAppEvolutionChannel(); break;
  default:           whatsappChannel = new WhatsAppChannel(); break;
}
channelRegistry.register(whatsappChannel);
```

---

### MODIFY File 8: `backend/src/app.ts`

Add two new route imports and mount them:

```typescript
import flowEvolutionWebhookRoutes from './modules/flows/flow.webhook-evolution-routes.js';
import evolutionRoutes from './modules/doctors/evolution.routes.js';

// In route mounting section:
app.use('/api', flowEvolutionWebhookRoutes);
app.use('/api', evolutionRoutes);
```

---

### MODIFY File 9: `backend/src/modules/flows/flow.executor.ts`

In `sendOutbound()` method (line ~900), pass `doctorId` so Evolution channel can route to the correct instance:

```typescript
// Change:
await sendMessage({
  to: session.channel_session_id,
  content, clinicId, channel: 'whatsapp',
  ...(interactive ? { options: { interactive } } : {}),
});

// To:
await sendMessage({
  to: session.channel_session_id,
  content, clinicId, channel: 'whatsapp',
  options: {
    ...(interactive ? { interactive } : {}),
    doctorId: session.doctor_id,
  },
});
```

---

## Part 3: Environment Variables

Add to `backend/.env`:

```env
WA_PROVIDER=evolution
EVOLUTION_API_URL=http://evolution_api:8080
EVOLUTION_API_KEY=760857eccde30ec19ed07ec558933076fa916a157db1942052a226feae15e2ef
BACKEND_URL=https://appointment.aeropackpos.in
```

---

## Part 4: Docker Networking

The appointment backend container needs to reach the Evolution API container. Run:

```bash
docker network connect appointment_network evolution_api
```

Or modify `/opt/evolution/docker-compose.yml` to add `appointment_network` as external.

---

## Part 5: Frontend — WhatsApp Integration Page

**New feature directory:** `frontend/src/features/doctors/whatsapp-integration/`

### Components:

1. **`WhatsAppIntegrationPage.tsx`** — Main page
2. **`ConnectionStatus.tsx`** — Green/red status indicator
3. **`QrCodeModal.tsx`** — Modal showing QR code with polling
4. **`ConnectForm.tsx`** — Phone number input + connect button

### Frontend Flow:

```
Page loads → GET /api/doctor/whatsapp/status
    ↓
If disconnected → Show phone input + "Connect" button
    ↓
Doctor enters phone → POST /api/doctor/whatsapp/connect
    ↓
Show QR code modal → Poll GET /api/doctor/whatsapp/qr every 3 seconds
    ↓
Doctor scans QR → Status changes to "connected"
    ↓
Hide QR modal → Show green "Connected" status + "Disconnect" button
```

### UI States:

| State | What doctor sees |
|-------|-----------------|
| **Disconnected** | Phone number input + blue "Connect WhatsApp" button |
| **Connecting** | QR code (auto-refreshing) + "Scan with WhatsApp" text |
| **Connected** | Green badge "WhatsApp Connected" + phone number + red "Disconnect" button |

---

## Part 6: Complete File List

| # | File | Action |
|---|------|--------|
| 1 | `backend/migrations/20260811000001_add_evolution_api_support.sql` | CREATE |
| 2 | `backend/src/modules/doctors/evolution.service.ts` | CREATE |
| 3 | `backend/src/modules/doctors/evolution.controller.ts` | CREATE |
| 4 | `backend/src/modules/doctors/evolution.routes.ts` | CREATE |
| 5 | `backend/src/utils/channels/whatsapp-evolution.ts` | CREATE |
| 6 | `backend/src/modules/flows/flow.webhook-evolution-routes.ts` | CREATE |
| 7 | `backend/src/modules/flows/flow.webhook-evolution-controller.ts` | CREATE |
| 8 | `backend/src/utils/channels/initializer.ts` | MODIFY |
| 9 | `backend/src/app.ts` | MODIFY |
| 10 | `backend/src/modules/flows/flow.executor.ts` | MODIFY |
| 11 | `backend/.env` | MODIFY |
| 12 | `frontend/src/features/doctors/whatsapp-integration/` | CREATE (3-4 files) |
| 13 | Docker networking | MODIFY |

---

## Part 7: Setup Flow Summary

### Doctor Setup (in appointment app):
1. Open WhatsApp Chatbot Integration page
2. Enter phone number → click Connect
3. Scan QR code with WhatsApp
4. Done — chatbot is live

### Patient Experience:
1. Message doctor's WhatsApp number
2. Receive greeting + "Book Appointment" option
3. See available slots (dropdown list)
4. Select slot → provide name + phone
5. Receive booking confirmation with token number

---

## Part 8: Key Design Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Instance naming | `evo-{doctorId[0:8]}` | Unique, predictable |
| QR polling | Every 3 seconds | Good UX, not too frequent |
| Buttons | Numbered text fallback | Baileys doesn't support interactive buttons |
| Lists | Native Evolution API list | Works perfectly on Baileys |
| Webhook auth | Instance name in URL | Simple, no extra secrets needed |
| Session storage | Same `flow_sessions` table | Reuses existing flow engine |
| Message dedup | Same `whatsapp_inbound_messages` | Consistent with Cloud API |

---

## Part 9: Testing Checklist

- [ ] Migration runs without errors
- [ ] `POST /api/doctor/whatsapp/connect` creates instance and returns QR
- [ ] QR code displays in frontend
- [ ] QR scan connects successfully
- [ ] `GET /api/doctor/whatsapp/status` returns `connected: true`
- [ ] `POST /api/doctor/whatsapp/disconnect` clears instance
- [ ] Inbound message from patient triggers flow engine
- [ ] Chatbot responds with greeting
- [ ] Slot picker shows available slots
- [ ] Patient can select slot and book
- [ ] Appointment appears in doctor dashboard
- [ ] Multiple doctors can have separate instances
- [ ] Messages are deduplicated correctly
- [ ] Flow sessions expire after inactivity

---

## Part 10: Troubleshooting

| Issue | Likely Cause | Solution |
|-------|--------------|----------|
| QR code not appearing | Evolution API unreachable | Check `docker ps` for evolution_api container |
| QR scan fails | Wrong phone number format | Ensure phone includes country code (91...) |
| Webhook not receiving | Network issue | Check Docker network connectivity |
| Messages not sending | Instance disconnected | Re-scan QR code |
| Wrong doctor receiving messages | Instance name mismatch | Check `doctor_chatbot_config.evolution_instance_name` |
| Buttons showing as text | Baileys limitation | Expected behavior - use numbered text |
| Migration fails | Column already exists | Use IF NOT EXISTS in migration |

---

## Part 11: Evolution API Endpoints Reference

### Instance Management
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /instance/create` | Create new instance |
| `GET /instance/fetchInstances` | List all instances |
| `GET /instance/connectionState/{instanceName}` | Get status + QR |
| `DELETE /instance/delete/{instanceName}` | Delete instance |

### Message Sending
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /message/sendText/{instanceName}` | Send text message |
| `POST /message/sendList/{instanceName}` | Send list (dropdown) |
| `POST /message/sendButtons/{instanceName}` | Send buttons (Baileys: use text fallback) |

### Webhook
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /webhook/set/{instanceName}` | Configure webhook URL |
| `GET /webhook/find/{instanceName}` | Get current webhook config |

### Authentication
All requests require `apikey` header:
```
apikey: 760857eccde30ec19ed07ec558933076fa916a157db1942052a226feae15e2ef
```

### Webhook Payload Format (MESSAGES_UPSERT)
```json
{
  "event": "messages.upsert",
  "instance": "evo-a1b2c3d4",
  "data": {
    "key": {
      "remoteJid": "917678668630@s.whatsapp.net",
      "fromMe": false,
      "id": "3EB0..."
    },
    "message": {
      "conversation": "Hello"
    },
    "messageTimestamp": 1786443212
  }
}
```

---

## Part 12: Existing Codebase Reference

### Key Files to Understand

| File | Purpose |
|------|---------|
| `backend/src/utils/channels/types.ts` | MessageChannel interface, InteractiveMessage type |
| `backend/src/utils/channels/registry.ts` | ChannelRegistry singleton |
| `backend/src/utils/channels/initializer.ts` | Provider selection via WA_PROVIDER env |
| `backend/src/utils/channels/whatsapp-cloud.ts` | Cloud API implementation (reference) |
| `backend/src/modules/flows/flow.executor.ts` | Flow engine (sendOutbound at line 885) |
| `backend/src/modules/flows/flow.webhook-controller.ts` | Cloud API webhook (reference) |
| `backend/src/modules/flows/flow.session-service.ts` | Session lifecycle management |
| `backend/src/modules/bot/bot.service.ts` | Slot generation, booking logic |
| `backend/src/modules/doctors/doctors.routes.ts` | Existing doctor routes |
| `backend/src/middleware/botAuth.ts` | Widget key auth (for /api/bot/*) |
| `backend/src/middleware/whatsappWebhookAuth.ts` | Cloud API webhook auth |

### Existing Tables Used

| Table | Purpose |
|-------|---------|
| `doctor_chatbot_config` | Widget key, greeting, position, **+ new Evolution fields** |
| `flow_sessions` | Conversation state (no changes needed) |
| `flow_messages` | Message transcript (no changes needed) |
| `whatsapp_inbound_messages` | Dedup (reused for Evolution) |
| `users` | Doctor/patient records |
| `clinics` | Clinic info, **+ new Evolution URL** |
| `appointments` | Booked appointments (no changes needed) |
| `appointment_settings` | Doctor schedule (no changes needed) |

### Channel Abstraction Pattern

```typescript
// MessageChannel interface (types.ts)
interface MessageChannel {
  readonly channelType: 'whatsapp' | 'email' | 'sms';
  sendMessage(params: SendMessageParams): Promise<MessageResult>;
  validateConfig(clinicId: string): Promise<boolean>;
  getConfig(clinicId: string): Promise<ChannelConfig | null>;
}

// SendMessageParams
interface SendMessageParams {
  to: string;           // Phone number
  content: string;      // Text content
  clinicId: string;     // Clinic UUID
  options?: Record<string, unknown>;  // { interactive: InteractiveMessage, doctorId: string }
}

// InteractiveMessage
type InteractiveMessage =
  | { kind: 'buttons'; body: string; buttons: Array<{ id: string; title: string }> }
  | { kind: 'list'; body: string; button: string;
      sections: Array<{ title?: string; rows: Array<{ id: string; title: string; description?: string }> }> };
```

### Flow Executor sendOutbound Pattern

```typescript
// flow.executor.ts line 885
private async sendOutbound(
  session: FlowSessionRow,
  content: string,
  messageType: 'text' | 'choice',
  nodeId: string,
  interactive?: InteractiveMessage,
): Promise<void> {
  // 1. Record in flow_messages table
  await this.sessionRepo.addMessage({ sessionId, direction: 'outbound', nodeId, content, messageType });
  
  // 2. Send via channel abstraction
  if (session.channel === 'whatsapp' && session.channel_session_id) {
    const clinicId = await this.sessionRepo.findDoctorClinicId(session.doctor_id);
    if (clinicId) {
      await sendMessage({
        to: session.channel_session_id,
        content,
        clinicId,
        channel: 'whatsapp',
        options: {
          ...(interactive ? { interactive } : {}),
          doctorId: session.doctor_id,  // NEW: pass for Evolution routing
        },
      });
    }
  }
}
```
