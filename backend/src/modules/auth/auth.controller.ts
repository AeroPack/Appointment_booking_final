import type { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service.js';
import { AuthRepository } from './auth.repository.js';
import { success } from '../../utils/response.js';

const repo = new AuthRepository();
const service = new AuthService(repo);

export async function sendOtp(req: Request, res: Response, next: NextFunction) {
  console.log(`[CONTROLLER] sendOtp called with body:`, JSON.stringify(req.body));
  try {
    const { mobile_number } = req.body;
    const otp = await service.sendOtp(mobile_number);
    console.log(`[CONTROLLER] sendOtp succeeded`);
    const data: Record<string, unknown> = { message: 'OTP sent to mobile', expires_in: 300 };
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
    const { mobile_number, otp } = req.body;
    const result = await service.verifyOtpAndLogin(mobile_number, otp);
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
