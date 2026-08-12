# WhatsApp Evolution API Integration - Implementation Plan

## Overview

The appointment booking backend has two issues preventing WhatsApp OTP from working and a third issue for chatbot messages. This plan covers all fixes needed.

## Current State

- **Evolution API**: Running at `https://evolution.aeropackpos.in`, API key `760857eccde30ec19ed07ec558933076fa916a157db1942052a226feae15e2ef`
- **Existing instance**: `chandan` (connected, +919811150902) - will be used for auth/OTP messages
- **Backend**: Docker image `chandan8585/backend:latest`, running on port 7680 (maps to 3000 internally)
- **Repo**: `https://github.com/AeroPack/Appointment_booking_final.git`
- **Backend source**: `backend/src/` directory in the repo

---

## Issue 1: Missing Environment Variables

The Docker container is missing 3 critical env vars. Without them, `getCredentials()` returns null and all Evolution API calls fail.

### Fix: Add to CI/CD Deployment Config

Add these env vars to your GitHub Actions / docker-compose / deployment pipeline:

```yaml
EVOLUTION_API_URL=https://evolution.aeropackpos.in
EVOLUTION_API_KEY=760857eccde30ec19ed07ec558933076fa916a157db1942052a226feae15e2ef
BACKEND_URL=https://appointment.aeropackpos.in
EVO_SYSTEM_INSTANCE=chandan
```

**Why `https://evolution.aeropackpos.in`**: The backend container is on `aeropos-backend_default` Docker network, Evolution API is on `evolution_evolution-net`. They cannot see each other via Docker DNS. But both can reach each other via the public URL through nginx.

---

## Issue 2: Auth OTP Requires `doctorId` But Doesn't Have One

### Problem

`WhatsAppEvolutionChannel.sendMessage()` hard-requires `doctorId` for ALL messages:

```javascript
// Current code in whatsapp-evolution.js
const doctorId = params.options?.['doctorId'];
if (!doctorId) {
    return createErrorResult('doctorId is required for Evolution API routing');
}
```

But `sendOtpWhatsApp()` (used by signup, forgot-password, patient OTP login) never passes `doctorId`:

```javascript
// auth.service.ts - sendOtpWhatsApp()
const result = await whatsapp.sendMessage({
  to: mobileNumber,
  content: `Your verification code is: ${otp}. It expires in 5 minutes.`,
  clinicId,
  options: { type: 'auth_otp', params: otp },
  // No doctorId here! It's a system-level operation.
});
```

### Fix

Modify `backend/src/utils/channels/whatsapp-evolution.ts` - see **File Changes** section below.

---

## Issue 3: `sendTemplate()` Uses Cloud API Format (Won't Work with Baileys)

### Problem

The current `sendTemplate()` sends a WhatsApp Cloud API template message:

```javascript
async sendTemplate(credentials, instanceName, to, otp) {
    const templateName = process.env['WA_AUTH_TEMPLATE'] || 'aero_auth';
    await axios.post(`${credentials.apiUrl}/message/sendTemplate/${instanceName}`, {
        number: to,
        template: { name: templateName, ... }
    }, ...);
}
```

Baileys (Evolution API) doesn't support WhatsApp Cloud API templates. This will fail silently or error out.

### Fix

For auth OTP messages, send as plain text instead of a template:

```javascript
// Auth OTP → send as plain text
if (isAuthMessage) {
    const otp = options?.['params'] as string;
    return this.sendText(
        credentials, instanceName, recipient,
        `Your verification code is: ${otp}. It expires in 5 minutes.`
    );
}
```

---

## Architecture

```
Auth Messages (OTP for signup/forgot-password/patient login)
  → Uses "chandan" instance (+919811150902)
  → Sent as plain text

Chatbot Messages (patient texts doctor's WhatsApp number)
  → Uses doctor's own instance (evo-{doctorId})
  → Doctor scans QR to connect their number
  → Patient messages doctor → Evolution webhook → bot processes → replies via doctor's instance
```

---

## File Changes

### File: `backend/src/utils/channels/whatsapp-evolution.ts`

Replace the entire `sendMessage()` method with this implementation:

