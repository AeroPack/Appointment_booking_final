/**
 * Runnable check for the WhatsApp Cloud API booking path.
 *
 * Two halves, both pure enough to run without a database:
 *  1. Outbound - points WA_CLOUD_API_BASE at a local stub, drives the real
 *     WhatsAppCloudChannel.sendMessage(), and asserts the JSON body matches
 *     Meta's schema for text, reply buttons, list picker, and template sends,
 *     including the hard limits (3 buttons, 10 list rows, title lengths).
 *  2. Inbound - feeds real-shaped webhook envelopes through extractMessages()
 *     and asserts taps resolve to option ids and status receipts are ignored.
 *
 * Run: npx tsx scripts/check-whatsapp-cloud.ts
 */

import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

process.env['WA_CLOUD_PHONE_NUMBER_ID'] = '111111111111111';
process.env['WA_CLOUD_ACCESS_TOKEN'] = 'test_token';
process.env['WA_CLOUD_API_VERSION'] = 'v21.0';
process.env['WA_AUTH_TEMPLATE'] = 'aero_auth';
process.env['WA_CLOUD_TEMPLATE_LANG'] = 'en';

const received: Array<{ url: string; auth?: string; body: any }> = [];

const server = http.createServer((req, res) => {
  let raw = '';
  req.on('data', (chunk) => (raw += chunk));
  req.on('end', () => {
    received.push({
      url: req.url!,
      auth: req.headers.authorization,
      body: JSON.parse(raw || '{}'),
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ messages: [{ id: 'wamid.TEST' }] }));
  });
});

await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address() as AddressInfo;
process.env['WA_CLOUD_API_BASE'] = `http://127.0.0.1:${port}`;

const { WhatsAppCloudChannel } = await import('../src/utils/channels/whatsapp-cloud.js');
const channel = new WhatsAppCloudChannel();
const clinicId = '00000000-0000-0000-0000-000000000000';

// ---------------------------------------------------------------- outbound

// Plain text
const textResult = await channel.sendMessage({
  to: '9818216834',
  content: 'What is your full name?',
  clinicId,
});

assert.equal(textResult.success, true, `expected success, got: ${textResult.error}`);
assert.equal(textResult.messageId, 'wamid.TEST');
assert.equal(received[0]!.url, '/v21.0/111111111111111/messages');
assert.equal(received[0]!.auth, 'Bearer test_token');
assert.equal(received[0]!.body.messaging_product, 'whatsapp');
assert.equal(received[0]!.body.to, '919818216834', 'bare 10-digit number gets the 91 prefix, no +');
assert.equal(received[0]!.body.type, 'text');
assert.equal(received[0]!.body.text.body, 'What is your full name?');

// Reply buttons
await channel.sendMessage({
  to: '919818216834',
  content: 'fallback',
  clinicId,
  options: {
    interactive: {
      kind: 'buttons',
      body: 'Hi! I can help you book an appointment.',
      buttons: [{ id: 'book', title: 'Book Appointment' }],
    },
  },
});

const buttons = received[1]!.body;
assert.equal(buttons.type, 'interactive');
assert.equal(buttons.interactive.type, 'button');
assert.equal(buttons.interactive.body.text, 'Hi! I can help you book an appointment.');
assert.equal(buttons.interactive.action.buttons.length, 1, 'a single-option choice is valid');
assert.deepEqual(buttons.interactive.action.buttons[0], {
  type: 'reply',
  reply: { id: 'book', title: 'Book Appointment' },
});

// Buttons past Meta's cap of 3, with an over-long title
await channel.sendMessage({
  to: '919818216834',
  content: 'fallback',
  clinicId,
  options: {
    interactive: {
      kind: 'buttons',
      body: 'Pick one',
      buttons: [
        { id: 'a', title: 'This title is definitely longer than twenty' },
        { id: 'b', title: 'B' },
        { id: 'c', title: 'C' },
        { id: 'd', title: 'D' },
      ],
    },
  },
});

const capped = received[2]!.body.interactive.action.buttons;
assert.equal(capped.length, 3, 'buttons are capped at 3');
assert.equal(capped[0].reply.title.length, 20, 'button titles are clamped to 20 chars');

