import type { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service.js';
import { AuthRepository } from './auth.repository.js';
import { success } from '../../utils/response.js';
import type { AuthIdentifier } from './auth.types.js';

const repo = new AuthRepository();
const service = new AuthService(repo);

export async function sendOtp(req: Request, res: Response, next: NextFunction) {
  console.log(`[CONTROLLER] sendOtp called with body:`, JSON.stringify(req.body));
  try {
    const { mobile_number, email } = req.body;
    const identifier: AuthIdentifier = email 
      ? { email } 
      : { mobile_number };

    const otp = await service.sendOtp(identifier);
    console.log(`[CONTROLLER] sendOtp succeeded`);
    
    const channel = email ? 'email' : 'mobile';
    const data: Record<string, unknown> = { 
      message: `OTP sent to ${channel}`, 
      expires_in: 300 
    };
    
    if (process.env.NODE_ENV !== 'production') {
      data.__dev_otp = otp;
    }
    res.status(200).json(success(data));
  } catch (err) {
    console.log(`[CONTROLLER] sendOtp caught error:`, err instanceof Error ? err.message : err);
    next(err);
  }
}

export async function verifyOtp(req: Request, res: Response, next: NextFunction) {
  try {
    const { mobile_number, email, otp } = req.body;
    const identifier: AuthIdentifier = email 
      ? { email } 
      : { mobile_number };
      
    const result = await service.verifyOtpAndLogin(identifier, otp);
    res.status(200).json(success(result));
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const { refresh_token } = req.body;
    const result = await service.refresh(refresh_token);
    res.status(200).json(success(result));
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const { refresh_token } = req.body;
    await service.logout(refresh_token);
    res.status(200).json(success({ message: 'Logged out successfully' }));
  } catch (err) {
    next(err);
  }
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await service.me(req.auth!.userId);
    res.status(200).json(success(user));
  } catch (err) {
    next(err);
  }
}

// ─── Registration Handlers ─────────────────────────────────────────────────────

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.register(req.body);
    res.status(201).json(success(result));
  } catch (err) {
    next(err);
  }
}

export async function verifyRegistrationOtp(req: Request, res: Response, next: NextFunction) {
  try {
    const { user_id, otp } = req.body;
    const result = await service.verifyRegistrationOtp(user_id, otp);
    res.status(200).json(success(result));
  } catch (err) {
    next(err);
  }
}

export async function loginWithPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.loginWithPassword(req.body);
    res.status(200).json(success(result));
  } catch (err) {
    next(err);
  }
}

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
    await service.setupWhatsApp(req.auth!.userId, req.body);
    res.status(200).json(success({ message: 'WhatsApp configured successfully' }));
  } catch (err) {
    next(err);
  }
}

export async function forgotPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.forgotPassword(req.body);
    const data: Record<string, unknown> = {
      message: `OTP sent to ${req.body.email ? 'email' : 'mobile'}`,
      user_id: result.user_id,
      expires_in: result.expires_in,
    };
    if (process.env.NODE_ENV !== 'production') {
      data.__dev_otp = result.otp;
    }
    res.status(200).json(success(data));
  } catch (err) {
    next(err);
  }
}

export async function verifyPasswordResetOtp(req: Request, res: Response, next: NextFunction) {
  try {
    const { user_id, otp } = req.body;
    const result = await service.verifyPasswordResetOtp(user_id, otp);
    res.status(200).json(success(result));
  } catch (err) {
    next(err);
  }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.resetPassword(req.body);
    res.status(200).json(success(result));
  } catch (err) {
    next(err);
  }
}
