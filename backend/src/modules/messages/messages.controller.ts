import type { Request, Response, NextFunction } from 'express';
import { success } from '../../utils/response.js';
import { MessagesService } from './messages.service.js';
import { MessagesRepository } from './messages.repository.js';
import { OtpService } from './otp.service.js';

const repo = new MessagesRepository();
export const messagesService = new MessagesService(repo);
const otpService = new OtpService(repo);

export async function sendMessage(req: Request, res: Response, next: NextFunction) {
  try {
    await messagesService.sendMessage(req.auth!.clinicId, req.auth!.userId, req.body);
    res.json({ message: 'scheduled' });
  } catch (err) {
    next(err);
  }
}

export async function sendOtp(req: Request, res: Response, next: NextFunction) {
  try {
    const { identifier, channel } = req.body;
    const result = await otpService.sendOtp({
      identifier,
      clinicId: req.auth!.clinicId,
      channel,
    });
    res.json({ message: 'OTP sent', otp_id: result.otpId });
  } catch (err) {
    next(err);
  }
}

export async function verifyOtp(req: Request, res: Response, next: NextFunction) {
  try {
    const { identifier, otp, otp_id } = req.body;
    const isValid = await otpService.verifyOtp({
      identifier,
      otp,
      otpId: otp_id,
    });
    res.json({ valid: isValid });
  } catch (err) {
    next(err);
  }
}
