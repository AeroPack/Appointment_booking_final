/**
 * Phone Number Utilities
 *
 * One canonical form for every phone number the system stores or matches on:
 * digits only, country code included, no '+'. Without this, `7678668630`,
 * `+91 7678668630` and `917678668630` are three different accounts, because
 * every lookup in this codebase is an exact string match.
 *
 * This replaces three divergent implementations that disagreed on the '+'
 * (whatsapp.ts produced `91...`, flow.webhook-controller.ts produced `+91...`,
 * so a number normalized by one never matched the other).
 *
 * The SQL function `normalize_phone()` (migration 20260806000001) mirrors
 * `normalizePhone` exactly - keep the two in step.
 */

/** Assumed country code for local-format numbers. */
const DEFAULT_COUNTRY_CODE = '91';

/** Gateways reject anything outside this range, and so do we. */
const MIN_DIGITS = 7;
const MAX_DIGITS = 15;

/**
 * Reduce a phone number to its canonical form: digits with a country code.
 * @param raw - Number in any format a user, gateway, or webhook might supply
 * @returns Digits-only number including the country code, or '' if there were no digits
 */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');

  // Local formats: a leading trunk '0' is dropped, a bare 10-digit number is
  // assumed domestic. Anything else already carries its country code.
  if (digits.startsWith('0')) {
    return DEFAULT_COUNTRY_CODE + digits.slice(1);
  }
  if (digits.length === 10) {
    return DEFAULT_COUNTRY_CODE + digits;
  }

  return digits;
}

/**
 * Check that a value is plausibly a phone number before normalizing it.
 * @param raw - Candidate phone number
 * @returns True if it contains only phone-shaped characters and a sane digit count
 */
export function isValidPhone(raw: string): boolean {
  if (!/^[+\d\s\-()]+$/.test(raw)) {
    return false;
  }
  const digits = raw.replace(/\D/g, '');
  return digits.length >= MIN_DIGITS && digits.length <= MAX_DIGITS;
}

/**
 * Canonicalize an email for storage and lookup. Mirrors the migration's
 * `lower(trim(...))` backfill so the unique index cannot be sidestepped by case.
 * @param raw - Email address as supplied
 * @returns Trimmed, lowercased address
 */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}