// Slot list, spanning two days and overflowing the 10-row budget
await channel.sendMessage({
  to: '919818216834',
  content: 'fallback',
  clinicId,
  options: {
    interactive: {
      kind: 'list',
      body: 'Please choose a time that suits you:',
      button: 'View times',
      sections: [
        {
          title: 'Fri, 08 Aug',
          rows: Array.from({ length: 8 }, (_, i) => ({
            id: `slot:2026-08-08T1${i}:00:00+05:30`,
            title: `1${i}:00 AM - 1${i}:15 AM`,
            description: 'Main Clinic',
          })),
        },
        {
          title: 'Sat, 09 Aug',
          rows: Array.from({ length: 5 }, (_, i) => ({
            id: `slot:2026-08-09T1${i}:00:00+05:30`,
            title: `1${i}:00 AM - 1${i}:15 AM`,
          })),
        },
      ],
    },
  },
});

const list = received[3]!.body.interactive;
assert.equal(list.type, 'list');
assert.equal(list.action.button, 'View times');
const totalRows = list.action.sections.reduce((n: number, s: any) => n + s.rows.length, 0);
assert.equal(totalRows, 10, 'list rows are capped at 10 across ALL sections, not per section');
assert.equal(list.action.sections[0].rows.length, 8);
assert.equal(list.action.sections[1].rows.length, 2, 'the second section gets what is left');
assert.equal(
  list.action.sections[0].rows[0].id,
  'slot:2026-08-08T10:00:00+05:30',
  'the row id round-trips the exact slot start'
);

// OTP goes out as an approved template, not free text
await channel.sendMessage({
  to: '919818216834',
  content: 'Your code is 123456',
  clinicId,
  options: { type: 'auth_otp', params: '123456' },
});

const template = received[4]!.body;
assert.equal(template.type, 'template');
assert.equal(template.template.name, 'aero_auth');
assert.equal(template.template.language.code, 'en');
assert.deepEqual(template.template.components[0].parameters[0], { type: 'text', text: '123456' });

// An auth send with no code falls back to text rather than failing the send
await channel.sendMessage({
  to: '919818216834',
  content: 'Your code is 123456',
  clinicId,
  options: { type: 'auth_otp' },
});
assert.equal(received[5]!.body.type, 'text', 'a template call with no variable degrades to text');

// ----------------------------------------------------------------- inbound

const { extractMessages } = await import('../src/modules/flows/flow.webhook-controller.js');

const envelope = (message: unknown) => ({
  object: 'whatsapp_business_account',
  entry: [{ id: '0', changes: [{ field: 'messages', value: { messages: [message] } }] }],
});

const text = extractMessages(
  envelope({ id: 'wamid.1', from: '919818216834', type: 'text', text: { body: 'Hi' } })
);
assert.equal(text.length, 1);
assert.equal(text[0]!.input, 'Hi');
assert.equal(text[0]!.from, '919818216834');

const buttonTap = extractMessages(
  envelope({
    id: 'wamid.2',
    from: '919818216834',
    type: 'interactive',
    interactive: { type: 'button_reply', button_reply: { id: 'book', title: 'Book Appointment' } },
  })
);
assert.equal(buttonTap[0]!.input, 'book', 'a tap yields the option id, not the visible label');

const listTap = extractMessages(
  envelope({
    id: 'wamid.3',
    from: '919818216834',
    type: 'interactive',
    interactive: {
      type: 'list_reply',
      list_reply: { id: 'slot:2026-08-08T10:00:00+05:30', title: '10:00 AM - 10:15 AM' },
    },
  })
);
assert.equal(
  listTap[0]!.input,
  'slot:2026-08-08T10:00:00+05:30',
  'the slot timestamp survives the round trip'
);

const templateTap = extractMessages(
  envelope({
    id: 'wamid.4',
    from: '919818216834',
    type: 'button',
    button: { payload: 'book', text: 'Book Appointment' },
  })
);
assert.equal(templateTap[0]!.input, 'book', 'template quick-reply uses button.payload');

// Delivery receipts must not be mistaken for patient messages, or the bot
// starts replying to itself.
const statuses = extractMessages({
  object: 'whatsapp_business_account',
  entry: [
    {
      id: '0',
      changes: [
        {
          field: 'messages',
          value: { statuses: [{ id: 'wamid.TEST', status: 'delivered', recipient_id: '919818216834' }] },
        },
      ],
    },
  ],
});
assert.equal(statuses.length, 0, 'status receipts are not messages');

// Unsupported media yields nothing rather than garbage input.
const image = extractMessages(
  envelope({ id: 'wamid.5', from: '919818216834', type: 'image', image: { id: 'media.1' } })
);
assert.equal(image.length, 0, 'unsupported message types are ignored');

assert.equal(extractMessages({}).length, 0, 'a malformed body is survivable');
assert.equal(extractMessages(null).length, 0);

server.close();
console.log('check-whatsapp-cloud: all assertions passed');
