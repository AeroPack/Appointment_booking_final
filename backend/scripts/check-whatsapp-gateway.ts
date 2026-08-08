/**
 * Runnable check for the WhatsApp gateway send path.
 *
 * Points WA_GATEWAY_URL / WA_AUTH_URL at a local stub server, drives the real
 * WhatsAppChannel.sendMessage(), and asserts the outgoing request matches the
 * gateway contract for both send modes:
 *  - normal: free-text text=, stype=normal
 *  - auth:   text=<template>, Params=<otp>, stype=auth, auth account credentials
 *
 * Run: npx tsx scripts/check-whatsapp-gateway.ts
 */

import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

process.env['WA_GATEWAY_USER'] = 'TEST_USER';
process.env['WA_GATEWAY_PASS'] = 'test_pass';
process.env['WA_GATEWAY_SENDER'] = 'BUZWAP';
process.env['WA_AUTH_USER'] = 'TEST_AUTH_USER';
process.env['WA_AUTH_PASS'] = 'test_auth_pass';
process.env['WA_AUTH_TEMPLATE'] = 'aero_auth';

const received: URLSearchParams[] = [];
let reply = '1701|919999999999';

const server = http.createServer((req, res) => {                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            
  received.push(new URL(req.url!, 'http://localhost').searchParams);
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end(reply);
});

await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address() as AddressInfo;
process.env['WA_GATEWAY_URL'] = `http://127.0.0.1:${port}/api/sendmsgutil.php`;
process.env['WA_AUTH_URL'] = `http://127.0.0.1:${port}/api/sendmsgutil.php`;

const { WhatsAppChannel } = await import('../src/utils/channels/whatsapp.js');
const channel = new WhatsAppChannel();
const clinicId = '00000000-0000-0000-0000-000000000000';

// Success path
const ok = await channel.sendMessage({
  to: '9876543210',
  content: 'Your verification code is: 123456',
  clinicId,
});

assert.equal(ok.success, true, `expected success, got: ${ok.error}`);
const query = received[0]!;
assert.equal(query.get('user'), 'TEST_USER');
assert.equal(query.get('pass'), 'test_pass');
assert.equal(query.get('sender'), 'BUZWAP');
assert.equal(query.get('phone'), '919876543210', 'bare 10-digit number gets the 91 prefix, no +');
assert.equal(query.get('text'), 'Your verification code is: 123456');
assert.equal(query.get('priority'), 'wa');
assert.equal(query.get('stype'), 'normal');
assert.equal(query.get('Params'), null, 'no template variable on a free-text send');

// Auth path: OTPs go out as the approved template, from the auth account
const authOk = await channel.sendMessage({
  to: '9876543210',
  content: 'Your verification code is: 123456. It expires in 5 minutes.',
  clinicId,
  options: { type: 'auth_otp', params: '123456' },
});

assert.equal(authOk.success, true, `expected auth send to succeed, got: ${authOk.error}`);
const authQuery = received[1]!;
assert.equal(authQuery.get('user'), 'TEST_AUTH_USER', 'auth send uses the auth account');
assert.equal(authQuery.get('pass'), 'test_auth_pass');
assert.equal(authQuery.get('sender'), 'BUZWAP', 'sender falls back to WA_GATEWAY_SENDER');
assert.equal(authQuery.get('phone'), '919876543210');
assert.equal(authQuery.get('text'), 'aero_auth', 'text carries the template name, not the body');
assert.equal(authQuery.get('priority'), 'wa');
assert.equal(authQuery.get('stype'), 'auth');
assert.equal(authQuery.get('Params'), '123456', 'the OTP rides in Params');

// An auth message with no params must fall back to the free-text send
const noParams = await channel.sendMessage({
  to: '9876543210',
  content: 'Your verification code is: 654321.',
  clinicId,
  options: { type: 'auth_otp' },
});

assert.equal(noParams.success, true);
const fallbackQuery = received[2]!;
assert.equal(fallbackQuery.get('stype'), 'normal');
assert.equal(fallbackQuery.get('text'), 'Your verification code is: 654321.');
assert.equal(fallbackQuery.get('user'), 'TEST_USER', 'fallback uses the normal account');

// Gateway-reported failure must surface as a failed result
reply = 'ERROR: invalid credentials';
const failed = await channel.sendMessage({ to: '+91 98765 43210', content: 'hi', clinicId });
assert.equal(failed.success, false);
assert.match(failed.error!, /invalid credentials/);
assert.equal(received[3]!.get('phone'), '919876543210', '+ and spaces are stripped');

// Missing normal credentials must block a free-text send...
reply = '1701|919999999999';
delete process.env['WA_GATEWAY_USER'];
const unconfigured = await channel.sendMessage({ to: '9876543210', content: 'hi', clinicId });
assert.equal(unconfigured.success, false);
assert.equal(received.length, 4, 'no request when the gateway is unconfigured');

// ...but an auth-only setup must still be able to send OTPs
const authOnly = await channel.sendMessage({
  to: '9876543210',
  content: 'Your verification code is: 123456.',
  clinicId,
  options: { type: 'auth_otp', params: '123456' },
});
assert.equal(authOnly.success, true, `auth-only config must still send: ${authOnly.error}`);
assert.equal(received[4]!.get('user'), 'TEST_AUTH_USER');
assert.equal(received[4]!.get('stype'), 'auth');

// With neither account configured, nothing goes out
delete process.env['WA_AUTH_USER'];
const noAccounts = await channel.sendMessage({
  to: '9876543210',
  content: 'hi',
  clinicId,
  options: { type: 'auth_otp', params: '123456' },
});
assert.equal(noAccounts.success, false);
assert.equal(received.length, 5, 'no request when no account is configured');

server.close();
console.log('OK: WhatsApp gateway send path verified');
process.exit(0);
