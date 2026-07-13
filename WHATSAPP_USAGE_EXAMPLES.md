# WhatsApp Messaging Usage Examples

## Quick Start

The WhatsApp messaging integration is now complete and tested. Here are practical examples of how to use it.

### 1. Send OTP via WhatsApp

**API Endpoint:**
```
POST /api/messages/send-otp
```

**Request Body:**
```json
{
  "identifier": "+1234567890",
  "channel": "whatsapp"
}
```

**Response:**
```json
{
  "message": "OTP sent",
  "otp_id": "uuid-of-otp-record"
}
```

### 2. Verify OTP

**API Endpoint:**
```
POST /api/messages/verify-otp
```

**Request Body:**
```json
{
  "identifier": "+1234567890",
  "otp": "123456",
  "otp_id": "uuid-of-otp-record"
}
```

**Response:**
```json
{
  "valid": true
}
```

### 3. Send Template Message

**API Endpoint:**
```
POST /api/messages/send-message
```

**Request Body:**
```json
{
  "template_id": "uuid-of-template",
  "receiver_id": "uuid-of-patient",
  "appointment_id": "uuid-of-appointment"
}
```

## Code Examples

### Using the WhatsApp Channel Directly

```typescript
import { channelRegistry } from './utils/channels/index.js';
import { WhatsAppChannel } from './utils/channels/whatsapp.js';

// Get the WhatsApp channel
const whatsapp = channelRegistry.get('whatsapp') as WhatsAppChannel;

// Send a message
const result = await whatsapp.sendMessage({
  to: '+1234567890',
  content: 'Hello from WhatsApp integration!',
  clinicId: 'clinic-uuid',
});

if (result.success) {
  console.log('Message sent:', result.messageId);
} else {
  console.error('Failed:', result.error);
}
```

### Using the OTP Service

```typescript
import { OtpService } from './modules/messages/otp.service.js';
import { MessagesRepository } from './modules/messages/messages.repository.js';

const repo = new MessagesRepository();
const otpService = new OtpService(repo);

// Send OTP
const { otpId } = await otpService.sendOtp({
  identifier: '+1234567890',
  clinicId: 'clinic-uuid',
  channel: 'whatsapp',
});

// Verify OTP
const isValid = await otpService.verifyOtp({
  identifier: '+1234567890',
  otp: '123456',
  otpId,
});

console.log('OTP valid:', isValid);
```

### Using the Message Service

```typescript
import { MessagesService } from './modules/messages/messages.service.js';
import { MessagesRepository } from './modules/messages/messages.repository.js';

const repo = new MessagesRepository();
const messagesService = new MessagesService(repo);

// Send a template message
await messagesService.sendMessage(
  'clinic-uuid',
  'sender-uuid',
  {
    template_id: 'template-uuid',
    receiver_id: 'patient-uuid',
    appointment_id: 'appointment-uuid',
  }
);
```

## Database Setup

### 1. Run Migration

```bash
cd backend
npm run migrate:up
```

### 2. Configure Clinic

Update the clinics table with your UltraMsg credentials:

```sql
UPDATE clinics 
SET ultramsg_instance_id = 'instance184349',
    ultramsg_token = '8q7zgiw966oq3713',
    whatsapp_enabled = true
WHERE id = 'your-clinic-uuid';
```

### 3. Create OTP Template (Optional)

```sql
INSERT INTO message_templates (clinic_id, template_type, subject, content, channel, is_active)
VALUES (
  'your-clinic-uuid',
  'otp_verification',
  'Your Verification Code',
  'Your OTP is: {{otp}}. It expires in 5 minutes.',
  'whatsapp',
  true
);
```

## Testing the Integration

### Test Script

Run the test script to verify everything works:

```bash
cd backend
node --import dotenv/config --import tsx src/test-ultramsg.ts
```

### Manual Testing

1. **Send OTP:**
   ```bash
   curl -X POST http://localhost:5001/api/messages/send-otp \
     -H "Authorization: Bearer your-jwt-token" \
     -H "Content-Type: application/json" \
     -d '{"identifier": "+1234567890", "channel": "whatsapp"}'
   ```

2. **Verify OTP:**
   ```bash
   curl -X POST http://localhost:5001/api/messages/verify-otp \
     -H "Authorization: Bearer your-jwt-token" \
     -H "Content-Type: application/json" \
     -d '{"identifier": "+1234567890", "otp": "123456"}'
   ```

## Environment Variables

The system supports both database and environment variable configuration:

```env
# UltraMsg API Configuration
ULTRAMSG_INSTANCE_ID=instance184349
ULTRAMSG_TOKEN=8q7zgiw966oq3713
ULTRAMSG_API_URL=https://api.ultramsg.com/instance184349
```

**Priority:**
1. Database configuration (per-clinic)
2. Environment variables (fallback)

## Architecture Benefits

### 1. Channel Agnostic
The same code works for WhatsApp, email, or SMS:

```typescript
// Send via any channel
await otpService.sendOtp({
  identifier: recipient,
  clinicId: 'clinic-uuid',
  channel: 'whatsapp', // or 'email' or 'sms'
});
```

### 2. Multi-Clinic Support
Each clinic has its own UltraMsg configuration in the database.

### 3. Easy Extension
Adding new channels is simple:

```typescript
export class EmailChannel implements MessageChannel {
  readonly channelType = 'email';
  
  async sendMessage(params: SendMessageParams): Promise<MessageResult> {
    // Implementation
  }
}

channelRegistry.register(new EmailChannel());
```

## Troubleshooting

### Common Issues

1. **"WhatsApp is not enabled for this clinic"**
   - Check `whatsapp_enabled` column in clinics table
   - Ensure it's set to `true`

2. **"UltraMsg configuration is incomplete"**
   - Verify `ultramsg_instance_id` and `ultramsg_token` are set
   - Or set environment variables

3. **"Invalid phone number format"**
   - Ensure phone number starts with `+`
   - Include country code (e.g., `+1234567890`)

4. **API Errors**
   - Check UltraMsg dashboard for API limits
   - Verify instance is active
   - Check token validity

## Next Steps

1. **Test with real phone numbers**
2. **Create message templates for different use cases**
3. **Implement email and SMS channels**
4. **Add message status tracking**
5. **Implement bulk messaging**

## Support

For issues with:
- **UltraMsg API**: Check https://ultramsg.com/docs
- **Integration code**: Check the implementation files in `backend/src/utils/channels/`
