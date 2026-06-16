import crypto from 'crypto';

export function hashToken(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

export function verifyToken(value: string, stored: string): boolean {
  const computed = hashToken(value);
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(stored));
}

export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