```typescript
async sendMessage(params: SendMessageParams): Promise<MessageResult> {
    const { to, content, clinicId } = params;
    try {
      if (!isValidPhone(to)) {
        return createErrorResult('Invalid phone number format');
      }

      const credentials = this.getCredentials();
      if (!credentials) {
        return createErrorResult('Evolution API is not configured');
      }

      const recipient = normalizePhone(to);
      const doctorId = params.options?.['doctorId'] as string | undefined;
      const type = params.options?.['type'] as string | undefined;
      const isAuthMessage = typeof type === 'string' && AUTH_MESSAGE_TYPES.includes(type);

      // ── Resolve instance name ──────────────────────────────────────────
      let instanceName: string | null = null;

      if (isAuthMessage && !doctorId) {
        // Auth OTP without doctorId → use system instance (chandan)
        instanceName = process.env['EVO_SYSTEM_INSTANCE'] || 'chandan';
      } else if (doctorId) {
        // Doctor's chatbot message → use their connected instance
        instanceName = await this.resolveInstance(doctorId);
      }

      if (!instanceName) {
        return createErrorResult('No WhatsApp instance available');
      }

      // ── Auth OTP → plain text (Baileys doesn't support Cloud API templates) ──
      if (isAuthMessage) {
        const templateParam = params.options?.['params'];
        const otp = typeof templateParam === 'string' ? templateParam : '';
        return this.sendText(
          credentials,
          instanceName,
          recipient,
          `Your verification code is: ${otp}. It expires in 5 minutes.`
        );
      }

      // ── Interactive messages (list/buttons fallback to numbered text) ──
      const interactive = params.options?.['interactive'];
      if (interactive) {
        return this.sendInteractive(credentials, instanceName, recipient, interactive, content);
      }

      // ── Plain text ──
      return this.sendText(credentials, instanceName, recipient, content);
    } catch (error) {
      console.error('[WhatsAppEvolutionChannel] Error sending message:', error);
      if (error instanceof AxiosError) {
        const msg = error.response?.data?.message || error.message;
        return createErrorResult(`API request failed: ${msg}`, {
          status: error.response?.status,
        });
      }
      return createErrorResult(
        error instanceof Error ? error.message : 'Unknown error occurred'
      );
    }
  }
```

### What Changes (Summary)

| Line | Old | New |
|------|-----|-----|
| After `getCredentials()` check | Hard-require `doctorId`, error if missing | Resolve instance: auth OTP → system instance, chatbot → doctor instance |
| Auth OTP handling | `sendTemplate()` (Cloud API, fails with Baileys) | `sendText()` (plain text, works with Baileys) |
| Instance resolution | Only `resolveInstance(doctorId)` | Fallback to `process.env.EVO_SYSTEM_INSTANCE` for auth messages |

### Everything Else Stays the Same

These methods do NOT need changes:
- `validateConfig()` - works as-is
- `getConfig()` - works as-is
- `sendText()` - works as-is
- `sendInteractive()` - works as-is
- `sendList()` - works as-is
- `resolveInstance()` - works as-is (used for doctor chatbot messages)
- `getCredentials()` - works as-is (reads from env vars)
- `headers()` - works as-is

---

## Files That Are Already Working (No Changes Needed)

| File | What It Does | Status |
|------|-------------|--------|
| `backend/src/modules/doctors/evolution.service.ts` | Creates Evolution instances, configures webhooks, polls QR | Working |
| `backend/src/modules/flows/flow.webhook-evolution-controller.ts` | Receives Evolution webhooks, extracts messages, routes to flow sessions | Working |
| `backend/src/modules/flows/flow.webhook-evolution-routes.ts` | Webhook route: `POST /webhooks/whatsapp-evolution/:instanceName` | Working |
| `backend/src/modules/flows/flow.executor.ts` | Processes flow nodes, sends outbound via `sendMessage()` with `doctorId` | Working |
| `backend/src/modules/flows/flow.session-service.js` | Creates/resumes flow sessions | Working |
| `backend/src/app.ts` | All routes mounted correctly | Working |
| `backend/src/utils/channels/initializer.ts` | Selects `WhatsAppEvolutionChannel` when `WA_PROVIDER=evolution` | Working |
| `backend/src/modules/auth/auth.service.ts` | Auth OTP flow (calls `sendOtpWhatsApp()`) | Working |
| Nginx config | Proxies `/api/` to port 7680 | Working |

---

## How the Complete Flow Works

### Auth OTP Flow (After Fix)

```
1. Patient requests signup/forgot-password
   POST /api/auth/register or /api/auth/forgot-password

2. Auth service calls sendOtpWhatsApp()
   → channelRegistry.get('whatsapp').sendMessage({
       to: "+919888877766",
       content: "Your verification code is: 123456...",
       clinicId: "...",
       options: { type: 'auth_otp', params: '123456' }
     })

3. WhatsAppEvolutionChannel.sendMessage()
   → type = 'auth_otp', no doctorId
   → instanceName = process.env.EVO_SYSTEM_INSTANCE = "chandan"
   → sendText(credentials, "chandan", "+919888877766", "Your verification code is: 123456...")
   → POST https://evolution.aeropackpos.in/message/sendText/chandan
   → OTP delivered to patient via chandan's WhatsApp number
```

