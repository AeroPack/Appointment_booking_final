/**
 * Auth Controller
 *
 * The boundary where raw user input becomes canonical: every contact is
 * normalized here (src/utils/phone.ts) so no query below this layer ever sees a
 * user-typed phone number. Lookups are exact string matches, so an unnormalized
 * value silently misses the account it was meant to find.
 */

import type { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service.js';
import { AuthRepository } from './auth.repository.js';
import { success } from '../../utils/response.js';
import { normalizePhone, normalizeEmail } from '../../utils/phone.js';
import type { AuthIdentifier } from './auth.types.js';

const repo = new AuthRepository();
const service = new AuthService(repo);

/** Non-production clients echo the code so the flow can be exercised without a gateway. */
const isProduction = () => process.env['NODE_ENV'] === 'production';

/** Build a canonical identifier from whichever contact field the client sent. */
function toIdentifier(body: { email?: string; mobile_number?: string }): AuthIdentifier {
  return body.email
    ? { email: normalizeEmail(body.email) }
    : { mobile_number: normalizePhone(body.mobile_number ?? '') };
}

/** The same canonical contact, flattened for the service input types. */
function toContact(body: { email?: string; mobile_number?: string }) {
  const identifier = toIdentifier(body);
  return 'email' in identifier
    ? { email: identifier.email }
    : { mobile_number: identifier.mobile_number };
}

export async function sendOtp(req: Request, res: Response, next: NextFunction) {
  try {
    const identifier = toIdentifier(req.body);
    const otp = await service.sendOtp(identifier);

    const data: Record<string, unknown> = {
      message: `OTP sent to ${'email' in identifier ? 'email' : 'mobile'}`,
      expires_in: 300,
    };
    if (!isProduction()) data.__dev_otp = otp;

    res.status(200).json(success(data));
  } catch (err) {
    next(err);
  }
}

export async function verifyOtp(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.verifyOtpAndLogin(toIdentifier(req.body), req.body.otp);
    res.status(200).json(success(result));
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.refresh(req.body.refresh_token);
    res.status(200).json(success(result));
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    await service.logout(req.body.refresh_token);
    res.status(200).json(success({ message: 'Logged out successfully' }));
  } catch (err) {
    next(err);
  }
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(success(await service.me(req.auth!.userId)));
  } catch (err) {
    next(err);
  }
}

// ─── Doctor registration ──────────────────────────────────────────────────────

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.register({
      name: req.body.name,
      password: req.body.password,
      ...(req.body.email ? { email: normalizeEmail(req.body.email) } : {}),
      ...(req.body.mobile_number ? { mobile_number: normalizePhone(req.body.mobile_number) } : {}),
    });
    res.status(201).json(success(result));
  } catch (err) {
    next(err);
  }
}

export async function verifyRegistrationOtp(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.verifyRegistrationOtp(req.body.user_id, req.body.otp);
    res.status(200).json(success(result));
  } catch (err) {
    next(err);
  }
}

export async function loginWithPassword(req: Request, res: Response, next: NextFunction) {
  try {
    // The UI collects one field; an '@' is what distinguishes the two kinds.
    const raw: string = req.body.email_or_mobile;
    const contact = raw.includes('@')
      ? { email: normalizeEmail(raw) }
      : { mobile_number: normalizePhone(raw) };

    const result = await service.loginWithPassword({ ...contact, password: req.body.password });
    res.status(200).json(success(result));
  } catch (err) {
    next(err);
  }
}

// ─── Doctor profile / clinic settings ─────────────────────────────────────────

export async function updateProfile(req: Request, res: Response, next: NextFunction) {
  try {
    await service.updateProfile(req.auth!.userId, req.body);
    res.status(200).json(success({ message: 'Profile updated successfully' }));
  } catch (err) {
    next(err);
  }
}

export async function setupWhatsApp(req: Request, res: Response, next: NextFunction) {
  try {
    await service.setupWhatsApp(req.auth!.userId, {
      ...req.body,
      ...(req.body.whatsapp_number
        ? { whatsapp_number: normalizePhone(req.body.whatsapp_number) }
        : {}),
    });
    res.status(200).json(success({ message: 'WhatsApp configured successfully' }));
  } catch (err) {
    next(err);
  }
}

// ─── Password reset ───────────────────────────────────────────────────────────

export async function forgotPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.forgotPassword(toContact(req.body));

    // Deliberately uniform: naming the account, or 404ing when there isn't one,
    // would turn this endpoint into a way to test which contacts are registered.
    const data: Record<string, unknown> = {
      message: 'If an account exists for that contact, a reset code has been sent.',
      expires_in: result.expires_in,
    };
    if (!isProduction() && result.otp) data.__dev_otp = result.otp;

    res.status(200).json(success(data));
  } catch (err) {
    next(err);
  }
}

export async function verifyPasswordResetOtp(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.verifyPasswordResetOtp({
      ...toContact(req.body),
      otp: req.body.otp,
    });
    res.status(200).json(success(result));
  } catch (err) {
    next(err);
  }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.resetPassword({
      ...toContact(req.body),
      otp: req.body.otp,
      new_password: req.body.new_password,
    });
    res.status(200).json(success(result));
  } catch (err) {
    next(err);
  }
}
