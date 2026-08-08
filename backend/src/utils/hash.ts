import crypto from 'crypto';

export function hashToken(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

export function verifyToken(value: string, stored: string): boolean {
  const computed = Buffer.from(hashToken(value));
  const expected = Buffer.from(stored);

  // timingSafeEqual throws on a length mismatch rather than returning false,
  // which turns a malformed stored hash into a 500 instead of a rejection.
  if (computed.length !== expected.length) {
    return false;
  }

  return crypto.timingSafeEqual(computed, expected);
}

export function generateOtp(): string {
  // Math.random() is predictable from prior outputs; an OTP is a credential.
  return crypto.randomInt(100000, 1000000).toString();
}