### Chatbot Flow (Already Working)

```
1. Doctor connects WhatsApp
   POST /api/doctor/whatsapp/connect { phoneNumber: "+919811150902" }
   → Creates Evolution instance "evo-{doctorId}"
   → Configures webhook: https://appointment.aeropackpos.in/api/webhooks/whatsapp-evolution/evo-{doctorId}
   → Doctor scans QR → instance connected

2. Patient sends WhatsApp to doctor's number
   "Hi, I want to book an appointment"

3. Evolution API receives message → sends webhook
   POST https://appointment.aeropackpos.in/api/webhooks/whatsapp-evolution/evo-{doctorId}

4. handleEvolutionWebhook()
   → Extracts instanceName from URL → looks up doctorId
   → Extracts message text from webhook payload
   → Deduplicates via whatsapp_inbound_messages table
   → findActiveSession(doctorId, phone):
      - No session → startSession() → finds published flow with trigger_type='book'
      - Active session → resumeSession() → feeds input to flow executor

5. Flow executor processes message
   → Determines next node (text, choice, slot_picker, booking_action, etc.)
   → sendOutbound() sends reply via doctor's instance
   → POST https://evolution.aeropackpos.in/message/sendText/evo-{doctorId}
```

---

## Testing After Deployment

### 1. Test Auth OTP (Signup)

```bash
curl -X POST https://appointment.aeropackpos.in/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Doctor","mobile_number":"919888877766","password":"Test1234!"}'

# Expected: { "success": true, "data": { "user_id": "...", "expires_in": 300 } }
# OTP should arrive on patient's WhatsApp from chandan's number
```

### 2. Test Auth OTP (Forgot Password)

```bash
curl -X POST https://appointment.aeropackpos.in/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"mobile_number":"919888877766"}'

# Expected: { "success": true, "data": { "message": "If an account exists...", "expires_in": 300 } }
```

### 3. Check Backend Logs

```bash
docker logs appointment_booking_backend 2>&1 | tail -20

# Should see NO errors about "Evolution API is not configured"
# Should see NO errors about "doctorId is required"
# Should see successful OTP delivery logs
```

### 4. Test Chatbot Flow

```bash
# First, doctor needs to connect WhatsApp via the frontend:
# Login → Settings → WhatsApp → Connect → Scan QR

# Then send a WhatsApp message to the doctor's number from a patient phone
# Bot should respond with the published flow
```

### 5. Verify Evolution Instance Status

```bash
curl -s https://evolution.aeropackpos.in/instance/fetchInstances \
  -H "apikey: 760857eccde30ec19ed07ec558933076fa916a157db1942052a226feae15e2ef" | python3 -m json.tool

# Should show "chandan" instance (connected) and any doctor instances
```

---

## Important Notes

1. **No flows created yet**: The `flows` table is empty. The bot needs at least one published flow with `trigger_type = 'book'` to work. Create this in the frontend flow builder UI before testing the chatbot.

2. **`chandan` instance is shared**: The same instance is used for all auth OTP messages across all doctors. This is by design - it's the "system" WhatsApp number.

3. **Doctor instances are per-doctor**: Each doctor gets their own Evolution instance (evo-{doctorId}). Patients message the doctor's own WhatsApp number.

4. **Webhook URL is configured automatically**: When a doctor connects WhatsApp, `evolution.service.ts` sets the webhook URL to `${BACKEND_URL}/api/webhooks/whatsapp-evolution/${instanceName}`. No manual configuration needed.

5. **Message deduplication**: The `whatsapp_inbound_messages` table prevents the same message from being processed twice (Evolution API may retry webhooks).

---

## Deployment Checklist

- [ ] Add env vars to CI/CD (EVOLUTION_API_URL, EVOLUTION_API_KEY, BACKEND_URL, EVO_SYSTEM_INSTANCE)
- [ ] Modify `backend/src/utils/channels/whatsapp-evolution.ts` (see File Changes section)
- [ ] Push code to GitHub
- [ ] Wait for CI/CD to build and deploy new image
- [ ] Verify container has new env vars: `docker exec appointment_booking_backend env | grep EVOLUTION`
- [ ] Test signup OTP flow
- [ ] Test forgot-password OTP flow
- [ ] Create a published flow in frontend (trigger_type = 'book')
- [ ] Doctor connects WhatsApp via frontend QR scan
- [ ] Test chatbot by sending WhatsApp message to doctor's number
